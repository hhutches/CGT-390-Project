import os, json
import pandas as pd
import requests
from dotenv import load_dotenv

RATINGS_IN = "ratings_with_tmdb.csv"
CACHE_DIR = "cache_tmdb"
OUT_FILE = "ratings_features.csv"

load_dotenv()
API_KEY = os.getenv("TMDB_API_KEY")
if not API_KEY:
    raise SystemExit("Missing TMDB_API_KEY in .env (TMDB_API_KEY=...)")

session = requests.Session()

def tmdb_get(path: str, params=None):
    url = f"https://api.themoviedb.org/3{path}"
    params = params or {}
    params["api_key"] = API_KEY
    r = session.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def cache_path(name: str, tmdb_id: int) -> str:
    return os.path.join(CACHE_DIR, f"{name}_{tmdb_id}.json")

def cached_or_fetch(name: str, tmdb_id: int, fetch_fn):
    p = cache_path(name, tmdb_id)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    data = fetch_fn()
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data

def get_details(tmdb_id: int):
    return cached_or_fetch("details", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}"))

def get_keywords(tmdb_id: int):
    return cached_or_fetch("keywords", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}/keywords"))

def get_credits(tmdb_id: int):
    return cached_or_fetch("credits", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}/credits"))

def director_from_credits(credits_json):
    crew = credits_json.get("crew", []) or []
    for p in crew:
        if p.get("job") == "Director":
            return p.get("name")
    return None

def build_text(details, keywords_json):
    title = details.get("title") or ""
    tagline = details.get("tagline") or ""
    overview = details.get("overview") or ""
    genres = [g.get("name") for g in (details.get("genres") or []) if g.get("name")]
    keywords = [k.get("name") for k in (keywords_json.get("keywords") or []) if k.get("name")]
    keywords = keywords[:30]
    text = " ".join([title, tagline, overview, " ".join(genres), " ".join(keywords)]).strip()
    return text, genres, keywords

# --- build vibe_text + entity_text for the new recommender ---
def _safe_str(x):
    return "" if x is None else str(x)

def _join_list(x, n=None):
    if x is None:
        return ""
    if isinstance(x, str):
        # could be JSON list string
        try:
            import json
            xs = json.loads(x)
            if isinstance(xs, list):
                x = xs
        except Exception:
            return x
    if isinstance(x, list):
        if n is not None:
            x = x[:n]
        return " ".join(_safe_str(t) for t in x if _safe_str(t).strip())
    return _safe_str(x)

# vibe_text: semantic/mood-ish text (genres + keywords + overview-ish text)
df["vibe_text"] = (
    df.get("genres", "").astype(str) + " " +
    df.get("keywords", "").astype(str) + " " +
    df.get("text", "").astype(str)
)

# entity_text: names / entities (director + title; add cast if you have it)
df["entity_text"] = (
    df.get("director", "").astype(str) + " " +
    df.get("title_tmdb", df.get("tmdb_title", df.get("Name", ""))).astype(str) + " " +
    df.get("title", "").astype(str)
)

# if you have a 'cast' column, include top-billed names
if "cast" in df.columns:
    df["entity_text"] = df["entity_text"] + " " + df["cast"].astype(str)

def year_from_release(details):
    y = (details.get("release_date") or "")[:4]
    return int(y) if y.isdigit() else None

def main():
    df = pd.read_csv(RATINGS_IN)
    df = df[df["tmdb_id"].notna()].copy()
    df["tmdb_id"] = df["tmdb_id"].astype(int)

    rows = []
    for i, mid in enumerate(df["tmdb_id"].tolist(), start=1):
        details = get_details(mid)
        keywords = get_keywords(mid)
        credits = get_credits(mid)

        text, genres, kws = build_text(details, keywords)
        rows.append({
            "tmdb_id": mid,
            "title_tmdb": details.get("title"),
            "release_date": details.get("release_date"),
            "year": year_from_release(details),
            "director": director_from_credits(credits),
            "vote_average": details.get("vote_average"),
            "vote_count": details.get("vote_count"),
            "genres": json.dumps(genres),
            "keywords": json.dumps(kws),
            "text": text,
        })

        if i % 50 == 0:
            print(f"processed {i}/{len(df)}")

    feats = pd.DataFrame(rows)
    out = df.merge(feats, on="tmdb_id", how="left")
    out.to_csv(OUT_FILE, index=False)
    print(f"Wrote {OUT_FILE} with columns:", list(out.columns))

if __name__ == "__main__":
    main()