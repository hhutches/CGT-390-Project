#!/usr/bin/env python3
import argparse, json, re
import pandas as pd

def looks_doc_or_tv(row) -> bool:
    txt = " ".join([
        str(row.get("title") or ""),
        str(row.get("why") or ""),
        str(row.get("director") or ""),
        str(row.get("release_date") or ""),
    ]).lower()

    doc_signals = [
        "documentary", "doc", "behind the scenes", "making of", "true story of",
        "stand-up", "standup", "comedy special", "nightclub comedian", "concert film",
        "live at", "at the royal albert hall"
    ]
    tv_signals = ["tv movie", "television film", "made for tv", "made-for-tv", "miniseries", "limited series"]
    return any(s in txt for s in doc_signals) or any(s in txt for s in tv_signals)

def looks_religious(row) -> bool:
    txt = " ".join([str(row.get("title") or ""), str(row.get("why") or "")]).lower()
    bad = [
        "jesus", "christ", "christian", "bible", "biblical", "church", "catholic", "saint",
        "faith-based", "faith based", "evangel", "gospel", "prayer", "miracle",
    ]
    return any(b in txt for b in bad)

def safe_json_list(s):
    if not isinstance(s, str):
        return []
    s = s.strip()
    if not s.startswith("["):
        return []
    try:
        x = json.loads(s)
        return x if isinstance(x, list) else []
    except Exception:
        return []

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--infile", default="recs_all.csv")
    ap.add_argument("--outfile", default="recs_all_movies_STRICT.csv")
    ap.add_argument("--min_runtime", type=int, default=85)
    ap.add_argument("--min_vote_count", type=int, default=120)
    ap.add_argument("--no_religious", action="store_true")
    ap.add_argument("--mode", default="transgressive", choices=["transgressive","taste"])
    ap.add_argument("--top", type=int, default=0)
    args = ap.parse_args()

    df = pd.read_csv(args.infile)
    if df.empty:
        raise SystemExit(f"[fatal] {args.infile} is empty")

    # normalize tmdb_id
    if "tmdb_id" in df.columns:
        df["tmdb_id"] = pd.to_numeric(df["tmdb_id"], errors="coerce").astype("Int64")

    # bucket priority: deep_expand > weird_gems > everything else
    if "bucket" in df.columns:
        pr = {"deep_expand": 0, "weird_gems": 1}
        df["_bucket_pr"] = df["bucket"].map(pr).fillna(9).astype(int)
    else:
        df["_bucket_pr"] = 9

    # hard filters
    if "runtime" in df.columns:
        df["runtime"] = pd.to_numeric(df["runtime"], errors="coerce")
        df = df[(df["runtime"].fillna(0) >= args.min_runtime)]

    if "vote_count" in df.columns:
        df["vote_count"] = pd.to_numeric(df["vote_count"], errors="coerce")
        df = df[(df["vote_count"].fillna(0) >= args.min_vote_count)]

    # drop animation/family/kids unless you explicitly want it
    if "genres" in df.columns:
        bad_genres = {"animation","family","kids"}
        def has_bad_genres(s):
            gs = {str(x).lower() for x in safe_json_list(s)}
            return len(gs & bad_genres) > 0
        df = df[~df["genres"].apply(has_bad_genres)]

    # drop docs/tv/standup/concert
    df = df[~df.apply(looks_doc_or_tv, axis=1)]
    if args.no_religious:
        df = df[~df.apply(looks_religious, axis=1)]

    # dedupe across buckets (keep best + deepest bucket)
    if "tmdb_id" in df.columns and df["tmdb_id"].notna().any():
        # choose winner by: bucket priority, then score-ish, then vote_count
        sort_cols = ["_bucket_pr"]
        for c in ["score","pred_rating","p_ge4","vote_count"]:
            if c in df.columns:
                sort_cols.append(c)
        asc = [True] + [False]*(len(sort_cols)-1)
        df = df.sort_values(sort_cols, ascending=asc).drop_duplicates("tmdb_id", keep="first")
    else:
        # fallback title/year dedupe
        df = df.sort_values(["_bucket_pr","score","pred_rating","p_ge4"], ascending=[True,False,False,False])
        if {"title","year"} <= set(df.columns):
            df = df.drop_duplicates(["title","year"], keep="first")
        else:
            df = df.drop_duplicates(["title"], keep="first")

    # FINAL RERANK (THIS is the directional change)
    # Transgressive mode: radical/intensity/uniqueness dominate.
    def col(name, default=0.0):
        return pd.to_numeric(df[name], errors="coerce").fillna(default) if name in df.columns else pd.Series([default]*len(df), index=df.index)

    radical     = col("radical")
    intensity   = col("intensity")
    uniqueness  = col("uniqueness")
    sim         = col("sim")
    idf_energy  = col("idf_energy")
    credibility = col("credibility")
    pop_penalty = col("pop_penalty")
    pred_rating = col("pred_rating", 3.5)
    p_ge4       = col("p_ge4")

    if args.mode == "transgressive":
        strict_score = (
            2.2 * radical +
            1.8 * intensity +
            1.4 * uniqueness +
            1.2 * sim +
            0.6 * idf_energy
            - 1.2 * credibility
            - 0.8 * pop_penalty
            + 0.3 * (pred_rating - 3.5)
        )
    else:
        # taste mode: "good + aligned"
        strict_score = (
            1.6 * sim +
            1.2 * (pred_rating - 3.0) +
            1.0 * p_ge4 +
            0.5 * credibility
            - 0.3 * pop_penalty
        )

    df["strict_score"] = strict_score

    # sort output
    df = df.sort_values(["strict_score","pred_rating","p_ge4","vote_count"], ascending=False)

    if args.top and args.top > 0:
        df = df.head(args.top)

    # cleanup
    df = df.drop(columns=[c for c in ["_bucket_pr"] if c in df.columns])

    df.to_csv(args.outfile, index=False)
    print("Wrote:", args.outfile, "rows:", len(df))
    show_cols = [c for c in ["title","year","strict_score","pred_rating","p_ge4","vote_count","bucket","director"] if c in df.columns]
    print(df[show_cols].head(25).to_string(index=False))

if __name__ == "__main__":
    main()
