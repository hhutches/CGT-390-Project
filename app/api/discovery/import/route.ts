import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureTmdbMovie, normalizeTitle } from '@/lib/discovery-library';
import { discoveryTmdb, sameOrigin } from '@/lib/discovery-tmdb';
import { createHash } from 'crypto';
export const maxDuration=60;
type ImportRow={title:string;year:number;rating:number|null;tmdbId?:number};
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 try{const user=await getCurrentUser();if(!user)return Response.json({error:'Sign in to import your library.'},{status:401});
 const body=await request.json();if(!Array.isArray(body.rows)||body.rows.length>10||!body.rows.length)return Response.json({error:'Import between 1 and 10 rows per batch.'},{status:400});
 const rows:ImportRow[]=body.rows;
 if(rows.some(r=>typeof r.title!=='string'||!r.title.trim()||r.title.length>300||!Number.isInteger(r.year)||r.year<1880||r.year>2100||r.rating!==null&&(!Number.isFinite(r.rating)||r.rating<.5||r.rating>5||!Number.isInteger(r.rating*2))||r.tmdbId!==undefined&&(!Number.isInteger(r.tmdbId)||r.tmdbId<=0)))return Response.json({error:'Some imported film data is invalid.'},{status:400});
 const report=[];
 for(const r of rows){
 let id=r.tmdbId||null;
 if(!id){const found=await discoveryTmdb('/search/movie',{query:r.title,primary_release_year:String(r.year)});const exact=found.results.filter((m:any)=>normalizeTitle(m.title)===normalizeTitle(r.title)&&Number((m.release_date||'').slice(0,4))===r.year);if(exact.length===1)id=exact[0].id;}
 let media;
 if(id)media=await ensureTmdbMovie(id);
 else {const externalId='letterboxd:'+createHash('sha256').update(normalizeTitle(r.title)+'|'+r.year).digest('hex');const ref=await prisma.mediaExternalRef.findUnique({where:{provider_externalId:{provider:'MANUAL',externalId}},include:{media:true}});media=ref?.media||await prisma.mediaItem.create({data:{type:'MOVIE',title:r.title,releaseDate:new Date(`${r.year}-01-01`),externalRefs:{create:{provider:'MANUAL',externalId,rawPayload:{year:r.year,pendingMatch:true}}}}});}
 await prisma.userMediaEntry.upsert({where:{userId_mediaId:{userId:user.id,mediaId:media.id}},create:{userId:user.id,mediaId:media.id,status:'COMPLETED',ratingValue:r.rating===null?null:r.rating*2,visibility:'PRIVATE',completionCount:1},update:{status:'COMPLETED',ratingValue:r.rating===null?null:r.rating*2,lastActivityAt:new Date()}});
 // Replace only this user's unresolved placeholder after an explicit match confirmation.
 if(id&&r.tmdbId){const placeholder=await prisma.userMediaEntry.findMany({where:{userId:user.id,media:{type:'MOVIE',title:r.title,releaseDate:new Date(`${r.year}-01-01`),externalRefs:{some:{provider:'MANUAL'}}}},select:{id:true}});if(placeholder.length)await prisma.userMediaEntry.deleteMany({where:{id:{in:placeholder.map(p=>p.id)},userId:user.id}});}
 report.push({title:r.title,year:r.year,matched:Boolean(id),tmdbId:id});
 }
 return Response.json({report});
 }catch{return Response.json({error:'Import paused. Retry the remaining rows; completed rows will not duplicate.'},{status:503});}
}
