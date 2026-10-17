import {createHash} from 'crypto';
export function tasteFingerprint(movies:{id:number;overview?:string;tags?:string;rating?:number|null;status?:string;metadataComplete?:boolean}[]){return createHash('sha256').update(JSON.stringify(movies.filter(m=>m.status!=='WISHLIST'&&m.id>0).sort((a,b)=>a.id-b.id).map(m=>[m.id,m.rating,m.overview,m.tags,m.metadataComplete]))).digest('hex');}
