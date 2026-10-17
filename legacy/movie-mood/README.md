# Original Movie Mood dashboard supplied by Henry

The uploaded original source files are retained unchanged. `app.py` is the Streamlit launcher, not the pipeline implementation. It provides exact original navigation, generator entrypoints and expected outputs:

| View | Generator / UI | Output |
|---|---|---|
| Recommendations | `src.ui.cluster_picker_app.render` | `visualizations/recommendations.html` |
| Semantic Taste Map | `src.visualization.01_umap_map` | `visualizations/umap_map.html` |
| People Network | `src.visualization.03_people_network` | `visualizations/people_network.html` |
| Movies Sunburst | `src.visualization.04_movies_sunburst` | `visualizations/movies_sunburst.html` |
| Movies Force Network | `src.visualization.05_movie_force_network` | `visualizations/movies_force_network.html` |

`src.ui.html_embed` and the generator modules remain missing. `requirements.txt` only lists python-dotenv and requests, despite app.py importing Streamlit; it is not a complete environment specification.

Later uploads recovered `engine_repr.py`, `engine_rank.py`, recommendation, export and filtering scripts. `scripts/build-original-catalog.py` runs the original representation implementation on public candidate metadata and exports 3,399 records with neighbor relationships. The web ranking ports rarity/credibility formulas, but does not claim to run the original calibrated rating models.

Original generated HTML was supplied privately and establishes historical coordinates, cluster assignments and ratings for 220 films. The app can parse those files locally. Personal HTML and feature caches are deliberately absent from this public repository. Exact clustering regeneration still requires the missing `src/` generators and processed vector/membership files.

Do not run the preserved shell runners blindly: some remove outputs and depend on missing modules. The original `_genre_ids` helper and feature-export module also contain defects; preservation is not a claim that every legacy entrypoint is runnable.
