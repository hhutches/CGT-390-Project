import 'server-only';
import { prisma } from '@/lib/prisma';
import { discoveryTmdb } from '@/lib/discovery-tmdb';
import { Prisma } from '@prisma/client';
import {atlasIdentity,meaningfulMetadata,stripMarkup} from './media-atlas-model';
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
export const libraryMediaInclude={movieDetails:true,showDetails:true,bookDetails:true,albumDetails:true,gameDetails:true,externalRefs:true,genres:{include:{genre:true}},credits:{include:{person:true}}} as const;
export function serializeLibraryMedia(m:any,e:any={},tasteNotes=''){
 const ref=m.externalRefs?.find((r:any)=>r.provider==='TMDB'&&m.type==='MOVIE')||m.externalRefs?.find((r:any)=>r.provider!=='MANUAL')||m.externalRefs?.[0];
 const raw=(ref?.rawPayload||{}) as Record<string,any>,isFilm=m.type==='MOVIE',isShow=m.type==='SHOW',info=raw.volumeInfo||{};
 const tmdb=atlasMetadata(raw);const tagRows=raw.tags?.results||raw.tags||[];
 const keywords=[...new Set<string>([...tmdb.keywords,...(Array.isArray(tagRows)?tagRows.map((t:any)=>typeof t==='string'?t:t.name).filter(Boolean):[]),...(raw.keywords?.results||[]).map((t:any)=>t.name),...(raw.qualitativeKeywords||[])])];
 const genres=[...new Set<string>([...tmdb.genreList,...(m.genres||[]).map((x:any)=>x.genre.name),...(info.categories||[]),...(raw.genres||[]).filter((g:any)=>typeof g==='string')].filter(Boolean))];
 const localPeople=(m.credits||[]).map((c:any)=>({id:'local:'+c.person.id,name:c.person.fullName,role:c.creditRole,image:c.person.imageUrl||null}));
 const rawCreators=raw.creators||info.authors||raw.authors||raw['artist-credit']?.map((a:any)=>a.name||a.artist?.name)||[];
 const creatorRole=m.type==='BOOK'?'Author':m.type==='ALBUM'?'Artist':m.type==='GAME'?'Developer':'Creator';
 const creators=[...new Set<string>([...localPeople.filter((p:any)=>!['Actor'].includes(p.role)).map((p:any)=>p.name),...rawCreators.map((p:any)=>typeof p==='string'?p:p.name).filter(Boolean),...(m.albumDetails?.primaryArtistName?[m.albumDetails.primaryArtistName]:[])])];
 const creatorPeople=creators.map(name=>({id:'creator:'+creatorRole+':'+name.toLowerCase(),name,role:creatorRole,image:null}));
 const description=stripMarkup(m.description||raw.description||info.description||'');
 const pending=isFilm&&ref?.provider==='MANUAL'&&raw.pendingMatch===true;
 const id=pending?-m.id:atlasIdentity(m.id,m.type,isFilm&&ref?.provider==='TMDB'?ref.externalId:undefined);
 const progress=e.logEvents?.[0];
 return{id,mediaId:m.id,mediaType:m.type,type:m.type,title:m.title,year:m.releaseDate?.getUTCFullYear()||Number(raw.year)||0,runtime:isFilm?m.movieDetails?.runtimeMinutes||null:isShow?m.showDetails?.avgRuntimeMinutes||null:null,director:tmdb.people.filter(p=>p.role==='Director').map(p=>p.name).join(', ')||creators.join(', '),creators,genre:genres.join(' / '),genreList:genres,overview:description,poster:isFilm?raw.poster_path||m.coverUrl?.split('/w500')[1]||null:null,coverUrl:m.coverUrl||null,tags:keywords.join(' '),keywords,people:[...tmdb.people,...localPeople,...(!isFilm&&!isShow?creatorPeople:[])],source:pending?'pending':isFilm&&ref?.provider==='TMDB'?'tmdb':'library',metadataComplete:isFilm&&ref?.provider==='TMDB'?tmdb.metadataComplete:true,tasteEligible:meaningfulMetadata(description,keywords,tasteNotes),tasteNotes,metadataQuality:meaningfulMetadata(description,keywords,tasteNotes)?'descriptive':'limited',provider:ref?.provider||null,externalId:ref?.externalId||null,group:0,status:e.status||'WISHLIST',visibility:e.visibility||'PRIVATE',rating:e.ratingValue?e.ratingValue/2:null,review:e.reviewText||'',entryId:e.id||null,progressValue:progress?.progressValue||'',progressUnit:progress?.progressUnit||'',details:{...(m.movieDetails||{}),...(m.showDetails||{}),...(m.bookDetails||{}),...(m.albumDetails||{}),...(m.gameDetails?{...m.gameDetails,timeToBeatHours:m.gameDetails.timeToBeatHours?.toString()||null}:{})}};
}
export async function loadDiscoveryLibrary(userId:string){
 const[entries,notes]=await Promise.all([prisma.userMediaEntry.findMany({where:{userId},include:{media:{include:libraryMediaInclude},logEvents:{orderBy:{createdAt:'desc'},take:1,select:{progressValue:true,progressUnit:true}}},orderBy:{updatedAt:'desc'}}),prisma.externalApiCache.findMany({where:{key:{startsWith:'taste-notes:'+userId+':'}}})]);
 const noteMap=new Map(notes.map(n=>[Number(n.key.split(':').pop()),String((n.value as any)?.text||'')]));
 const movies=entries.map(e=>serializeLibraryMedia(e.media,e,noteMap.get(e.mediaId)||''));
 return{movies,media:movies,ratings:movies.filter(m=>m.status!=='WISHLIST').map(m=>({title:m.title,year:m.year,rating:m.rating,id:m.id,mediaId:m.mediaId,mediaType:m.mediaType})),watchlist:movies.filter(m=>m.status==='WISHLIST').map(m=>m.id)};
}
