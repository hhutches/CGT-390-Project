# =========================
# FILE: export_features_v2.py
# (overwrite the whole file)
# Creates/updates ratings_features.csv from ratings_with_tmdb.csv (or ratings.csv if needed)
# =========================
import os, json, time
FEATS_FILE = 'ratings_features.csv'

def _safe_write_csv(df, path):
    # Never clobber a good file with an empty one
    try:
        empty = getattr(df, "empty", None)
        if empty is True:
            raise SystemExit(f"Refusing to write empty CSV to {path} (df.empty=True).")
    except Exception:
        pass
    df.to_csv(path, index=False)

def _genres_to_set(x):
    """
    cand["genres"] in your pipeline is usually a JSON string like ["Crime","Drama"].
    Convert to a lowercase set of genre names, safely.
    """
    import json
    try:
        if x is None:
            return set()
        if isinstance(x, (list, tuple)):
            return set(str(g).strip().lower() for g in x)
        xs = str(x).strip()
        if not xs:
            return set()
        # try json first
        if xs.startswith("[") and xs.endswith("]"):
            arr = json.loads(xs)
            return set(str(g).strip().lower() for g in (arr or []))
        # fallback: split-ish
        return set(g.strip().lower() for g in re.split(r"[,\|/]", xs) if g.strip())
    except Exception:
        return set()

from pathlib import Path
from typing import Dict, Any, Optional

import requests
import pandas as pd

TMDB_API_KEY = os.getenv("TMDB_API_KEY") or os.getenv("TMDB_KEY") or os.getenv("TMDB_API")
if not TMDB_API_KEY:
    raise SystemExit("Missing TMDB API key. Set TMDB_API_KEY in your shell/env.")

BASE = "https://api.themoviedb.org/3"
SLEEP = float(os.getenv("SLEEP", "0.10"))
CACHE_PATH = Path("tmdb_cache.json")

IN1 = Path("ratings_with_tmdb.csv")
IN2 = Path("ratings.csv")
OUT = Path("ratings_features.csv")


def _filter_cand_movies_only(cand, no_docs=False, no_tv_movie=False, no_docs_strict=False):
    """Drop documentaries / TV movies at the candidate stage (big lever).

    - no_docs: removes Documentary genre if present
    - no_tv_movie: removes TV Movie genre if present
    - no_docs_strict: also removes rows whose title/overview smells like a documentary
    """
    import json
    import pandas as pd

    if cand is None or len(cand) == 0:
        return cand

    def parse_genres(x):
        try:
            g = json.loads(x) if isinstance(x, str) else x
        except Exception:
            g = x
        # normalize to list[str]
        if g is None:
            return []
        if isinstance(g, list):
            out = []
            for it in g:
                if isinstance(it, str):
                    out.append(it.strip().lower())
                elif isinstance(it, dict):
                    # TMDB sometimes returns {"id":..,"name":..}
                    name = it.get("name", "")
                    if name:
                        out.append(str(name).strip().lower())
            return out
        return []

    gseries = cand.get("genres", None)
    if gseries is None:
        return cand

    genres_norm = gseries.apply(parse_genres)

    keep = pd.Series([True] * len(cand), index=cand.index)

    if no_docs:
        keep &= ~genres_norm.apply(lambda gs: "documentary" in gs)
    if no_tv_movie:
        keep &= ~genres_norm.apply(lambda gs: "tv movie" in gs or "tv-movie" in gs)

    if no_docs_strict:
        # backup heuristic: if overview/title explicitly says documentary
        t = cand.get("title", "").astype(str).str.lower() if "title" in cand.columns else ""
        txt = cand.get("overview", "").astype(str).str.lower() if "overview" in cand.columns else ""
        blob = (t + " " + txt)
        keep &= ~blob.str.contains(r"\b(documentary|docu\b|true story documentary|concert film documentary)\b", regex=True)

    out = cand[keep].copy()
    return out
