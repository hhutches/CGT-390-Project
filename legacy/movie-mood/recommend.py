# recommend.py
# Deep-cut recommender tuned for:
# (4) aesthetic extremity, (6) obscure-but-credible, (2) transgressive intensity
#
# Inputs:
#   ratings_with_tmdb.csv  (from map_tmdb.py)
# Cache:
#   cache_tmdb/            (auto)
# Outputs:
#   recs_deep_expand.csv, recs_weird_gems.csv, recs_all.csv

import os, time, json, math, argparse
from collections import Counter
from typing import Optional, Callable, List, Tuple

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from sklearn.cluster import KMeans
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.metrics import mean_absolute_error
from sklearn.metrics.pairwise import cosine_similarity


# ----------------------------
# Defaults / knobs
# ----------------------------
RATINGS_IN_DEFAULT = "ratings_with_tmdb.csv"
CACHE_DIR = "cache_tmdb"
os.makedirs(CACHE_DIR, exist_ok=True)

SLEEP_SEC = 0.20

# Candidate generation
TOP_RATED_FOR_PROFILE = 140     # how many of your top-rated to build profile
SEED_COUNT = 36                 # seeds to grow graph candidates
GRAPH_MAX_ADD = 600             # candidates from similar/recs graph
DISCOVER_MAX_ADD = 1600         # candidates from discover
MAX_CANDIDATES_TOTAL = 2400     # hard cap

MIN_VOTE_COUNT_BASE = 25        # avoid ultra-zero-data items in fetch pool
DISCOVER_PAGES_DEFAULT = 2

# Text model
SVD_DIM_DEFAULT = 256
VIBE_MAX_FEATURES = 100_000
ENTITY_MAX_FEATURES = 60_000

# Taste construction
HIGH_RATING_EDGE = 4.5          # edge clusters drawn from >= this rating
EDGE_K_CLUSTERS = 6             # cluster count on high-rated set
EDGE_PICK_CLUSTERS = 2          # auto-pick this many "edge clusters" as focus
ALPHA_VIBE_DEFAULT = 0.88       # blend vibe vs entity in similarity

# Output sizes
N_DEEP_EXPAND_DEFAULT = 45
N_WEIRD_GEMS_DEFAULT = 35

# Diversity caps
MAX_PER_DIRECTOR = 2
MAX_PER_DECADE = 3

# Confidence / calibration
CAL_METHOD = "isotonic"
CAL_CV = 5


# ----------------------------
# Helpers
# ----------------------------
def norm_title(s: str) -> str:
    return "".join(ch.lower() for ch in str(s) if ch.isalnum() or ch.isspace()).strip()

