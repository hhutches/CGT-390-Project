# Personal semantic atlas

This feature extends the existing Media Logger accounts, TMDb items, entries, ratings and imports. It runs only against the isolated preview database when VERCEL_ENV=preview. No schema migration or production deployment is required.

## Recovery status

The original Movie Mood source has not been recovered. Connected GitHub code search and Library searches did not locate it. Earlier conversation references identify:

- `src/pipeline/05_cluster_movies.py`: normalized embeddings, HDBSCAN and UMAP.
- `src/pipeline/05_cluster_movies_v2.py`: a later HDBSCAN iteration with min_cluster_size=8, min_samples=4; UMAP n_neighbors=15, min_dist=.05, seed42.
- A subsequent proposal used cosine nearest-neighbor communities and soft membership.
- Original outputs: `movie_embeddings.parquet`, `movies_enriched.parquet`, `credits.parquet`, `keywords.parquet`, `movie_clusters_clean_v2.csv`, `movie_cluster_membership_v2.csv`, `cluster_labels_v2.csv`.

These are recovered descriptions, not inspected source files. This implementation reconstructs the behavior; it does not claim byte-for-byte reuse of that Python pipeline. The existing Next.js Media Logger source IS reused.

## Executable pipeline

1. Letterboxd CSV/ZIP parsing → title/year resolution → confirmed TMDb IDs → existing account entries.
2. Server-side TMDb lookup enriches overview, exact keywords, genres and cast/crew. Credentials never enter browser configuration.
3. `qualitativeText` creates synopsis/keyword/genre text. MiniLM-L6-v2 computes normalized384-dimensional embeddings. Names and cast do not dominate semantic membership.
4. Qualitative anchor embeddings describe mood and aesthetic concepts. Their within-library contrast adds a small auxiliary signal; actual synopsis semantics dominate.
5. Mutual nearest-neighbor graph is built in full vector space. Weighted local modularity optimization discovers communities. Weakly connected films and tiny communities remain unassigned. This is a graph community reconstruction, not HDBSCAN or a full multilevel Louvain implementation.
6. Centroid similarities yield normalized affinities to up to three neighborhoods. Small separation between the top two identifies bridge films, including bridges without primary membership. Weights are relative affinities, not calibrated probabilities.
7. Cluster names combine the strongest qualitative style/domain descriptors after grouping. Distinctive TMDb keywords and representative films provide inspectable evidence. Names use a controlled descriptor vocabulary; they are not unconstrained generated prose.
8. Seeded UMAP projects ALL film embeddings together. Cluster membership never determines screen position. Regions and labels follow actual projected member coordinates; unassigned films remain visible. Local proximity is useful, long distances and directions are approximate. No invented fixed genre axes.
9. Per-user derived profiles persist in the existing JSON cache table under account-specific keys. Fingerprints invalidate profiles after library metadata/ratings changes. The API checks ownership, unique primary membership, every plotted film, finite coordinates and affinities.
10. Selecting a neighborhood supplies its actual member films to taste-based recommendations. Actor/director/writer graphs use separate real credit relationships and independent toggles.

## Profile contract, version2

- `clusters[]`: id, label, memberIds, representativeIds, semantic centroid, cohesion, qualitative signals, distinctive keywords, explanation.
- `memberships[]`: movieID, nullable primaryClusterId, core/bridge/outlier status, margin, up to three weighted affinities.
- `projection[]`: movieID, normalized x/y and membership summary.
- provenance: model, granularity, projectionMethod, createdAt, library fingerprint.

Every matched logged film occurs once in memberships and projection. Primary members are unique across clusters. An unassigned film is permitted and never discarded. Source metadata remains independent of derived profiles, allowing replacement with the original pipeline if it becomes available.

## Validation

`node tests/subgenre-plane.mjs` verifies separated communities, ambiguous bridge affinities, visible unassigned films, normalized weights, stable seeded UMAP and finite people graph layouts. Existing import/search and database isolation regressions remain in place. Tests use synthetic vectors; semantic quality on a real account requires reviewing the user's imported collection.
