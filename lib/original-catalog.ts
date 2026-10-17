import{gunzipSync}from'node:zlib';import packed from'@/data/original-movie-mood-catalog.json';import{lexical,norm}from'@/public/mood/engine.js';
let cache:any;
function catalog(){if(!cache)cache=JSON.parse(gunzipSync(Buffer.from(packed.data,'base64')).toString('utf8'));return cache;}
export function originalCatalogInfo(){return catalog().provenance;}
export function originalCandidates(query:string,seedIds:number[]=[],mode='mood',limit=80){const rows=catalog().items as any[];const map=new Map<number,any>(rows.map(m=>[m.id,m]));const neighborWeights=new Map<number,number>();for(const seed of seedIds){const m=map.get(seed);if(m)m.neighborIds.forEach((id:number,i:number)=>neighborWeights.set(id,Math.max(neighborWeights.get(id)||0,.18-i*.012)));}
 return rows.map(m=>({...m,retrievalScore:mode==='title'?(norm(m.title).includes(norm(query))?1:0):lexical(query,m)+(neighborWeights.get(m.id)||0)})).filter(m=>mode!=='title'||m.retrievalScore>0).sort((a,b)=>b.retrievalScore-a.retrievalScore||b.voteAverage-a.voteAverage).slice(0,limit).map(m=>({...m,mediaType:'MOVIE',type:'MOVIE',provider:'TMDB',externalId:String(m.id),source:'tmdb',metadataComplete:false,tasteEligible:true,group:0,metadataOrigin:'Original Movie Mood cache',representationOrigin:'Original engine_repr.py TF-IDF/SVD neighbor graph'}));
}
