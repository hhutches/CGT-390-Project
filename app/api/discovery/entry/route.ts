import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureTmdbMovie } from '@/lib/discovery-library';
import {entryInput,saveMediaEntry} from '@/lib/discovery-entry';
import { sameOrigin } from '@/lib/discovery-tmdb';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 try{const user=await getCurrentUser();if(!user)return Response.json({error:'Please sign in to save films.'},{status:401});
 const body=await request.json();if(body.mediaId&&body.action==='log'){const mediaId=Number(body.mediaId);if(!Number.isInteger(mediaId)||mediaId<=0)return Response.json({error:'Choose a valid item.'},{status:400});let input;try{input=entryInput(body);}catch(e){return Response.json({error:(e as Error).message},{status:400});}const media=await prisma.mediaItem.findUnique({where:{id:mediaId},include:{externalRefs:true}});if(!media)return Response.json({error:'Item not found.'},{status:404});const manual=media.externalRefs.find(r=>r.provider==='MANUAL');if(manual&&(manual.rawPayload as any)?.createdBy&&(manual.rawPayload as any).createdBy!==user.id)return Response.json({error:'Item unavailable.'},{status:404});const entry=await saveMediaEntry(user.id,mediaId,input);return Response.json({ok:true,entryId:entry.id});}const id=Number(body.tmdbId),action=String(body.action);
 if(!Number.isInteger(id)||id<=0||!['rate','watchlist','remove-watchlist','unwatch'].includes(action))return Response.json({error:'Choose a valid film and action.'},{status:400});
 const rating=body.rating===null?null:Number(body.rating);
 if(action==='rate'&&rating!==null&&(!Number.isFinite(rating)||rating<.5||rating>5||!Number.isInteger(rating*2)))return Response.json({error:'Ratings must be from 0.5 to 5 in half-star steps.'},{status:400});
 const media=await ensureTmdbMovie(id);
 const existing=await prisma.userMediaEntry.findUnique({where:{userId_mediaId:{userId:user.id,mediaId:media.id}}});
 if(action==='rate'){const entry=await saveMediaEntry(user.id,media.id,entryInput({status:'COMPLETED',rating,visibility:existing?.visibility||'PRIVATE',review:existing?.reviewText||''}));return Response.json({ok:true,entryId:entry.id});}
 if(action==='remove-watchlist'){if(existing?.status==='WISHLIST')await prisma.userMediaEntry.delete({where:{id:existing.id}});return Response.json({ok:true});}
 if(action==='watchlist'&&existing&&existing.status!=='WISHLIST')return Response.json({ok:true,alreadyWatched:true});
 const status=action==='rate'?'COMPLETED':'WISHLIST';
 const data=action==='rate'?{status:status as 'COMPLETED',ratingValue:rating===null?null:rating*2,lastActivityAt:new Date(),visibility:'PRIVATE' as const}:action==='unwatch'?{status:'WISHLIST' as const,ratingValue:null,lastActivityAt:new Date()}: {status:'WISHLIST' as const,lastActivityAt:new Date()};
 const entry=await prisma.userMediaEntry.upsert({where:{userId_mediaId:{userId:user.id,mediaId:media.id}},create:{userId:user.id,mediaId:media.id,...data},update:data});
 return Response.json({ok:true,entryId:entry.id});
 }catch{return Response.json({error:'Could not save this film. Please try again.'},{status:503});}
}
