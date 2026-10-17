# Personal semantic atlas

This feature extends the existing Media Logger accounts, TMDb items, entries, ratings and imports. It runs only against the isolated preview database when VERCEL_ENV=preview. No schema migration or production deployment is required.

## Recovery status

The uploaded original `engine_repr.py`, `engine_rank.py`, recommendation/export scripts and Streamlit launcher are preserved unchanged under `legacy/movie-mood`. The original representation code has actually been run against the supplied public TMDb candidate cache: 3,399 usable records, normalized TF-IDF/SVD vectors and nearest-neighbor relationships. `scripts/build-original-catalog.py` reproduces that public catalog. Catalog retrieval uses those neighbors; optional deeper/unusual ranking ports the original rarity and credibility formulas. The original calibrated Ridge/logistic rating models are not yet wired into the web app.

The supplied original HTML outputs also recover 220 historical movie positions, ratings and assignments. `original-map.js` reads serialized Plotly data without executing HTML scripts, keeping the original 20-cluster and later 15-cluster maps separate. Personal HTML, ratings and the personal feature cache are not published in this repository. The original map viewer reads the user's chosen file locally and can explicitly import its ratings into their authenticated account.

The original `src/visualization`, `src/ui`, clustering generators and full processed embeddings/membership files are still missing. New cross-media clustering below is a reconstruction, not the recovered original HDBSCAN implementation. Existing Media Logger accounts, media models, profiles, entries, social graph and import/provider routes are reused.

## Executable pipeline

1. Letterboxd CSV/ZIP parsing → title/year resolution → confirmed TMDb IDs → existing account entries.
2. Server-side TMDb lookup enriches overview, exact keywords, genres and cast/crew. Credentials never enter browser configuration.
3. `qualitativeText` creates synopsis/keyword/genre text. MiniLM-L6-v2 computes normalized384-dimensional embeddings. Names and cast do not dominate semantic membership.
4. Qualitative anchor embeddings describe mood and aesthetic concepts. Their within-library contrast adds a small auxiliary signal; actual synopsis semantics dominate.
5. Mutual nearest-neighbor graph is built in full vector space. Weighted local modularity optimization discovers communities. Weakly connected films and tiny communities remain unassigned. This is a graph community reconstruction, not HDBSCAN or a full multilevel Louvain implementation.
6. Centroid similarities yield normalized affinities to up to three neighborhoods. Small separation between the top two identifies bridge films, including bridges without primary membership. Weights are relative affinities, not calibrated probabilities.
7. Cluster names combine the strongest qualitative style/domain descriptors after grouping. Distinctive TMDb keywords and representative films provide inspectable evidence. Names use a controlled descriptor vocabulary; they are not unconstrained generated prose.
8. Seeded UMAP projects ALL eligible media embeddings together. Cluster membership never determines screen position. Regions and labels follow actual projected member coordinates; unassigned films remain visible. Local proximity is useful, long distances and directions are approximate. No invented fixed genre axes.
9. Per-user derived profiles persist in the existing JSON cache table under account-specific keys. Fingerprints invalidate profiles after library metadata/ratings changes. The API checks ownership, unique primary membership, every plotted film, finite coordinates and affinities.
10. Selecting a neighborhood supplies its actual member films to taste-based recommendations. Actor/director/writer graphs use separate real credit relationships and independent toggles.

## Profile contract, version3

- `clusters[]`: id, label, memberIds, representativeIds, semantic centroid, cohesion, qualitative signals, distinctive keywords, explanation.
- `memberships[]`: movieID, nullable primaryClusterId, core/bridge/outlier status, margin, up to three weighted affinities.
- `projection[]`: movieID, normalized x/y and membership summary.
- provenance: model, granularity, projectionMethod, createdAt, library fingerprint.

Every eligible logged media item occurs once in memberships and projection. Primary members are unique across clusters. An unassigned film is permitted and never discarded. Source metadata remains independent of derived profiles, allowing replacement with the original pipeline if it becomes available.

## Validation

`node tests/subgenre-plane.mjs` verifies separated communities, ambiguous bridge affinities, visible unassigned films, normalized weights, stable seeded UMAP and finite people graph layouts. Existing import/search and database isolation regressions remain in place. Tests use synthetic vectors; semantic quality on a real account requires reviewing the user's imported collection.

## Unified media

Movies, shows, books, games and albums use the existing five detail tables. Collision-safe atlas IDs distinguish media and providers. Media filters select displayed points without changing the shared plane. Metadata-poor items remain loggable but are excluded from semantic inference until descriptions, keywords or private taste notes provide evidence. Private taste notes never appear in other users' profiles or feeds. Social visibility combines entry privacy, profile privacy, friendship and blocking.

Tests cover mixed-media identities, hierarchy totals, original ranking formulas, map parsing, existing semantic graph invariants and authenticated preview API flows. No schema migration or production database writes are required. Live game lookup still depends on the preview's RAWG provider configuration; existing catalog and manual logging remain available.
