set -euo pipefail

# rebuild features (uses your mapped file)
python -u export_features_v2.py --infile ratings_with_tmdb.csv --outfile ratings_features.csv

# run recommender
DEBUG=1 python -u run_recs.py --mode transgressive \
  --anchors "Climax,Videodrome,Blue Velvet,Trainspotting,Julien Donkey-Boy,Werckmeister Harmonies,Koyaanisqatsi,The Substance" \
  --pool_q 0.55

# FINAL: enforce transgressive hard
python -u postprocess_recs_transgressive.py \
  --infile recs_all.csv \
  --outfile recs_all_MOVIES_TRANSGRESSIVE_FINAL.csv \
  --min_vote_count 120 \
  --min_pred 3.85 \
  --min_intensity 0.92 \
  --min_radical 0.90 \
  --min_sim 0.12 \
  --min_year 1965 \
  --max_year 2026
