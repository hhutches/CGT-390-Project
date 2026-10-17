import 'server-only';
import { prisma } from '@/lib/prisma';
import { discoveryTmdb } from '@/lib/discovery-tmdb';
import { Prisma } from '@prisma/client';
import { atlasMetadata } from './discovery-metadata';
export const normalizeTitle=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export async function ensureTmdbMovie(tmdbId:number){
 const externalId=String(tmdbId);const existing=await prisma.mediaExternalRef.findUnique({where:{provider_externalId:{provider:'TMDB',externalId}},include:{media:true}});
 if(existing&&existing.media.type==='MOVIE')return existing.media;
 if(existing)throw new Error('This identifier belongs to a different media type.');
 const d=await discoveryTmdb('/movie/'+tmdbId,{append_to_response:'credits,keywords'});
 try{return await prisma.mediaItem.create({data:{type:'MOVIE',title:d.title,originalTitle:d.original_title||null,description:d.overview||null,releaseDate:d.release_date?new Date(d.release_date):null,coverUrl:d.poster_path?'https://image.tmdb.org/t/p/w500'+d.poster_path:null,backdropUrl:d.backdrop_path?'https://image.tmdb.org/t/p/w780'+d.backdrop_path:null,languageCode:d.original_language||null,movieDetails:{create:{runtimeMinutes:d.runtime||null}},externalRefs:{create:{provider:'TMDB',externalId,rawPayload:d as Prisma.InputJsonValue,lastSyncedAt:new Date()}}}});}
 catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){const found=await prisma.mediaExternalRef.findUnique({where:{provider_externalId:{provider:'TMDB',externalId}},include:{media:true}});if(found)return found.media;}throw error;}
}
export async function loadDiscoveryLibrary(userId:string){
 const entries=await prisma.userMediaEntry.findMany({where:{userId,media:{type:'MOVIE'}},include:{media:{include:{movieDetails:true,externalRefs:true,genres:{include:{genre:true}},credits:{include:{person:true}}}}},orderBy:{updatedAt:'desc'}});
 const movies=entries.map(e=>{const m=e.media,ref=m.externalRefs.find(r=>r.provider==='TMDB'),manual=m.externalRefs.find(r=>r.provider==='MANUAL'),raw=(ref?.rawPayload||manual?.rawPayload||{}) as Record<string,any>;return {id:ref?Number(ref.externalId):-m.id,mediaId:m.id,title:m.title,year:m.releaseDate?.getUTCFullYear()||Number(raw.year)||0,runtime:m.movieDetails?.runtimeMinutes||null,director:raw.credits?.crew?.filter((x:any)=>x.job==='Director').map((x:any)=>x.name).join(', ')||m.credits.filter(x=>x.creditRole==='Director').map(x=>x.person.fullName).join(', '),genre:raw.genres?.map((x:any)=>x.name).join(' / ')||m.genres.map(x=>x.genre.name).join(' / '),overview:m.description||'',poster:raw.poster_path||m.coverUrl?.split('/w500')[1]||null,tags:raw.keywords?.keywords?.map((x:any)=>x.name).join(' ')||'',source:ref?'tmdb':'pending',...atlasMetadata(raw),group:0,status:e.status,rating:e.ratingValue?e.ratingValue/2:null,review:e.reviewText||'',entryId:e.id};});
 return {movies,ratings:movies.filter(m=>m.status!=='WISHLIST').map(m=>({title:m.title,year:m.year,rating:m.rating,id:m.id,mediaId:m.mediaId})),watchlist:movies.filter(m=>m.status==='WISHLIST').map(m=>m.id)};
}
