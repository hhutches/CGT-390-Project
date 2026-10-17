# engine_repr.py
import json
import math
import numpy as np
from collections import Counter
from typing import List, Dict

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from sklearn.metrics.pairwise import cosine_similarity


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


def build_keyword_idf(all_kw_lists: List[List[str]]) -> Dict[str, float]:
    df = Counter()
    N = len(all_kw_lists)
    for kws in all_kw_lists:
        for k in set(kws):
            df[k] += 1
    return {k: math.log((N + 1) / (1 + d)) for k, d in df.items()}


def specificity_score(candidate_kws: List[str], anchor_kw_sets: List[set], idf: Dict[str, float]) -> float:
    ck = set(candidate_kws)
    if not ck:
        return 0.0
    best = 0.0
    for hk in anchor_kw_sets:
        inter = ck & hk
        if not inter:
            continue
        s = sum(idf.get(k, 0.0) for k in inter)
        if s > best:
            best = s
    return best


def z(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=float)
    mu = np.nanmean(x)
    sd = np.nanstd(x) or 1.0
    return (x - mu) / sd


def sigmoid(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=float)
    return 1.0 / (1.0 + np.exp(-x))


def credibility_prior(vote_avg: np.ndarray, vote_cnt: np.ndarray) -> np.ndarray:
    va = np.nan_to_num(vote_avg, nan=0.0)
    vc = np.nan_to_num(vote_cnt, nan=0.0)
    q = sigmoid((va - 6.6) / 0.55)
    lv = np.log1p(np.maximum(vc, 1.0))
    evidence = sigmoid((lv - np.log1p(35)) / 0.9)
    return q * evidence


class ReprModel:
    def __init__(self, svd_dim: int = 256):
        self.svd_dim = svd_dim
        self.vibe_vec = None
        self.svd = None
        self.ent_vec = None

    def fit(self, df_rated):
        vibe = df_rated["vibe_text"].fillna("").astype(str)
        ent = df_rated["entity_text"].fillna("").astype(str)

        self.vibe_vec = TfidfVectorizer(
            stop_words="english",
            sublinear_tf=True,
            min_df=2,
            max_df=0.90,
            ngram_range=(1, 2),
            max_features=100_000,
        )
        Xv = self.vibe_vec.fit_transform(vibe)

        svd_dim = int(max(64, min(self.svd_dim, Xv.shape[1] - 1))) if Xv.shape[1] > 1 else 1
        self.svd = TruncatedSVD(n_components=svd_dim, random_state=42)
        Ev = normalize(self.svd.fit_transform(Xv))

        self.ent_vec = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            sublinear_tf=True,
            min_df=2,
            max_df=0.95,
            max_features=60_000,
        )
        Xe = self.ent_vec.fit_transform(ent)
        return Ev, Xe

    def transform(self, df):
        vibe = df["vibe_text"].fillna("").astype(str)
        ent = df["entity_text"].fillna("").astype(str)
        Xv = self.vibe_vec.transform(vibe)
        Ev = normalize(self.svd.transform(Xv))
        Xe = self.ent_vec.transform(ent)
        return Ev, Xe


def cosine_to_vec(X_sparse, v_dense_1d: np.ndarray) -> np.ndarray:
    v = np.asarray(v_dense_1d).reshape(1, -1)
    return cosine_similarity(X_sparse, v).ravel()


def aesthetic_intensity(E: np.ndarray, mean_vec: np.ndarray) -> np.ndarray:
    D = E - mean_vec.reshape(1, -1)
    return np.linalg.norm(D, axis=1)


def candidate_centrality(E_c: np.ndarray, k: int = 20) -> np.ndarray:
    k = int(max(5, min(k, len(E_c) - 1))) if len(E_c) > 10 else max(3, len(E_c) - 1)
    S = E_c @ E_c.T
    np.fill_diagonal(S, -1.0)
    topk = np.partition(S, -k, axis=1)[:, -k:]
    return topk.mean(axis=1)