def decade_from_year(y: Optional[int]) -> Optional[int]:
    if y is None:
        return None
    try:
        y = int(y)
        return (y // 10) * 10
    except Exception:
        return None

def z(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=float)
    mu = np.nanmean(x)
    sd = np.nanstd(x) or 1.0
    return (x - mu) / sd

def sigmoid(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=float)
    return 1.0 / (1.0 + np.exp(-x))

def apply_diversity(df: pd.DataFrame, n: int) -> pd.DataFrame:
    picked = []
    dc = Counter()
    dec = Counter()
    for _, row in df.iterrows():
        d = row.get("director") or ""
        de = row.get("decade")
        if d and dc[d] >= MAX_PER_DIRECTOR:
            continue
        if de and dec[de] >= MAX_PER_DECADE:
            continue
        picked.append(row)
        if d: dc[d] += 1
        if de: dec[de] += 1
        if len(picked) >= n:
            break
    return pd.DataFrame(picked) if picked else df.head(0).copy()


# ----------------------------
# TMDB client + caching
# ----------------------------
load_dotenv()
API_KEY = os.getenv("TMDB_API_KEY")
if not API_KEY:
    raise SystemExit("Missing TMDB_API_KEY in .env (TMDB_API_KEY=...)")

session = requests.Session()

def tmdb_get(path: str, params: Optional[dict] = None) -> dict:
    url = f"https://api.themoviedb.org/3{path}"
    params = params or {}
    params["api_key"] = API_KEY
    r = session.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def cache_path(name: str, tmdb_id: int) -> str:
    return os.path.join(CACHE_DIR, f"{name}_{tmdb_id}.json")

def cached_get(name: str, tmdb_id: int, fetch_fn: Callable[[], dict]) -> dict:
    p = cache_path(name, tmdb_id)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    data = fetch_fn()
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    time.sleep(SLEEP_SEC)
    return data

def get_movie_details(tmdb_id: int) -> dict:
    return cached_get("details", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}"))

def get_movie_keywords(tmdb_id: int) -> dict:
    return cached_get("keywords", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}/keywords"))

def get_movie_credits(tmdb_id: int) -> dict:
    return cached_get("credits", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}/credits"))

def get_movie_recommendations(tmdb_id: int, page: int = 1) -> dict:
    return cached_get(f"recs_p{page}", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}/recommendations", {"page": page}))

def get_movie_similar(tmdb_id: int, page: int = 1) -> dict:
    return cached_get(f"similar_p{page}", tmdb_id, lambda: tmdb_get(f"/movie/{tmdb_id}/similar", {"page": page}))

def get_genre_map() -> dict:
    p = os.path.join(CACHE_DIR, "genre_map.json")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    gm = tmdb_get("/genre/movie/list", {})
    genre_map = {g["name"].lower(): int(g["id"]) for g in gm.get("genres", []) if g.get("name") and g.get("id")}
    with open(p, "w", encoding="utf-8") as f:
        json.dump(genre_map, f)
    return genre_map

def director_from_credits(credits_json: dict) -> Optional[str]:
    for p in (credits_json.get("crew") or []):
        if p.get("job") == "Director":
            return p.get("name")
    return None

def top_cast_from_credits(credits_json: dict, k: int = 6) -> List[str]:
    out = []
    for p in (credits_json.get("cast") or [])[:k]:
        nm = p.get("name")
        if nm:
            out.append(nm)
    return out

def build_text_views(details: dict, keywords_json: dict, credits_json: dict) -> Tuple[str, str, List[str], List[str]]:
    title = details.get("title") or ""
    tagline = details.get("tagline") or ""
    overview = details.get("overview") or ""
    keywords = [k.get("name") for k in (keywords_json.get("keywords") or []) if k.get("name")]
    keywords = keywords[:35]
    genres = [g.get("name") for g in (details.get("genres") or []) if g.get("name")]
    director = director_from_credits(credits_json) or ""
    cast = top_cast_from_credits(credits_json, k=6)

    vibe_text = " ".join([tagline, overview, " ".join(genres), " ".join(keywords)]).strip().lower()
    entity_text = " ".join([title, director, " ".join(cast)]).strip().lower()
    return vibe_text, entity_text, keywords, genres

def discover_movies(page=1, params=None) -> dict:
    params = params or {}
    params = {**params, "page": page, "sort_by": "popularity.desc"}
    return tmdb_get("/discover/movie", params=params)


# ----------------------------
# Feature fetch
# ----------------------------
def fetch_feats_for_ids(ids: List[int], label: str) -> pd.DataFrame:
    rows = []
    for j, mid in enumerate(ids, start=1):
        det = get_movie_details(mid)
        kwj = get_movie_keywords(mid)
        cr = get_movie_credits(mid)
        vibe_text, entity_text, keywords, genres = build_text_views(det, kwj, cr)

        year_str = (det.get("release_date") or "")[:4]
        year = int(year_str) if year_str.isdigit() else None

        rows.append({
            "tmdb_id": int(mid),
            "title": det.get("title"),
            "release_date": det.get("release_date"),
            "year": year,
            "decade": decade_from_year(year),
            "runtime": det.get("runtime"),
            "vote_count": det.get("vote_count"),
            "vote_average": det.get("vote_average"),
            "popularity": det.get("popularity"),
            "director": director_from_credits(cr),
            "genres": json.dumps(genres),
            "keywords": json.dumps(keywords),
            "vibe_text": vibe_text,
            "entity_text": entity_text,
        })
        if j % 50 == 0:
            print(f"Fetched {label} feats {j}/{len(ids)}")
    return pd.DataFrame(rows).drop_duplicates("tmdb_id")


# ----------------------------
# Candidate generation
# ----------------------------
def choose_seeds_by_cluster(rated_df: pd.DataFrame, rated_emb: np.ndarray, k: int, seed_count: int) -> List[int]:
    n = len(rated_df)
    if n < 25:
        return rated_df.sort_values(["Rating", "Year"], ascending=[False, False])["tmdb_id"].head(seed_count).tolist()

    k = max(3, min(k, 12, n // 7))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(rated_emb)

    tmp = rated_df.copy()
    tmp["seed_cluster"] = labels
    tmp = tmp.sort_values(["seed_cluster", "Rating", "Year"], ascending=[True, False, False])

    per = int(math.ceil(seed_count / k))
    seeds = []
    for cl in sorted(tmp["seed_cluster"].unique().tolist()):
        seeds.extend(tmp[tmp["seed_cluster"] == cl]["tmdb_id"].tolist()[:per])

    out, seen = [], set()
    for mid in seeds:
        mid = int(mid)
        if mid not in seen:
            out.append(mid); seen.add(mid)
        if len(out) >= seed_count:
            break
    return out[:seed_count]

def build_discover_candidates_from_profile(rated_feats_prof: pd.DataFrame, seen_ids: set, pages: int) -> List[int]:
    genre_map = get_genre_map()
    genre_counter = Counter()
    for gjson in rated_feats_prof["genres"].fillna("[]").tolist():
        try:
            for nm in json.loads(gjson):
                if isinstance(nm, str):
                    genre_counter[nm.lower()] += 1
        except Exception:
            pass
    top_genres = [nm for nm, _ in genre_counter.most_common(8)]
    top_genre_ids = [genre_map[nm] for nm in top_genres if nm in genre_map]

    years = rated_feats_prof["year"].dropna().astype(int).tolist()
    y_min, y_max = (min(years), max(years)) if years else (1970, 2026)
    span = max(8, (y_max - y_min) // 5)
    year_bins = []
    y = y_min
    while y <= y_max:
        year_bins.append((y, min(y_max, y + span)))
        y += span

    cand = set()
    print(f"[discover] genres={top_genres[:8]} | bins={year_bins} | pages={pages}")

    def add_from(params):
        nonlocal cand
        for (a, b) in year_bins:
            for p in range(1, pages + 1):
                data = discover_movies(page=p, params={
                    **params,
                    "primary_release_date.gte": f"{a}-01-01",
                    "primary_release_date.lte": f"{b}-12-31",
                    "vote_count.gte": MIN_VOTE_COUNT_BASE,
                })
                for m in (data.get("results") or []):
                    mid = m.get("id")
                    if mid and int(mid) not in seen_ids:
                        cand.add(int(mid))
                if len(cand) >= DISCOVER_MAX_ADD:
                    return

    if top_genre_ids:
        for gid in top_genre_ids:
            add_from({"with_genres": gid})
            if len(cand) >= DISCOVER_MAX_ADD:
                break
    else:
        add_from({})

    return list(cand)

def add_graph_candidates(seed_ids: List[int], seen_ids: set) -> List[int]:
    cand = set()
    for i, sid in enumerate(seed_ids, start=1):
        recs = get_movie_recommendations(sid, page=1).get("results", []) or []
        sim = get_movie_similar(sid, page=1).get("results", []) or []
        for m in (recs + sim):
            mid = m.get("id")
            if not mid:
                continue
            mid = int(mid)
            if mid in seen_ids:
                continue
            if (m.get("vote_count") or 0) < MIN_VOTE_COUNT_BASE:
                continue
            cand.add(mid)
            if len(cand) >= GRAPH_MAX_ADD:
                return list(cand)
        if i % 6 == 0:
            print(f"[graph] seeds {i}/{len(seed_ids)} -> {len(cand)}")
    return list(cand)


# ----------------------------
# New scoring: extremity + credibility + transgressive edge
# ----------------------------
def credibility_prior(vote_avg: np.ndarray, vote_cnt: np.ndarray) -> np.ndarray:
    """
    Generalizable "obscure but credible":
    - rewards decent vote_average
    - rewards having some vote_count (avoids random zero-data)
    - does NOT reward huge popularity; just needs enough signal
    """
    va = np.nan_to_num(vote_avg, nan=0.0)
    vc = np.nan_to_num(vote_cnt, nan=0.0)

    # quality gate around ~6.6
    q = sigmoid((va - 6.6) / 0.55)

    # "has evidence" gate: ramps up from ~30 votes to ~300 votes then saturates
    lv = np.log1p(np.maximum(vc, 1.0))
    evidence = sigmoid((lv - np.log1p(35)) / 0.9)

    return q * evidence

def aesthetic_intensity(E: np.ndarray, mean_vec: np.ndarray) -> np.ndarray:
    """
    Distance from semantic center in embedding space:
    stylistic distinctiveness / aesthetic intensity proxy.
    """
    D = E - mean_vec.reshape(1, -1)
    return np.linalg.norm(D, axis=1)

def parse_json_list(s) -> List[str]:
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return []
    if isinstance(s, list):
        return [str(x).lower() for x in s]
    try:
        xs = json.loads(s)
        if isinstance(xs, list):
            return [str(x).lower() for x in xs]
    except Exception:
        pass
    return []

def build_keyword_idf(all_kw_lists: List[List[str]]) -> dict:
    df = Counter()
    N = len(all_kw_lists)
    for kws in all_kw_lists:
        for k in set(kws):
            df[k] += 1
    return {k: math.log((N + 1) / (1 + d)) for k, d in df.items()}

def specificity_score(candidate_kws: List[str], high_kw_sets: List[set], idf: dict) -> float:
    ck = set(candidate_kws)
    if not ck:
        return 0.0
    best = 0.0
    for hk in high_kw_sets:
        inter = ck & hk
        if not inter:
            continue
        s = sum(idf.get(k, 0.0) for k in inter)
        if s > best:
            best = s
    return best

def auto_pick_edge_clusters(high_df: pd.DataFrame, high_emb: np.ndarray) -> Tuple[np.ndarray, List[int], pd.DataFrame]:
    """
    Cluster your >=4.5 movies, then pick clusters that maximize:
      aesthetic intensity + credibility + "edge" (not center)
    """
    n = len(high_df)
    k = min(EDGE_K_CLUSTERS, max(3, n // 10))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(high_emb)

    tmp = high_df.copy()
    tmp["edge_cluster"] = labels

    # cluster centroids and stats
    mean_vec = high_emb.mean(axis=0)
    cent = np.vstack([high_emb[labels == c].mean(axis=0) for c in range(k)])
    cent_sim_to_mean = (cent @ mean_vec.reshape(-1, 1)).ravel()  # higher => more generic/center
    cent_edge = 1.0 - cent_sim_to_mean

    # credibility: prefer clusters where your anchors have credible titles (vote_avg, vote_count)
    va = tmp["vote_average"].fillna(0).astype(float).values
    vc = tmp["vote_count"].fillna(0).astype(float).values
    cred = credibility_prior(va, vc)

    tmp["cred"] = cred

    rows = []
    for c in range(k):
        idx = (labels == c)
        if idx.sum() == 0:
            continue
        sub = tmp[idx]
        # aesthetic intensity of items in that cluster relative to cluster mean
        subE = high_emb[idx]
        sub_mean = subE.mean(axis=0)
        intens = np.linalg.norm(subE - sub_mean.reshape(1, -1), axis=1).mean()
        rows.append({
            "cluster": c,
            "n": int(idx.sum()),
            "mean_rating": float(sub["Rating"].mean()),
            "mean_cred": float(sub["cred"].mean()),
            "mean_vote_avg": float(sub["vote_average"].fillna(0).astype(float).mean()),
            "mean_log_votes": float(np.log1p(sub["vote_count"].fillna(0).astype(float)).mean()),
            "cent_edge": float(cent_edge[c]),
            "within_intensity": float(intens),
        })

    stats = pd.DataFrame(rows)
    if stats.empty:
        return labels, [0], tmp

    # edge score: maximize distinct + credible + high-rated, avoid too-center
    score = (
        0.45 * z(stats["cent_edge"].values) +
        0.25 * z(stats["within_intensity"].values) +
        0.20 * z(stats["mean_cred"].values) +
        0.10 * z(stats["mean_rating"].values)
    )
    stats["edge_score"] = score
    stats = stats.sort_values("edge_score", ascending=False)

    picked = stats["cluster"].head(EDGE_PICK_CLUSTERS).tolist()
    return labels, picked, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ratings", type=str, default=RATINGS_IN_DEFAULT)
    ap.add_argument("--alpha_vibe", type=float, default=ALPHA_VIBE_DEFAULT)
    ap.add_argument("--svd_dim", type=int, default=SVD_DIM_DEFAULT)
    ap.add_argument("--discover_pages", type=int, default=DISCOVER_PAGES_DEFAULT)
    ap.add_argument("--n_deep_expand", type=int, default=N_DEEP_EXPAND_DEFAULT)
    ap.add_argument("--n_weird_gems", type=int, default=N_WEIRD_GEMS_DEFAULT)
    ap.add_argument("--focus_clusters", type=str, default="", help="Optional override like '2,3' on the auto edge clusters.")
    args = ap.parse_args()

    print("== Deep-Cut Recommender v2 (aesthetic + credible + transgressive) ==")

    ratings = pd.read_csv(args.ratings)

    if "tmdb_id" not in ratings.columns:
        raise SystemExit("ratings_with_tmdb.csv must include tmdb_id (run map_tmdb.py first).")

    ratings = ratings[ratings["tmdb_id"].notna()].copy()
    ratings["tmdb_id"] = ratings["tmdb_id"].astype(int)

    seen_ids = set(ratings["tmdb_id"].tolist())
    seen_titles = set(norm_title(x) for x in ratings["Name"].astype(str).tolist())

    ratings_sorted = ratings.sort_values(["Rating", "Year"], ascending=[False, False])
    prof = ratings_sorted.head(min(TOP_RATED_FOR_PROFILE, len(ratings_sorted))).copy()
    print(f"Loaded {len(ratings)} rated | profile uses top {len(prof)}")

    # Fetch rated feats
    rated_feats_all = fetch_feats_for_ids(ratings["tmdb_id"].tolist(), "rated")
    rated_all = ratings.merge(rated_feats_all, on="tmdb_id", how="inner")

    # Build text models
    vibe_vec = TfidfVectorizer(
        stop_words="english",
        sublinear_tf=True,
        min_df=2,
        max_df=0.90,
        ngram_range=(1, 2),
        max_features=VIBE_MAX_FEATURES,
    )
    Xv_r = vibe_vec.fit_transform(rated_all["vibe_text"].fillna(""))
    svd_dim = int(max(64, min(args.svd_dim, Xv_r.shape[1] - 1))) if Xv_r.shape[1] > 1 else 1
    svd = TruncatedSVD(n_components=svd_dim, random_state=42)
    Ev_r = normalize(svd.fit_transform(Xv_r))

    ent_vec = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        sublinear_tf=True,
        min_df=2,
        max_df=0.95,
        max_features=ENTITY_MAX_FEATURES,
    )
    Xe_r = ent_vec.fit_transform(rated_all["entity_text"].fillna(""))

    # Seed selection (clustered across your profile taste space)
    prof_mask = rated_all["tmdb_id"].isin(prof["tmdb_id"]).values
    seeds = choose_seeds_by_cluster(rated_all[prof_mask].copy(), Ev_r[prof_mask], k=10, seed_count=SEED_COUNT)
    print(f"[seeds] {len(seeds)}")

    # Candidate pool: discover + graph
    rated_feats_prof = rated_feats_all[rated_feats_all["tmdb_id"].isin(prof["tmdb_id"])].copy()
    discover_ids = build_discover_candidates_from_profile(rated_feats_prof, seen_ids=seen_ids, pages=args.discover_pages)
    graph_ids = add_graph_candidates(seeds, seen_ids=seen_ids)

    candidate_ids = list(dict.fromkeys(discover_ids + graph_ids))[:MAX_CANDIDATES_TOTAL]
    print(f"[candidates] discover={len(discover_ids)} graph={len(graph_ids)} total={len(candidate_ids)}")

    # Fetch candidate feats
    cand_feats = fetch_feats_for_ids(candidate_ids, "cand")

    # Remove already-seen (id + normalized title)
    cand_feats = cand_feats[~cand_feats["tmdb_id"].isin(seen_ids)].copy()
    cand_feats = cand_feats[~cand_feats["title"].fillna("").map(norm_title).isin(seen_titles)].copy()

    # Drop unusable text
    cand_feats = cand_feats[cand_feats["vibe_text"].fillna("").str.len() >= 20].copy()

    # Light de-blockbuster: don't hard-ban, just avoid the very top popularity/vote_count
    vc = cand_feats["vote_count"].fillna(0).astype(float).values
    q_hi = np.quantile(vc, 0.80)  # keep 80% least-voted from pool for deeper cuts
    cand_feats = cand_feats[cand_feats["vote_count"].fillna(0).astype(float) <= q_hi].copy()
    print(f"[pool] vote_count cutoff q80={q_hi:.0f} -> {len(cand_feats)} candidates")

    # Embed candidates
    Xv_c = vibe_vec.transform(cand_feats["vibe_text"].fillna(""))
    Ev_c = normalize(svd.transform(Xv_c))
    Xe_c = ent_vec.transform(cand_feats["entity_text"].fillna(""))

    # Rating prediction (regression)
    mu = rated_all["Rating"].mean()
    sd = rated_all["Rating"].std(ddof=0) or 1.0
    y = (rated_all["Rating"].values - mu) / sd

    ridge = Ridge(alpha=2.0)
    ridge.fit(Ev_r, y)
    yhat_c = ridge.predict(Ev_c)
    pred_rating = mu + sd * yhat_c

    # p(>=4.0) with calibration
    liked = (rated_all["Rating"] >= 4.0).astype(int).values
    base_clf = LogisticRegression(max_iter=4000, class_weight="balanced")
    clf = CalibratedClassifierCV(base_clf, method=CAL_METHOD, cv=CAL_CV)
    clf.fit(Ev_r, liked)
    p_ge4 = clf.predict_proba(Ev_c)[:, 1]

    # Uncertainty band via OOF residual quantile
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    oof_yhat = cross_val_predict(Ridge(alpha=2.0), Ev_r, y, cv=kf)
    oof_rhat = mu + sd * oof_yhat
    abs_err = np.abs(rated_all["Rating"].values - oof_rhat)
    q = np.quantile(abs_err, 0.90)
    lo80 = np.clip(pred_rating - q, 0.5, 5.0)
    hi80 = np.clip(pred_rating + q, 0.5, 5.0)
    print(f"[confidence] OOF MAE≈{mean_absolute_error(rated_all['Rating'].values, oof_rhat):.3f} | half-width≈{q:.3f}")

    # Similarity: general taste vector (weighted by your high ratings)
    y_pos = np.clip(y, 0, None) + 0.08
    taste_v = normalize((Ev_r * y_pos[:, None]).sum(axis=0, keepdims=True))

    w2 = y_pos / (y_pos.sum() + 1e-9)
    taste_e = (Xe_r.multiply(w2[:, None])).sum(axis=0)
    taste_e = np.asarray(taste_e).ravel()
    taste_e = taste_e / (np.linalg.norm(taste_e) + 1e-9)

    vibe_sim = (Ev_c @ taste_v.T).ravel()
    ent_sim = cosine_similarity(Xe_c, taste_e.reshape(1, -1)).ravel()
    alpha = float(np.clip(args.alpha_vibe, 0.0, 1.0))
    sim = alpha * vibe_sim + (1 - alpha) * ent_sim
    novelty = 1.0 - sim

    # Aesthetic intensity for candidates (distance from your rated mean embedding)
    rated_mean = Ev_r.mean(axis=0)
    intensity = aesthetic_intensity(Ev_c, rated_mean)

    # Credibility prior
    cred = credibility_prior(
        cand_feats["vote_average"].fillna(0).astype(float).values,
        cand_feats["vote_count"].fillna(0).astype(float).values,
    )

    # Specificity: overlap of rare keywords with your top likes (helps "aesthetic signature")
    rated_all["kw_list"] = rated_all["keywords"].apply(parse_json_list)
    cand_feats["kw_list"] = cand_feats["keywords"].apply(parse_json_list)

    anchors = rated_all[rated_all["Rating"] >= HIGH_RATING_EDGE].copy()
    if len(anchors) < 20:
        anchors = rated_all[rated_all["Rating"] >= 4.0].copy()

    high_kw_sets = [set(kws) for kws in anchors["kw_list"].tolist()]
    all_kw_lists = cand_feats["kw_list"].tolist() + anchors["kw_list"].tolist()
    idf = build_keyword_idf(all_kw_lists)
    spec_raw = np.array([specificity_score(kws, high_kw_sets, idf) for kws in cand_feats["kw_list"].tolist()], dtype=float)

    # Build "edge taste" vector from auto-picked high-rated clusters
    high = rated_all[rated_all["Rating"] >= HIGH_RATING_EDGE].copy()
    if len(high) < 18:
        high = rated_all[rated_all["Rating"] >= 4.0].copy()
    high_idx = high.index.values

    # Map high rows into embedding
    # Need embedding rows aligned to rated_all row order:
    high_emb = Ev_r[high_idx]

    labels, picked, stats = auto_pick_edge_clusters(high, high_emb)
    high["edge_cluster"] = labels

    # Optional override from CLI
    if args.focus_clusters.strip():
        try:
            picked = [int(x.strip()) for x in args.focus_clusters.split(",") if x.strip() != ""]
        except Exception:
            raise SystemExit("--focus_clusters must look like '2,3'")

    print(f"[edge] auto-picked focus clusters: {picked}")
    if not stats.empty:
        print("[edge] cluster stats (top):")
        print(stats.head(8).to_string(index=False))

    focus_rows = high[high["edge_cluster"].isin(picked)].copy()
    if len(focus_rows) < 6:
        focus_rows = high.copy()

    focus_idx = focus_rows.index.values
    focus_emb = Ev_r[focus_idx]

    # Focus taste vector: strongly weight by rating z+ then normalize
    y_focus = ((focus_rows["Rating"].values - mu) / sd)
    y_focus = np.clip(y_focus, 0, None) + 0.10
    focus_taste_v = normalize((focus_emb * y_focus[:, None]).sum(axis=0, keepdims=True))

    focus_vibe_sim = (Ev_c @ focus_taste_v.T).ravel()

    # Edge/transgressive proxy: candidates near focus cluster, and also stylistically intense
    # (This is the non-hacky way to "Korine/Noé adjacency")
    transgressive = 0.70 * focus_vibe_sim + 0.30 * z(intensity)

    # Score construction tuned to your priorities:
    # - credible high art (cred)
    # - aesthetic intensity
    # - transgressive cluster adjacency
    # - still wants you to like it (pred + p_ge4)
    safe_z = z(pred_rating)
    sim_z  = z(sim)
    nov_z  = z(novelty)
    cred_z = z(cred)
    inten_z = z(intensity)
    trans_z = z(transgressive)
    spec_z = z(spec_raw)

    # Main score (deep_expand): aesthetic extreme + credible + transgressive, but still "you'll like it"
    score_expand = (
        0.30 * safe_z +
        0.10 * sim_z +
        0.25 * trans_z +
        0.15 * inten_z +
        0.15 * cred_z +
        0.05 * spec_z
    )

    # Weird gems: push further into extremity & specificity, but keep credibility gates
    score_weird = (
        0.18 * safe_z +
        0.05 * sim_z +
        0.30 * trans_z +
        0.20 * inten_z +
        0.17 * spec_z +
        0.10 * cred_z
    )

    out = cand_feats.copy()
    out["sim"] = sim
    out["vibe_sim"] = vibe_sim
    out["entity_sim"] = ent_sim
    out["focus_vibe_sim"] = focus_vibe_sim
    out["novelty"] = novelty
    out["intensity"] = intensity
    out["credibility"] = cred
    out["specificity"] = spec_raw
    out["p_ge4"] = p_ge4
    out["pred_rating"] = pred_rating
    out["lo80"] = lo80
    out["hi80"] = hi80
    out["score_expand"] = score_expand
    out["score_weird"] = score_weird
    out["decade"] = out["decade"]

    # Gates:
    # Expand: credible + likely-ish + not super mainstream
    deep_expand = out.sort_values(["score_expand"], ascending=False)
    deep_expand = deep_expand[(deep_expand["credibility"] >= 0.35) & (deep_expand["pred_rating"] >= 3.4)]
    deep_expand = deep_expand[deep_expand["p_ge4"] >= 0.45]

    # Weird gems: allow lower p_ge4 but keep credibility and intensity
    weird = out.sort_values(["score_weird"], ascending=False)
    weird = weird[(weird["credibility"] >= 0.30) & (weird["pred_rating"] >= 3.1)]
    weird = weird[weird["intensity"] >= np.quantile(out["intensity"], 0.55)]

    deep_expand = apply_diversity(deep_expand, args.n_deep_expand)
    weird = apply_diversity(weird, args.n_weird_gems)

    def why_row(row) -> str:
        return (
            f"p(>=4★)={row['p_ge4']:.0%} | pred={row['pred_rating']:.1f}★ | 80%={row['lo80']:.1f}-{row['hi80']:.1f}★"
            f" | focus_sim={row['focus_vibe_sim']:.2f} | intensity={row['intensity']:.2f}"
            f" | cred={row['credibility']:.2f} | spec={row['specificity']:.2f}"
        )

    cols = [
        "bucket",
        "score",
        "pred_rating",
        "p_ge4",
        "lo80",
        "hi80",
        "sim",
        "focus_vibe_sim",
        "intensity",
        "credibility",
        "specificity",
        "novelty",
        "title",
        "release_date",
        "year",
        "director",
        "vote_average",
        "vote_count",
        "tmdb_id",
        "why",
    ]

    def finalize(df: pd.DataFrame, bucket: str, score_col: str) -> pd.DataFrame:
        if df.empty:
            return pd.DataFrame(columns=cols)
        df = df.copy()
        df["bucket"] = bucket
        df["score"] = df[score_col]
        df["why"] = df.apply(why_row, axis=1)
        return df[cols]

    a = finalize(deep_expand, "deep_expand", "score_expand")
    b = finalize(weird, "weird_gems", "score_weird")

    a.to_csv("recs_deep_expand.csv", index=False)
    b.to_csv("recs_weird_gems.csv", index=False)

    # Interleave (expand-heavy, with weird spice)
    combined = []
    i = j = 0
    while i < len(a) or j < len(b):
        for _ in range(3):
            if i < len(a):
                combined.append(a.iloc[i]); i += 1
        for _ in range(2):
            if j < len(b):
                combined.append(b.iloc[j]); j += 1
        if len(combined) >= (len(a) + len(b)):
            break

    recs_all = pd.DataFrame(combined, columns=cols)
    recs_all.to_csv("recs_all.csv", index=False)

    print("== Done ==")
    print("Wrote: recs_deep_expand.csv, recs_weird_gems.csv, recs_all.csv")
    if len(recs_all):
        print(recs_all.head(14)[["bucket","title","pred_rating","p_ge4","vote_average","vote_count","focus_vibe_sim","intensity","credibility","specificity","sim","novelty"]])


if __name__ == "__main__":
    main()