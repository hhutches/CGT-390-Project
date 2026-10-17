import argparse
import json
import re
import sys
import pandas as pd

def die(msg: str, code: int = 1):
    print(msg, file=sys.stderr)
    raise SystemExit(code)

def _txt(row) -> str:
    parts = []
    for c in ["title","director","why","genres","keywords"]:
        if c in row and pd.notna(row[c]):
            parts.append(str(row[c]))
    return (" ".join(parts)).lower()

def _has_any(txt: str, needles) -> bool:
    return any(n in txt for n in needles)

def parse_listish(x):
    # handles json strings like '["Drama"]' or already-list
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return []
    if isinstance(x, list):
        return x
    s = str(x).strip()
    if not s:
        return []
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else []
    except Exception:
        # fallback: split on commas
        return [t.strip() for t in re.split(r"[;,]", s) if t.strip()]

def is_kids_family(row) -> bool:
    txt = _txt(row)
    genres = [g.lower() for g in parse_listish(row.get("genres"))]
    keywords = [k.lower() for k in parse_listish(row.get("keywords"))]

    # hard genre gate
    if any(g in {"family", "animation"} for g in genres):
        return True

    # hard keyword/title signals
    bad = [
        "scooby", "disney", "pixar", "dreamworks", "barbie",
        "christmas special", "holiday special",
        "winnie", "mickey", "donald duck", "goofy",
        "kids", "kid-friendly", "family-friendly",
        "cartoon", "animated feature",
    ]
    if _has_any(txt, bad):
        return True

    # if keywords explicitly say family/kids
    if any(k in {"family", "kids", "children"} for k in keywords):
        return True

    return False

def looks_doc_or_tv(row) -> bool:
    txt = _txt(row)
    doc_signals = [
        "documentary", "doc", "behind the scenes", "making of",
        "stand-up", "comedy special", "concert film"
    ]
    tv_signals = ["tv movie", "television film", "made for tv", "made-for-tv", "miniseries"]
    return _has_any(txt, doc_signals) or _has_any(txt, tv_signals)

def looks_religious(row) -> bool:
    txt = _txt(row)
    # keep this pretty strict; tune later if needed
    rel = ["jesus","christ","bible","biblical","church","pastor","priest","saint","nun","vatican","islam","muslim","quran","hindu","krishna","buddha","buddhist","faith","religion","religious"]
    return _has_any(txt, rel)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--infile", required=True)
    ap.add_argument("--outfile", required=True)

    # base quality gates
    ap.add_argument("--min_vote_count", type=int, default=120)
    ap.add_argument("--min_pred", type=float, default=3.85)

    # transgressive gates (THIS is the big change)
    ap.add_argument("--min_intensity", type=float, default=0.92)
    ap.add_argument("--min_radical", type=float, default=0.90)
    ap.add_argument("--min_sim", type=float, default=0.12)

    # optional taste gates
    ap.add_argument("--min_year", type=int, default=1965)
    ap.add_argument("--max_year", type=int, default=2026)

    ap.add_argument("--no_docs", action="store_true", default=True)
    ap.add_argument("--no_tv", action="store_true", default=True)
    ap.add_argument("--no_religious", action="store_true", default=True)
    ap.add_argument("--no_kids_family", action="store_true", default=True)

    args = ap.parse_args()

    df = pd.read_csv(args.infile)
    if df.empty:
        die(f"{args.infile} is empty")

    # ensure numerics
    for c in ["pred_rating","p_ge4","vote_count","year","intensity","radical","sim","score","tmdb_id"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # 1) dedupe hard by tmdb_id first (you have tons of duplicates)
    if "tmdb_id" in df.columns:
        df = df.sort_values(["score","pred_rating","p_ge4","vote_count"], ascending=False)
        df = df.drop_duplicates("tmdb_id", keep="first")
    else:
        df = df.sort_values(["score","pred_rating","p_ge4","vote_count"], ascending=False)
        df = df.drop_duplicates(["title","year"], keep="first")

    # 2) base gates
    if "vote_count" in df.columns:
        df = df[df["vote_count"].fillna(0) >= args.min_vote_count]
    if "pred_rating" in df.columns:
        df = df[df["pred_rating"].fillna(0) >= args.min_pred]
    if "year" in df.columns:
        df = df[(df["year"].fillna(0) >= args.min_year) & (df["year"].fillna(0) <= args.max_year)]

    # 3) transgressive gates
    # (if any column missing, fail loudly — you WANT to know)
    for need in ["intensity","radical","sim"]:
        if need not in df.columns:
            die(f"Missing required column for transgressive postprocess: {need}")

    df = df[df["intensity"] >= args.min_intensity]
    df = df[df["radical"] >= args.min_radical]
    df = df[df["sim"] >= args.min_sim]

    # 4) content filters
    if args.no_docs or args.no_tv:
        df = df[~df.apply(looks_doc_or_tv, axis=1)]
    if args.no_religious:
        df = df[~df.apply(looks_religious, axis=1)]
    if args.no_kids_family:
        df = df[~df.apply(is_kids_family, axis=1)]

    # 5) final ordering: enforce transgressive first, then confidence
    df = df.sort_values(
        ["radical","intensity","sim","p_ge4","pred_rating","vote_count"],
        ascending=False
    )

    # helpful output cols
    df["strict_score"] = (
        4.0*df["radical"].fillna(0)
        + 3.0*df["intensity"].fillna(0)
        + 2.0*df["sim"].fillna(0)
        + 0.5*df["p_ge4"].fillna(0)
        + 0.01*df["vote_count"].fillna(0).clip(0, 2000)
    )

    # write
    df.to_csv(args.outfile, index=False)

    show_cols = [c for c in ["title","year","strict_score","sim","intensity","radical","pred_rating","p_ge4","vote_count","bucket","director"] if c in df.columns]
    print("FINAL:", args.outfile)
    print("rows:", len(df))
    print(df[show_cols].head(40).to_string(index=False))

if __name__ == "__main__":
    main()
