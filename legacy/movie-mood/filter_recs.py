import json
import argparse
import pandas as pd
from pathlib import Path

DOCISH_KEYWORDS = {
    "documentary","biography","based on true story","based on true events",
    "interview","archive footage","concert film","stand-up comedy","standup",
    "true crime","journalism","sports documentary","music documentary"
}

TVISH_KEYWORDS = {
    "tv movie","television","miniseries","limited series"
}

RELIGIOUS_KEYWORDS = {
    "bible","jesus","christ","gospel","apostle","moses","noah","crucifixion","resurrection",
    "faith","church","christian","religion"
}

def safe_list(x):
    if x is None:
        return []
    if isinstance(x, list):
        return x
    if isinstance(x, str):
        x = x.strip()
        if not x:
            return []
        try:
            v = json.loads(x)
            return v if isinstance(v, list) else []
        except Exception:
            # fallback: treat as comma-ish
            return [t.strip() for t in x.split(",") if t.strip()]
    return []

def has_any(items, needles):
    s = {str(i).lower() for i in items}
    return any(n in s for n in needles)

def filter_df(df, no_docs=True, no_tv=True, strict=False, min_runtime=75, no_religious=False):
    out = df.copy()

    # runtime floor (keeps NaN runtimes)
    if min_runtime and "runtime" in out.columns:
        rt = pd.to_numeric(out["runtime"], errors="coerce")
        out = out[rt.isna() | (rt >= min_runtime)].copy()

    # genre filters
    if "genres" in out.columns:
        gl = out["genres"].apply(safe_list)
        if no_docs:
            out = out[~gl.apply(lambda g: has_any(g, {"documentary"}))].copy()
        if no_tv:
            out = out[~gl.apply(lambda g: has_any(g, {"tv movie"}))].copy()

    # keyword filters
    if "keywords" in out.columns:
        kl = out["keywords"].apply(safe_list)

        if no_docs and strict:
            out = out[~kl.apply(lambda k: has_any(k, DOCISH_KEYWORDS))].copy()

        if no_tv and strict:
            out = out[~kl.apply(lambda k: has_any(k, TVISH_KEYWORDS))].copy()

        if no_religious:
            out = out[~kl.apply(lambda k: has_any(k, RELIGIOUS_KEYWORDS))].copy()

    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--infile", required=True)
    ap.add_argument("--outfile", required=True)

    ap.add_argument("--no_docs", action="store_true")
    ap.add_argument("--no_tv", action="store_true")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--min_runtime", type=int, default=75)
    ap.add_argument("--no_religious", action="store_true")

    args = ap.parse_args()

    df = pd.read_csv(args.infile)
    n0 = len(df)

    out = filter_df(
        df,
        no_docs=args.no_docs,
        no_tv=args.no_tv,
        strict=args.strict,
        min_runtime=args.min_runtime,
        no_religious=args.no_religious,
    )

    Path(args.outfile).parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.outfile, index=False)

    print(f"Filtered {args.infile}: {n0} -> {len(out)}")
    print(f"Wrote: {args.outfile}")

if __name__ == "__main__":
    main()
