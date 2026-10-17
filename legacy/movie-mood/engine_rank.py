import os
# engine_rank.py
import numpy as np
import json
import pandas as pd
from typing import List, Tuple, Optional

def _genre_ids(x):
    """Parse TMDB genres field which may be list, JSON-string, or empty."""
    if x is None:
        return []
    if isinstance(x, list):
        return [int(g) for g in x if str(g).isdigit()]
    try:
        obj = json.loads(x) if isinstance(x, str) and x.strip() else []
        if isinstance(obj, list):
            # list can be ["Drama"] or [{"id": 99, "name": "Documentary"}] or [99,...]
            out = []
            for g in obj:
                if isinstance(g, dict) and "id" in g:
                    out.append(int(g["id"]))
                elif isinstance(g, (int, float)) and int(g) == g:
                    out.append(int(g))

                # --- Soft de-bias away from documentaries / TV movies (general, metadata-based) ---
                # TMDB genre ids: 99=Documentary, 10770=TV Movie
                # Keep it soft so great docs can still appear, but they won't dominate.
                doc_penalty = float(os.getenv("DOC_PENALTY", "0.35"))
                tv_penalty  = float(os.getenv("TV_PENALTY",  "0.55"))

                if "genres" in out.columns:
                    gids = out["genres"].apply(_genre_ids)
                    is_doc = gids.apply(lambda g: 99 in g)
                    is_tv  = gids.apply(lambda g: 10770 in g)

                    # multiplicative penalty
                    mult = 1.0
                    mult = mult * (1.0 - doc_penalty) if doc_penalty > 0 else mult
                    out.loc[is_doc, "score"] = out.loc[is_doc, "score"] * (1.0 - doc_penalty)

                    out.loc[is_tv, "score"]  = out.loc[is_tv,  "score"] * (1.0 - tv_penalty)

                    # for debugging / transparency
                    out["is_doc"] = is_doc.astype(int)
                    out["is_tv_movie"] = is_tv.astype(int)

            return out
    except Exception:
        pass
    return []


from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.metrics import mean_absolute_error
from sklearn.cluster import KMeans

from engine_repr import (
    ReprModel, z, credibility_prior, parse_json_list, build_keyword_idf,
    specificity_score, cosine_to_vec, aesthetic_intensity, candidate_centrality
)


def build_focus_from_anchors(rated: pd.DataFrame, anchors: List[str]) -> pd.DataFrame:
    if not anchors:
        return rated[rated["Rating"] >= 4.5].copy()

    titles = rated["Name"].fillna("").astype(str).str.lower()
    m = np.zeros(len(rated), dtype=bool)
    for a in anchors:
        a = a.strip().lower()
        if not a:
            continue
        m |= titles.str.contains(a, na=False)

    focus = rated[m].copy()
    if len(focus) < 6:
        focus = rated[rated["Rating"] >= 4.5].copy()
    return focus


def fit_predictors(Ev_r: np.ndarray, rated: pd.DataFrame) -> Tuple[Tuple[float, float], float, float]:
    mu = float(rated["Rating"].mean())
    sd = float(rated["Rating"].std(ddof=0) or 1.0)
    y = (rated["Rating"].values - mu) / sd

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    oof_yhat = cross_val_predict(Ridge(alpha=2.0), Ev_r, y, cv=kf)
    oof_rhat = mu + sd * oof_yhat

    abs_err = np.abs(rated["Rating"].values - oof_rhat)
    half_q = float(np.quantile(abs_err, 0.90))
    mae = float(mean_absolute_error(rated["Rating"].values, oof_rhat))
    return (mu, sd), half_q, mae


def predict_all(Ev_r: np.ndarray, Ev_c: np.ndarray, rated: pd.DataFrame, mu: float, sd: float):
    y = (rated["Rating"].values - mu) / sd

    ridge = Ridge(alpha=2.0)
    ridge.fit(Ev_r, y)
    pred_rating = mu + sd * ridge.predict(Ev_c)

    liked = (rated["Rating"] >= 4.0).astype(int).values
    base = LogisticRegression(max_iter=4000, class_weight="balanced")
    clf = CalibratedClassifierCV(base, method="isotonic", cv=5)
    clf.fit(Ev_r, liked)
    p_ge4 = clf.predict_proba(Ev_c)[:, 1]
    return pred_rating, p_ge4


