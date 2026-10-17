type Credit={id?:number;name?:string;profile_path?:string|null;job?:string;department?:string;order?:number;character?:string};
type Raw={credits?:{cast?:Credit[];crew?:Credit[]};keywords?:{keywords?:{id:number;name:string}[]};genres?:{id:number;name:string}[];production_countries?:{iso_3166_1:string;name:string}[];production_companies?:{name:string}[];original_language?:string};
export function atlasMetadata(raw:Raw){
 const cast=(raw.credits?.cast||[]).filter(p=>p.id&&p.name).slice(0,20).map(p=>({id:p.id!,name:p.name!,role:'Actor',order:p.order??999,character:p.character||'',image:p.profile_path||null}));
 const crew=(raw.credits?.crew||[]).filter(p=>p.id&&p.name&&(p.job==='Director'||p.department==='Writing'||['Writer','Screenplay','Story','Novel','Teleplay','Characters'].includes(p.job||''))).map(p=>({id:p.id!,name:p.name!,role:p.job==='Director'?'Director':'Writer',order:0,character:p.job||'',image:p.profile_path||null}));
 const people=[...new Map([...crew,...cast].map(p=>[p.id+'|'+p.role,p])).values()];
 return {people,keywords:(raw.keywords?.keywords||[]).map(k=>k.name),genreList:(raw.genres||[]).map(g=>g.name),countries:(raw.production_countries||[]).map(c=>c.name),studios:(raw.production_companies||[]).map(s=>s.name),language:raw.original_language||'',metadataComplete:Boolean(raw.credits?.cast&&raw.credits?.crew&&raw.keywords?.keywords)};
}
