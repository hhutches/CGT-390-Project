set -euo pipefail

# Always run from this script's directory
cd "$(dirname "$0")"

# Rebuild features (write to a temp then atomically replace, avoids PermissionError)
tmp_feats="ratings_features.tmp.csv"
python -u export_features_v2.py --infile ratings_with_tmdb.csv --outfile "$tmp_feats"
mv -f "$tmp_feats" ratings_features.csv

# Hard delete old outputs so "write" is real
rm -f recs_all.csv recs_deep_expand.csv recs_weird_gems.csv debug_final_all_out.csv

# Run recommender
DEBUG=1 python -u run_recs.py --mode transgressive \
  --anchors "Climax,Videodrome,Blue Velvet,Trainspotting,Julien Donkey-Boy,Werckmeister Harmonies,Koyaanisqatsi,The Substance" \
  --pool_q 0.55

# Final hard postprocess (must exist)
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

echo
echo "==== FINAL PREVIEW ===="
python - <<'PY'
import pandas as pd
df = pd.read_csv("recs_all_MOVIES_TRANSGRESSIVE_FINAL.csv")
cols = [c for c in ["title","year","pred_rating","p_ge4","sim","intensity","radical","vote_count","director"] if c in df.columns]
print("rows:", len(df))
print(df[cols].head(30).to_string(index=False))
PY
