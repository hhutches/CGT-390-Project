// Ports of metadata functions from Henry's uploaded engine_repr.py; ranking adaptations are documented.
import{cosine,movieKey}from'./engine.js?v=9';
export function keywordIdf(lists){const counts=new Map();for(const xs of lists)for(const k of new Set(xs||[]))counts.set(k,(counts.get(k)||0)+1);return new Map([...counts].map(([k,n])=>[k,Math.log((lists.length+1)/(1+n))]));}
export function specificityScore(keywords,anchors,idf){const candidate=new Set(keywords||[]);return Math.max(0,...anchors.map(anchor=>[...candidate].filter(k=>anchor.has(k)).reduce((s,k)=>s+(idf.get(k)||0),0)));}
const sigmoid=x=>1/(1+Math.exp(-x));
export function credibilityPrior(average,count){return sigmoid(((Number(average)||0)-6.6)/.55)*sigmoid((Math.log1p(Math.max(Number(count)||0,1))-Math.log1p(35))/.9);}
export function aestheticIntensity(vector,center){return Math.sqrt(vector.reduce((s,x,i)=>s+(x-(center[i]||0))**2,0));}
const standardized=xs=>{const mean=xs.reduce((s,x)=>s+x,0)/(xs.length||1),sd=Math.sqrt(xs.reduce((s,x)=>s+(x-mean)**2,0)/(xs.length||1))||1;return xs.map(x=>(x-mean)/sd);};
export function originalRerank(ranked,{ratings=[],all=[],embeddings={},mode='balanced'}={}){
 if(mode==='balanced'||!ranked.length)return ranked;
 const anchors=ratings.filter(r=>r.rating>=4.5).map(r=>all.find(m=>movieKey(m)===movieKey(r))).filter(Boolean),anchorSets=anchors.map(m=>new Set(m.keywords||[]));
 const idf=keywordIdf([...ranked,...anchors].map(m=>m.keywords||[]));const ratedVectors=ratings.map(r=>embeddings[r.id]).filter(Boolean);const center=ratedVectors.length?ratedVectors[0].map((_,i)=>ratedVectors.reduce((s,v)=>s+v[i],0)/ratedVectors.length):null;
 const rows=ranked.map(m=>({m,type:m.mediaType||'MOVIE',specificity:specificityScore(m.keywords,anchorSets,idf),intensity:center&&embeddings[m.id]?aestheticIntensity(embeddings[m.id],center):0,popularity:m.voteCount>0?Math.log1p(m.voteCount):0,credibility:m.voteCount>0?credibilityPrior(m.voteAverage,m.voteCount):0}));
 // Normalize per medium: a film's vote count must never penalize a book or album with no comparable metric.
 for(const type of new Set(rows.map(r=>r.type))){const group=rows.filter(r=>r.type===type);for(const feature of ['specificity','intensity','popularity','credibility']){const available=feature==='popularity'||feature==='credibility'?group.filter(r=>r.m.voteCount>0):group;const zs=standardized(available.map(r=>r[feature]));available.forEach((r,i)=>r[feature+'Z']=zs[i]);}}
 return rows.map(r=>({...r.m,originalSignals:{specificity:r.specificity,intensity:r.intensity,credibility:r.credibility},score:r.m.score+(mode==='weird_gems'?.075:.045)*(r.specificityZ||0)+(mode==='weird_gems'?.07:.035)*(r.intensityZ||0)+(mode==='weird_gems'?.012:.025)*(r.credibilityZ||0)-(mode==='weird_gems'?.05:.025)*(r.popularityZ||0)})).sort((a,b)=>b.score-a.score);
}
