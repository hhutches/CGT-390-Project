"""Reuse Henry's original ReprModel offline; export public TMDb metadata and semantic neighbors only.
No ratings, account IDs, Letterboxd URLs, API credentials or fitted user models are exported.
Usage: python scripts/build-original-catalog.py /path/to/tmdb_cand_cache.json
"""
import sys,json,gzip,base64,hashlib,importlib.util
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('original_repr',root/'legacy/movie-mood/engine_repr.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
source=Path(sys.argv[1]);raw=json.loads(source.read_text());rows=[]
for value in raw.values():
 if not isinstance(value,dict) or not value.get('tmdb_id') or not value.get('overview'):continue
 def terms(field):
  xs=value.get(field) or []
  if isinstance(xs,str):
   try:xs=json.loads(xs)
   except Exception:xs=[xs]
  return [str(x.get('name','') if isinstance(x,dict) else x).strip() for x in xs if x][:35]
 genres=terms('genres');keywords=terms('keywords');cast=terms('cast');title=str(value.get('title') or '')
 rows.append({'id':int(value['tmdb_id']),'title':title,'year':int(value.get('year') or 0),'director':str(value.get('director') or ''),'genre':' / '.join(genres),'genreList':genres,'keywords':keywords,'tags':' '.join(keywords),'overview':str(value.get('overview') or ''),'voteAverage':float(value.get('vote_average') or 0),'voteCount':int(value.get('vote_count') or 0),'vibe_text':' '.join([str(value.get('overview') or ''),' '.join(genres),' '.join(keywords)]).lower(),'entity_text':' '.join([title,str(value.get('director') or ''),' '.join(cast)]).lower()})
frame=pd.DataFrame(rows).drop_duplicates('id').reset_index(drop=True)
model=module.ReprModel(svd_dim=256);vectors,entities=model.fit(frame)
neighbors=NearestNeighbors(n_neighbors=min(9,len(frame)),metric='cosine',algorithm='brute').fit(vectors).kneighbors(vectors,return_distance=False)
items=[]
for index,row in frame.iterrows():
 item={k:row[k] for k in ['id','title','year','director','genre','genreList','keywords','tags','overview','voteAverage','voteCount']};item['year']=int(item['year']);item['voteCount']=int(item['voteCount']);item['id']=int(item['id']);item['neighborIds']=[int(frame.iloc[j]['id']) for j in neighbors[index] if j!=index];items.append(item)
payload={'provenance':{'source':'Uploaded tmdb_cand_cache.json','representation':'Original engine_repr.ReprModel: word TF-IDF + TruncatedSVD256, separate entity character TF-IDF','records':len(items),'representationShape':list(vectors.shape),'entityShape':list(entities.shape),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()},'items':items}
packed={'encoding':'gzip+base64','data':base64.b64encode(gzip.compress(json.dumps(payload,separators=(',',':'),ensure_ascii=False).encode(),mtime=0)).decode()}
(root/'data/original-movie-mood-catalog.json').write_text(json.dumps(packed,separators=(',',':')))
print(json.dumps({'records':len(items),'representationShape':list(vectors.shape),'packedBytes':(root/'data/original-movie-mood-catalog.json').stat().st_size}))
