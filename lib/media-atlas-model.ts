// Shared identity and metadata contract. TMDb movie IDs stay compatible with Letterboxd imports.
export const MEDIA_TYPES=['MOVIE','SHOW','GAME','BOOK','ALBUM'] as const;
export const atlasIdentity=(mediaId:number,type:string,tmdbId?:string)=>type==='MOVIE'&&tmdbId&&/^\d+$/.test(tmdbId)?Number(tmdbId):-(1_000_000_000+mediaId);
export function meaningfulMetadata(description:string,keywords:string[],notes=''){
 const text=description.replace(/<[^>]*>/g,' ').trim();
 return notes.trim().length>=30||keywords.length>=2||text.length>=60&&!/^Album by .*(First released|$)/i.test(text);
}
export function stripMarkup(s:unknown){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
