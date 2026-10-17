// Subgenres are learned from the visitor's films. Descriptors only name clusters after membership is computed.
export const qualitativeAxes=[
 ['dreamlike','Dreamlike','style','Dreamlike surreal cinema: unstable reality, dreams, hallucinations, symbolic events and altered perception.'],
 ['contemplative','Contemplative','style','Slow contemplative cinema about memory, spiritual questions, stillness and reflection.'],
 ['claustrophobic','Claustrophobic','style','Claustrophobic cinema: confinement, enclosed spaces, isolation, trapped characters and mounting dread.'],
 ['melancholic','Melancholic','style','Melancholic films about grief, loneliness, regret, loss, alienation and longing.'],
 ['kinetic','Kinetic','style','Intense kinetic cinema with frantic momentum, sensory overload, nightlife, chaos and visceral tension.'],
 ['humanist','Humanist','style','Warm compassionate humanist stories about ordinary people, friendship, resilience, work and community.'],
 ['nostalgic','Nostalgic','style','Nostalgic coming of age cinema about childhood, old friendships, adventures and remembered places.'],
 ['absurdist','Absurdist','style','Absurdist dark comedy, surreal satire and strange bureaucratic social situations.'],
 ['neon','Neon-drenched','style','Stylized neon noir cinema, nocturnal streets, city lights, nightclubs and nocturnal urban danger.'],
 ['folk','Folkloric','style','Folk and supernatural cinema shaped by ritual, mythology, rural traditions and ancient beliefs.'],
 ['observational','Observational','style','Observational realist films studying everyday routines, architecture, labor and social life.'],
 ['romantic','Romantic','style','Intimate romantic films about desire, relationships, vulnerability and emotional connection.'],
 ['dystopian','Dystopian','style','Oppressive dystopian cinema about surveillance, control, alienation and dehumanizing social systems.'],
 ['transcendent','Transcendent','style','Spiritual cinematic journeys through nature, faith, cosmic wonder and profound existential questions.'],
 ['cities','cityscapes','domain','Urban cinema about cities, city streets, architecture, metropolitan life and alienation in modern spaces.'],
 ['cosmos','cosmic frontiers','domain','Space journeys, alien worlds, the unknown universe, scientific discovery and cosmic mysteries.'],
 ['family','family fault lines','domain','Family relationships, mothers, fathers, children, home life and conflicts between generations.'],
 ['identity','fractured identities','domain','Identity, doubles, memory, unreliable perception, performance, dreams and the boundaries of the self.'],
 ['outsiders','outsider lives','domain','Outsiders, marginalized communities, lonely people and unconventional lives at the edges of society.'],
 ['work','working lives','domain','Working class lives, jobs, service work, economic pressure, solidarity and everyday survival.'],
 ['obsession','moral obsessions','domain','Crime investigations, obsessive pursuits, ethical dilemmas, justice, guilt and moral compromise.'],
 ['ruins','industrial ruins','domain','Abandoned industrial landscapes, decaying buildings, desolate zones, machinery and postindustrial spaces.'],
 ['nature','wild isolation','domain','Remote wilderness, nature, mountains, oceans, isolated landscapes and survival far from civilization.'],
 ['youth','rites of passage','domain','Coming of age, adolescence, childhood, youth, school and the transition into adulthood.'],
 ['body','body transformations','domain','The human body, mutation, bodily transformation, physical horror, illness and biological instability.'],
 ['systems','social machinery','domain','Institutions, power, capitalism, bureaucracy, media systems, politics and social structures.'],
 ['ritual','ritual worlds','domain','Religious rituals, cults, folklore, sacred beliefs, myth and encounters with supernatural forces.'],
 ['memory','memory worlds','domain','Memory, time, dreams, recollection, nostalgia, forgotten histories and the persistence of the past.']
];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*(b[i]||0),0);
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const mean=vs=>vs.length?vs[0].map((_,i)=>vs.reduce((s,v)=>s+v[i],0)/vs.length):[];
const words=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
export function qualitativeText(movie){const keywords=movie.keywords?.length?movie.keywords.join(', '):movie.tags||'';return `Synopsis: ${movie.overview||''}. Themes and descriptive keywords: ${keywords}. ${keywords}. Broad genres: ${movie.genre||''}.`;}
export function learnSubgenres(movies,embeddings,axisEmbeddings,{granularity='balanced'}={}){
 if(movies.length<3)throw Error('Add at least three matched films to analyze personal subgenres.');
 const valid=movies.filter(m=>Array.isArray(embeddings[m.id])&&embeddings[m.id].length>0);if(valid.length!==movies.length)throw Error('Some films still need semantic analysis.');
 const semantic=movies.map(m=>normalize(embeddings[m.id]));const facets=semantic.map(v=>qualitativeAxes.map(([id])=>dot(v,axisEmbeddings[id]||[])));
 const baseline=mean(facets),deviation=baseline.map((_,j)=>Math.sqrt(facets.reduce((s,v)=>s+(v[j]-baseline[j])**2,0)/facets.length)||.01);
 // Text semantics dominate; relative qualitative axes make mood/aesthetic differences within THIS library visible.
 const vectors=semantic.map((v,i)=>normalize([...v.map(x=>x*.88),...normalize(facets[i].map((x,j)=>(x-baseline[j])/deviation[j])).map(x=>x*.32)]));
 // Build mutual semantic neighbors, then optimize local modularity in the FULL embedding space.
 // The projection never decides membership. Weakly connected films may remain unassigned.
 const n=vectors.length,k=Math.min(n-1,Math.max(2,Math.round(Math.sqrt(n))));
 const similarities=vectors.map(v=>vectors.map(w=>dot(v,w)));
 const neighbors=similarities.map((row,i)=>row.map((value,j)=>({j,value})).filter(x=>x.j!==i).sort((a,b)=>b.value-a.value).slice(0,k));
 const nearest=neighbors.map(row=>row[0]?.value||0).sort((a,b)=>a-b);
 const floor=Math.max(.12,(nearest[Math.floor(n*.2)]||0)*.72);
 const graph=Array.from({length:n},()=>new Map());
 for(let i=0;i<n;i++)for(const {j,value} of neighbors[i])if(j>i&&value>=floor&&neighbors[j].some(x=>x.j===i)){
  const weight=Math.max(.001,value-floor+.025);graph[i].set(j,weight);graph[j].set(i,weight);
 }
 const degrees=graph.map(row=>[...row.values()].reduce((a,b)=>a+b,0)),total=degrees.reduce((a,b)=>a+b,0);
 const resolution=granularity==='broad'?.65:granularity==='fine'?1.6:1;
 let assignments=movies.map((_,i)=>i),volumes=[...degrees];
 if(total)for(let pass=0;pass<40;pass++){
  let changed=false;
  for(let i=0;i<n;i++){
   if(!degrees[i])continue;const old=assignments[i];volumes[old]-=degrees[i];
   const connections=new Map([[old,0]]);for(const[j,w]of graph[i])connections.set(assignments[j],(connections.get(assignments[j])||0)+w);
   let best=old,bestScore=(connections.get(old)||0)-resolution*degrees[i]*volumes[old]/total;
   for(const[c,w]of connections){const gain=w-resolution*degrees[i]*volumes[c]/total;if(gain>bestScore+1e-9){best=c;bestScore=gain;}}
   assignments[i]=best;volumes[best]+=degrees[i];if(best!==old)changed=true;
  }
  if(!changed)break;
 }
 const sizes=new Map();assignments.forEach(a=>sizes.set(a,(sizes.get(a)||0)+1));
 assignments=assignments.map((a,i)=>(sizes.get(a)||0)>=3&&degrees[i]>0?a:-1);
 const keywordCounts=new Map();movies.forEach(m=>new Set(m.keywords||[]).forEach(w=>keywordCounts.set(w,(keywordCounts.get(w)||0)+1)));
 const usedNames=new Set();const clusters=[...new Set(assignments)].filter(a=>a>=0).map((assignment,index)=>{
  const indices=movies.map((_,i)=>i).filter(i=>assignments[i]===assignment),members=indices.map(i=>movies[i]),centroid=normalize(mean(indices.map(i=>semantic[i]))),facetMean=mean(indices.map(i=>facets[i]));
  const scores=qualitativeAxes.map(([key,label,type],j)=>({key,label,type,absolute:facetMean[j],contrast:(facetMean[j]-baseline[j])/deviation[j],strength:Math.max(0,Math.min(1,(facetMean[j]+1)/2))})).sort((a,b)=>(b.absolute*.7+b.contrast*.06)-(a.absolute*.7+a.contrast*.06));
  const styles=scores.filter(s=>s.type==='style'),domains=scores.filter(s=>s.type==='domain');let label='',chosenStyle=styles[0],chosenDomain=domains[0];
  outer:for(const style of styles.slice(0,4))for(const domain of domains.slice(0,4)){const candidate=style.label+' '+domain.label;if(!usedNames.has(candidate)){label=candidate;chosenStyle=style;chosenDomain=domain;break outer;}}if(!label)label=styles[0].label+' '+domains[0].label+' '+(index+1);usedNames.add(label);
  const counts=new Map();members.forEach(m=>new Set(m.keywords||[]).forEach(w=>counts.set(w,(counts.get(w)||0)+1)));const keywords=[...counts].map(([word,n])=>({word,count:n,weight:n/members.length*Math.log(1+movies.length/(keywordCounts.get(word)||1))})).sort((a,b)=>b.weight-a.weight).slice(0,8);
  const representatives=indices.map(i=>({id:movies[i].id,similarity:dot(semantic[i],centroid)})).sort((a,b)=>b.similarity-a.similarity).slice(0,3).map(r=>r.id);
  const signals=[chosenStyle,chosenDomain,...scores.filter(s=>s.key!==chosenStyle.key&&s.key!==chosenDomain.key).slice(0,3)].map(s=>({...s,supportIds:[...indices].sort((a,b)=>facets[b][qualitativeAxes.findIndex(x=>x[0]===s.key)]-facets[a][qualitativeAxes.findIndex(x=>x[0]===s.key)]).slice(0,3).map(i=>movies[i].id)}));
  const explanation=`${chosenStyle.label} atmospheric cues connect these films with ${chosenDomain.label}. ${keywords.length?'Distinctive shared topics include '+keywords.slice(0,3).map(k=>k.word).join(', ')+'. ':''}This name describes a cluster learned from this collection, rather than an official TMDb genre.`;
  return{id:'subgenre-'+index,label,name:label,memberIds:members.map(m=>m.id),representativeIds:representatives,centroid,cohesion:indices.reduce((s,i)=>s+dot(semantic[i],centroid),0)/indices.length,signals,keywords,explanation};
 });
 const memberships=movies.map((movie,i)=>{
  const scores=clusters.map(c=>({clusterId:c.id,similarity:dot(semantic[i],c.centroid)})).sort((a,b)=>b.similarity-a.similarity);
  const best=scores[0],second=scores[1];const max=best?.similarity||0;
  const evidence=scores.slice(0,3).map(s=>({...s,weight:Math.exp((s.similarity-max)/.09)}));const sum=evidence.reduce((a,b)=>a+b.weight,0)||1;
  const soft=evidence.map(s=>({...s,weight:s.weight/sum}));
  const primary=clusters.find(c=>c.memberIds.includes(movie.id));
  const margin=best&&second?best.similarity-second.similarity:1;
  return{id:movie.id,primaryClusterId:primary?.id||null,status:best&&best.similarity>.4&&margin<.065?'bridge':!primary?'outlier':'core',margin,affinities:soft};
 });
 return{version:2,model:'MiniLM-L6-v2 · mutual semantic neighbors · modularity communities',granularity,clusters,memberships,projection:[],projectionMethod:null,createdAt:new Date().toISOString()};
}
// A single shared UMAP plane includes core, bridge and unassigned films, without snapping to centers.
export async function projectSubgenres(profile,movies,embeddings,UMAP,onProgress=()=>{}){
 let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const vectors=movies.map(m=>normalize(embeddings[m.id]));
 const umap=new UMAP({nComponents:2,nNeighbors:Math.min(15,movies.length-1),minDist:.05,nEpochs:350,random});
 const coordinates=await umap.fitAsync(vectors,epoch=>{onProgress(epoch/350);});
 if(coordinates.some(row=>row.some(x=>!Number.isFinite(x))))throw Error('The semantic plane could not be projected.');
 const xs=coordinates.map(p=>p[0]),ys=coordinates.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 // Uniform scale preserves the projected geometry instead of stretching each axis independently.
 const span=Math.max(maxX-minX,maxY-minY)||1,cx=(maxX+minX)/2,cy=(maxY+minY)/2;
 profile.projection=movies.map((m,i)=>({id:m.id,x:.5+(coordinates[i][0]-cx)/span*.84,y:.5+(coordinates[i][1]-cy)/span*.84,...profile.memberships.find(x=>x.id===m.id)}));
 profile.projectionMethod='UMAP · 15 neighbors · min distance 0.05 · seed 42';return profile;
}