def rank_transgressive(
    rated: pd.DataFrame,
    cand: pd.DataFrame,
    pool_q: float = 0.55,
    alpha_vibe: float = 0.92,
    anchors: Optional[List[str]] = None,
    n_expand: int = 45,
    n_weird: int = 35
):
    # 0) prune by vote_count quantile to reduce mainstream gravity
    vc = cand["vote_count"].fillna(0).astype(float).values
    q_hi = float(np.quantile(vc, pool_q))
    cand = cand[cand["vote_count"].fillna(0).astype(float) <= q_hi].copy()
    print(f"[pool] vote_count cutoff q{int(pool_q*100)}={q_hi:.0f} -> {len(cand)} candidates")

    # 1) representation
    rm = ReprModel(svd_dim=256)
    Ev_r, Xe_r = rm.fit(rated)
    Ev_c, Xe_c = rm.transform(cand)

    # 2) confidence calibration
    (mu, sd), half_q, mae = fit_predictors(Ev_r, rated)
    pred_rating, p_ge4 = predict_all(Ev_r, Ev_c, rated, mu, sd)
    lo80 = np.clip(pred_rating - half_q, 0.5, 5.0)
    hi80 = np.clip(pred_rating + half_q, 0.5, 5.0)
    print(f"[confidence] OOF MAE≈{mae:.3f} | half-width≈{half_q:.3f}")

    # 3) base taste vector from positive z-scored ratings
    y = (rated["Rating"].values - mu) / sd
    y_pos = np.clip(y, 0, None) + 0.08

    taste_v = (Ev_r * y_pos[:, None]).sum(axis=0, keepdims=True)
    taste_v = taste_v / (np.linalg.norm(taste_v) + 1e-9)

    w2 = y_pos / (y_pos.sum() + 1e-9)
    taste_e = (Xe_r.multiply(w2[:, None])).sum(axis=0)
    taste_e = np.asarray(taste_e).ravel()
    taste_e = taste_e / (np.linalg.norm(taste_e) + 1e-9)

    vibe_sim = (Ev_c @ taste_v.T).ravel()
    entity_sim = cosine_to_vec(Xe_c, taste_e)
    sim = alpha_vibe * vibe_sim + (1 - alpha_vibe) * entity_sim
    novelty = 1.0 - sim

    # 4) focus vector from anchors (or 4.5+)
    focus = build_focus_from_anchors(rated, anchors or [])
    focus_mask = rated.index.isin(focus.index)
    Ev_f = Ev_r[focus_mask]
    y_f = ((focus["Rating"].values - mu) / sd)
    y_f = np.clip(y_f, 0, None) + 0.10
    focus_v = (Ev_f * y_f[:, None]).sum(axis=0, keepdims=True)
    focus_v = focus_v / (np.linalg.norm(focus_v) + 1e-9)
    focus_vibe_sim = (Ev_c @ focus_v.T).ravel()

    # 5) intensity + radicality
    rated_mean = Ev_r.mean(axis=0)
    intensity = aesthetic_intensity(Ev_c, rated_mean)

    k = min(10, max(4, len(rated) // 25))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    lab = km.fit_predict(Ev_r)
    cents = np.vstack([Ev_r[lab == c].mean(axis=0) for c in range(k)])
    sim_to_cents = Ev_c @ cents.T
    radical = 1.0 - np.max(sim_to_cents, axis=1)

    centrality = candidate_centrality(Ev_c, k=20)
    generic_penalty = z(centrality)

    # 6) credibility
    cred = credibility_prior(
        cand["vote_average"].fillna(0).astype(float).values,
        cand["vote_count"].fillna(0).astype(float).values,
    )

    # 7) keyword specificity overlap (small weight later)
    rated_kw = rated["keywords"].apply(parse_json_list)
    cand_kw = cand["keywords"].apply(parse_json_list)
    anchor_kw_sets = [set(kws) for kws in rated_kw[rated["Rating"] >= 4.5].tolist()]
    all_kw_lists = cand_kw.tolist() + rated_kw.tolist()
    idf_kw = build_keyword_idf(all_kw_lists)
    spec = np.array([specificity_score(kws, anchor_kw_sets, idf_kw) for kws in cand_kw.tolist()], dtype=float)

    # 8) ---------- UNIQUENESS PRIOR (general, no hand-coded keywords) ----------
    # Use vibe TF-IDF (pre-SVD) to compute "rare DNA" and "peaky description" signals
    Xv_c = rm.vibe_vec.transform(cand["vibe_text"].fillna("").astype(str))
    idf = rm.vibe_vec.idf_

    nnz = Xv_c.getnnz(axis=1).astype(float)
    nnz_frac = nnz / max(1, Xv_c.shape[1])

    Xv_c_coo = Xv_c.tocoo()
    num = np.zeros(Xv_c.shape[0], dtype=float)
    den = np.zeros(Xv_c.shape[0], dtype=float)
    num += np.bincount(Xv_c_coo.row, weights=Xv_c_coo.data * idf[Xv_c_coo.col], minlength=Xv_c.shape[0])
    den += np.bincount(Xv_c_coo.row, weights=Xv_c_coo.data, minlength=Xv_c.shape[0])
    idf_energy = num / (den + 1e-9)

    uniqueness = z(idf_energy) + 0.8 * z(1.0 - nnz_frac)

    # Soft popularity gravity penalty
    pop = np.log1p(cand["vote_count"].fillna(0).astype(float).values)
    pop_penalty = z(pop)

    # 9) composite signals
    transgressive = 0.78 * focus_vibe_sim + 0.22 * z(intensity)

    safe_z = z(pred_rating)
    sim_z = z(sim)
    cred_z = z(cred)
    inten_z = z(intensity)
    trans_z = z(transgressive)
    spec_z = z(spec)
    rad_z = z(radical)
    uniq_z = z(uniqueness)

    # "deep_expand": still cares about predicted enjoyment
    score_expand = (
        0.22 * safe_z +
        0.06 * sim_z +
        0.26 * trans_z +
        0.20 * inten_z +
        0.12 * cred_z +
        0.06 * spec_z +
        0.12 * rad_z +
        0.12 * uniq_z -
        0.18 * pop_penalty -
        0.08 * generic_penalty
    )

    # "weird_gems": preserve rare DNA + intensity, stop canon gravity
    score_weird = (
        0.10 * safe_z +
        0.06 * sim_z +
        0.30 * trans_z +
        0.24 * inten_z +
        0.20 * uniq_z +
        0.08 * cred_z +
        0.06 * spec_z +
        0.10 * rad_z -
        0.22 * pop_penalty -
        0.10 * generic_penalty
    )

    out = cand.copy()
    out["sim"] = sim
    out["novelty"] = novelty
    out["focus_vibe_sim"] = focus_vibe_sim
    out["intensity"] = intensity
    out["radical"] = radical
    out["credibility"] = cred
    out["specificity"] = spec
    out["pred_rating"] = pred_rating
    out["p_ge4"] = p_ge4
    out["lo80"] = lo80
    out["hi80"] = hi80
    out["idf_energy"] = idf_energy
    out["nnz_frac"] = nnz_frac
    out["uniqueness"] = uniqueness
    out["pop_penalty"] = pop_penalty
    out["score_expand"] = score_expand
    out["score_weird"] = score_weird

    # Filters: avoid total garbage but keep weird
    expand = out.sort_values("score_expand", ascending=False)
    expand = expand[(expand["credibility"] >= 0.28) & (expand["pred_rating"] >= 2.9)]

    weird = out.sort_values("score_weird", ascending=False)
    weird = weird[(weird["credibility"] >= 0.22) & (weird["pred_rating"] >= 2.7)]
    weird = weird[weird["intensity"] >= np.quantile(out["intensity"], 0.60)]

    def make(df: pd.DataFrame, bucket: str, score_col: str) -> pd.DataFrame:
        df = df.copy()
        df["bucket"] = bucket
        df["score"] = df[score_col]
        df["why"] = df.apply(
            lambda r: (
                f"p(>=4★)={r['p_ge4']:.0%} | pred={r['pred_rating']:.1f}★ | 80%={r['lo80']:.1f}-{r['hi80']:.1f}★"
                f" | focus={r['focus_vibe_sim']:.2f} | inten={r['intensity']:.2f} | uniq={r['uniqueness']:.2f}"
                f" | pop={r['pop_penalty']:.2f} | cred={r['credibility']:.2f} | spec={r['specificity']:.1f}"
            ),
            axis=1,
        )
        cols = [
            "bucket","score","pred_rating","p_ge4","lo80","hi80",
            "sim","focus_vibe_sim","intensity","radical",
            "credibility","specificity","uniqueness","idf_energy","nnz_frac","pop_penalty",
            "novelty",
            "title","release_date","year","director","vote_average","vote_count","tmdb_id","why"
        ]
        return df[[c for c in cols if c in df.columns]]

    expand_out = make(expand.head(n_expand), "deep_expand", "score_expand")
    weird_out = make(weird.head(n_weird), "weird_gems", "score_weird")

    # Interleave: 3 expand then 2 weird
    combined = []
    i = j = 0
    while i < len(expand_out) or j < len(weird_out):
        for _ in range(3):
            if i < len(expand_out):
                combined.append(expand_out.iloc[i]); i += 1
        for _ in range(2):
            if j < len(weird_out):
                combined.append(weird_out.iloc[j]); j += 1
        if len(combined) >= (len(expand_out) + len(weird_out)):
            break

    all_out = pd.DataFrame(combined)
    return expand_out, weird_out, all_out