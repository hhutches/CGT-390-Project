
import os
import time
import json
import re
from typing import Optional, Dict, Any, List

import pandas as pd
import requests
from dotenv import load_dotenv

# ----------------------------
# Config
# ----------------------------
RATINGS_CSV = "ratings.csv"
CACHE_JSON = "tmdb_cache.json"               # caches title+year -> tmdb_id
OUT_CSV = "ratings_with_tmdb.csv"
UNMATCHED_CSV = "tmdb_unmatched.csv"

SLEEP_SEC = 0.25
PROGRESS_EVERY = 10

# ----------------------------
# Helpers
# ----------------------------
def norm_title(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s

def cache_key(title: str, year: Optional[int]) -> str:
    y = "" if year is None else str(int(year))
    return f"{norm_title(title)}|{y}"

def load_cache(path: str) -> Dict[str, Any]:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(path: str, cache: Dict[str, Any]) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def tmdb_search(api_key: str, title: str, year: Optional[int]) -> List[Dict[str, Any]]:
    url = "https://api.themoviedb.org/3/search/movie"
    params = {"api_key": api_key, "query": title}
    if year is not None:
        params["year"] = int(year)
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json().get("results", [])

def pick_best(results: List[Dict[str, Any]], year: Optional[int]) -> Optional[Dict[str, Any]]:
    if not results:
        return None
    if year is not None:
        y = str(int(year))
        # Prefer exact release year match
        for m in results:
            rd = (m.get("release_date") or "")
            if rd.startswith(y):
                return m
    return results[0]

def to_int_or_none(x) -> Optional[int]:
    try:
        if pd.isna(x):
            return None
        return int(x)
    except Exception:
        return None

# ----------------------------
# Main
# ----------------------------
def main():
    print("== TMDB Mapper starting ==")

    load_dotenv()
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        raise SystemExit("Missing TMDB_API_KEY in .env (create .env with TMDB_API_KEY=...)")

    if not os.path.exists(RATINGS_CSV):
        raise SystemExit(f"Cannot find {RATINGS_CSV} in current folder: {os.getcwd()}")

    ratings = pd.read_csv(RATINGS_CSV)
    needed_cols = {"Name", "Year", "Rating"}
    missing = needed_cols - set(ratings.columns)
    if missing:
        raise SystemExit(f"{RATINGS_CSV} is missing columns: {sorted(missing)}")

    print(f"Loaded {len(ratings)} ratings from {RATINGS_CSV}")

    cache = load_cache(CACHE_JSON)
    print(f"Cache entries: {len(cache)} ({CACHE_JSON})")

    rows = []
    unmatched = []

    for i, row in ratings.iterrows():
        title = str(row["Name"]).strip()
        year = to_int_or_none(row.get("Year"))

        key = cache_key(title, year)
        cached = cache.get(key)

        best = None
        if isinstance(cached, dict) and cached.get("tmdb_id"):
            best = cached
        else:
            try:
                results = tmdb_search(api_key, title, year)
                best_match = pick_best(results, year)
                if best_match:
                    best = {
                        "tmdb_id": best_match.get("id"),
                        "tmdb_title": best_match.get("title"),
                        "tmdb_release_date": best_match.get("release_date"),
                    }
                    cache[key] = best
                else:
                    cache[key] = {"tmdb_id": None}
            except Exception as e:
                cache[key] = {"tmdb_id": None, "error": str(e)}

            time.sleep(SLEEP_SEC)

        tmdb_id = (best or {}).get("tmdb_id")

        out_row = {
            "Date": row.get("Date"),
            "Name": row.get("Name"),
            "Year": row.get("Year"),
            "Letterboxd URI": row.get("Letterboxd URI"),
            "Rating": row.get("Rating"),
            "tmdb_id": tmdb_id,
            "tmdb_title": (best or {}).get("tmdb_title"),
            "tmdb_release_date": (best or {}).get("tmdb_release_date"),
        }
        rows.append(out_row)

        if not tmdb_id:
            unmatched.append({
                "Name": title,
                "Year": year,
                "Letterboxd URI": row.get("Letterboxd URI"),
            })

        if (i + 1) % PROGRESS_EVERY == 0:
            matched_count = sum(1 for r in rows if r.get("tmdb_id"))
            print(f"Processed {i+1}/{len(ratings)} | matched {matched_count}")

    save_cache(CACHE_JSON, cache)

    out = pd.DataFrame(rows)
    out.to_csv(OUT_CSV, index=False)

    um = pd.DataFrame(unmatched)
    um.to_csv(UNMATCHED_CSV, index=False)

    matched = out["tmdb_id"].notna().sum()
    print("== Done ==")
    print(f"Wrote {OUT_CSV} (matched {matched} / {len(out)})")
    print(f"Wrote {UNMATCHED_CSV} ({len(um)} unmatched)")
    print(f"Updated cache: {CACHE_JSON}")

if __name__ == "__main__":
    main()