def load_cache() -> Dict[str, Any]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_cache(cache: Dict[str, Any]):
    try:
        CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def tmdb_get(path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    if params is None:
        params = {}
    params = dict(params)
    params["api_key"] = TMDB_API_KEY
    try:
        r = requests.get(BASE + path, params=params, timeout=25)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None

def get_movie_full(mid: int, cache: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ck = f"movie:{mid}"
    if ck in cache:
        return cache[ck]
    d = tmdb_get(f"/movie/{mid}", params={"append_to_response": "credits,keywords"})
    if not d:
        return None
    title = d.get("title") or ""
    release_date = d.get("release_date") or ""
    year = int(release_date[:4]) if (release_date and release_date[:4].isdigit()) else None
    runtime = int(d.get("runtime") or 0)
    vote_average = float(d.get("vote_average") or 0.0)
    vote_count = int(d.get("vote_count") or 0)

    genres = [g.get("name") for g in (d.get("genres") or []) if g.get("name")]
    genre_ids = [int(g.get("id")) for g in (d.get("genres") or []) if g.get("id") is not None]

    director = ""
    credits = d.get("credits") or {}
    for c in (credits.get("crew") or []):
        if c.get("job") == "Director" and c.get("name"):
            director = c["name"]
            break

    cast = credits.get("cast") or []
    cast_names = [x.get("name") for x in cast[:12] if x.get("name")]
    cast_text = " ".join([n for n in cast_names if n])

    kw_block = d.get("keywords") or {}
    kw_list = kw_block.get("keywords") or kw_block.get("results") or []
    keywords = [k.get("name") for k in kw_list if k.get("name")]

    overview = (d.get("overview") or "").strip()

    info = {
        "tmdb_id": int(mid),
        "title": title,
        "release_date": release_date,
        "year": year,
        "director": director,
        "vote_average": vote_average,
        "vote_count": vote_count,
        "runtime": runtime,
        "genres": genres,
        "genre_ids": genre_ids,
        "keywords": keywords,
        "overview": overview,
        "cast_text": cast_text,
    }
    cache[ck] = info
    return info

def build_texts(info: Dict[str, Any]) -> Dict[str, str]:
    vibe_parts = []
    vibe_parts.extend(info.get("genres") or [])
    vibe_parts.extend(info.get("keywords") or [])
    if info.get("overview"):
        vibe_parts.append(info["overview"])
    vibe_text = " ".join([str(x) for x in vibe_parts if x]).strip()

    ent_parts = []
    if info.get("director"):
        ent_parts.append(info["director"])
    if info.get("cast_text"):
        ent_parts.append(info["cast_text"])
    entity_text = " ".join(ent_parts).strip()
    return {"vibe_text": vibe_text, "entity_text": entity_text}

def main():
    print(f"[debug] FEATS_FILE={FEATS_FILE}", flush=True)
    if IN1.exists():
        df = pd.read_csv(IN1)
    elif IN2.exists():
        df = pd.read_csv(IN2)
    else:
        raise SystemExit("Need ratings_with_tmdb.csv or ratings.csv in this folder.")

    # normalize columns
    if "Name" not in df.columns and "title" in df.columns:
        df["Name"] = df["title"]
    if "Rating" not in df.columns and "rating" in df.columns:
        df["Rating"] = df["rating"]
    if "Year" in df.columns and "year" not in df.columns:
        df["year"] = df["Year"]

    if "tmdb_id" not in df.columns:
        raise SystemExit("Need tmdb_id column (use ratings_with_tmdb.csv).")

    cache = load_cache()
    out_rows = []
    for i, r in df.iterrows():
        mid = r.get("tmdb_id")
        if pd.isna(mid):
            continue
        mid = int(mid)
        info = get_movie_full(mid, cache)
        if not info:
            continue
        txt = build_texts(info)

        out_rows.append({
            "Name": r.get("Name"),
            "Rating": float(r.get("Rating")),
            "year": r.get("year") if "year" in df.columns else info.get("year"),
            "tmdb_id": mid,
            "release_date": info.get("release_date"),
            "director": info.get("director"),
            "vote_average": info.get("vote_average"),
            "vote_count": info.get("vote_count"),
            "runtime": info.get("runtime"),
            "genres": json.dumps(info.get("genres", []), ensure_ascii=False),
            "genre_ids": json.dumps(info.get("genre_ids", []), ensure_ascii=False),
            "keywords": json.dumps(info.get("keywords", []), ensure_ascii=False),
            "vibe_text": txt["vibe_text"],
            "entity_text": txt["entity_text"],
        })

        if (i + 1) % 50 == 0:
            print(f"[export] {i+1}/{len(df)}")
        time.sleep(SLEEP)

    save_cache(cache)
    out = pd.DataFrame(out_rows)
    out.to_csv(OUT, index=False)
    print(f"Wrote {OUT} rows={len(out)} cols={len(out.columns)}")

if __name__ == "__main__":
    main()