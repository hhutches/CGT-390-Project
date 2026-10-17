import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from sklearn.cluster import KMeans

INFILE = "ratings_features.csv"
OUTFILE = "taste_clusters_45plus.csv"

MIN_RATING = 4.5
K_CLUSTERS = 4
SVD_DIM = 64

df = pd.read_csv(INFILE)

# Required columns check
need = ["Name", "Rating", "tmdb_id", "text"]
missing = [c for c in need if c not in df.columns]
if missing:
    raise SystemExit(f"Missing columns in {INFILE}: {missing}")

# Filter exactly 4.5+
high = df[df["Rating"] >= MIN_RATING].copy()

# Drop only if truly unusable
high["text"] = high["text"].fillna("").astype(str)
high = high[high["text"].str.len() >= 10].copy()

print(f"Loaded {len(df)} rows; {len(high)} rows with Rating >= {MIN_RATING}")

# Embed text
vec = TfidfVectorizer(stop_words="english", min_df=2, max_df=0.9, ngram_range=(1, 2))
X = vec.fit_transform(high["text"])
svd_dim = min(SVD_DIM, X.shape[1] - 1) if X.shape[1] > 1 else 1
svd = TruncatedSVD(n_components=svd_dim, random_state=42)
Z = normalize(svd.fit_transform(X))

# Cluster
k = min(K_CLUSTERS, len(high))  # avoid crash if very small
km = KMeans(n_clusters=k, random_state=42, n_init=10)
high["cluster"] = km.fit_predict(Z)

# Output (keep only what you care about)
cols = [c for c in ["Name", "Rating", "Year", "year", "tmdb_id", "cluster"] if c in high.columns]
high[cols].to_csv(OUTFILE, index=False)

print(f"Wrote {OUTFILE} ({len(high)} rows)")
print("Check Climax:")
print(high[high["Name"].str.lower().str.contains("climax")][cols])