import argparse
import json
import re
import pandas as pd

def _norm(x):
    return re.sub(r"\s+", " ", str(x or "")).strip().lower()

def _parse_json_list(x):
    if x is None:
        return []
    if isinstance(x, list):
        return x
    try:
        if pd.isna(x):
            return []
    except Exception:
        pass
    t = str(x).strip()
    if not t:
        return []
    try:
        v = json.loads(t)
        return v if isinstance(v, list) else []
    except Exception:
        return []

def looks_doc_or_tv(row):
    # explicit flags if present
    try:
        if "is_documentary" in row and bool(row["is_documentary"]):
            return True
        if "is_tv_movie" in row and bool(row["is_tv_movie"]):
            return True
    except Exception:
        pass

    genres = [_norm(g) for g in _parse_json_list(row.get("genres"))]
    if "documentary" in genres:
        return True

    txt = " ".join([_norm(row.get("title")), _norm(row.get("why"))])

    doc_signals = [
        "documentary", "behind the scenes", "making of",
        "stand-up", "comedy special", "nightclub comedian", "concert film"
    ]
    tv_signals = ["tv movie", "television film", "made for tv", "made-for-tv", "miniseries"]

    return any(w in txt for w in doc_signals) or any(w in txt for w in tv_signals)

def looks_religious(row):
    txt = " ".join([
        _norm(row.get("title")),
        _norm(row.get("why")),
        " ".join(_parse_json_list(row.get("keywords")))
    ])
    bad = ["bible","jesus","christ","gospel","apostle","disciple","church","christian","faith","miracle","messiah","satan"]
    return any(w in txt for w in bad)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--infile", required=True)
    ap.add_argument("--outfile", required=True)
    ap.add_argument("--no_docs", action="store_true")
    ap.add_argument("--no_tv", action="store_true")
    ap.add_argument("--no_religious", action="store_true")
    ap.add_argument("--min_runtime", type=float, default=0)
    args = ap.parse_args()

    df = pd.read_csv(args.infile)

    # normalize tmdb_id
    if "tmdb_id" in df.columns:
        df["tmdb_id"] = pd.to_numeric(df["tmdb_id"], errors="coerce").astype("Int64")

    # dedupe strongest first
    sort_cols = [c for c in ["p_ge4","pred_rating","score","vote_count"] if c in df.columns]
    if sort_cols:
        df = df.sort_values(sort_cols, ascending=False)

    if "tmdb_id" in df.columns:
        df = df.drop_duplicates("tmdb_id", keep="first")
    elif {"title","year"} <= set(df.columns):
        df = df.drop_duplicates(["title","year"], keep="first")
    else:
        df = df.drop_duplicates("title", keep="first") if "title" in df.columns else df

    # runtime filter (only applies where runtime exists)
    if args.min_runtime and "runtime" in df.columns:
        rt = pd.to_numeric(df["runtime"], errors="coerce")
        df = df[(rt.isna()) | (rt >= args.min_runtime)]

    # docs/tv filters
    if args.no_docs or args.no_tv:
        df = df[~df.apply(looks_doc_or_tv, axis=1)]

    # religious filter
    if args.no_religious:
        df = df[~df.apply(looks_religious, axis=1)]

    # final sort for viewing
    if sort_cols:
        df = df.sort_values(sort_cols, ascending=False)

    df.to_csv(args.outfile, index=False)
    print(f"Wrote: {args.outfile} rows={len(df)}")
    cols = [c for c in ["title","year","director","pred_rating","p_ge4","vote_count"] if c in df.columns]
    if cols:
        print(df[cols].head(20).to_string(index=False))

if __name__ == "__main__":
    main()
