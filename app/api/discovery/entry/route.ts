import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureTmdbMovie } from '@/lib/discovery-library';
import { sameOrigin } from '@/lib/discovery-tmdb';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 try{const user=await getCurrentUser();if(!user)return Response.json({error:'Please sign in to save films.'},{status:401});
 const body=await request.json();const id=Number(body.tmdbId),action=String(body.action);
 if(!Number.isInteger(id)||id<=0||!['rate','watchlist','remove-watchlist','unwatch'].includes(action))return Response.json({error:'Choose a valid film and action.'},{status:400});
 const rating=body.rating===null?null:Number(body.rating);
 if(action==='rate'&&rating!==null&&(!Number.isFinite(rating)||rating<.5||rating>5||!Number.isInteger(rating*2)))return Response.json({error:'Ratings must be from 0.5 to 5 in half-star steps.'},{status:400});
 const media=await ensureTmdbMovie(id);
 const existing=await prisma.userMediaEntry.findUnique({where:{userId_mediaId:{userId:user.id,mediaId:media.id}}});
 if(action==='remove-watchlist'){if(existing?.status==='WISHLIST')await prisma.userMediaEntry.delete({where:{id:existing.id}});return Response.json({ok:true});}
 if(action==='watchlist'&&existing&&existing.status!=='WISHLIST')return Response.json({ok:true,alreadyWatched:true});
 const status=action==='rate'?'COMPLETED':'WISHLIST';
 const data=action==='rate'?{status:status as 'COMPLETED',ratingValue:rating===null?null:rating*2,lastActivityAt:new Date(),visibility:'PRIVATE' as const}:action==='unwatch'?{status:'WISHLIST' as const,ratingValue:null,lastActivityAt:new Date()}: {status:'WISHLIST' as const,lastActivityAt:new Date()};
 const entry=await prisma.userMediaEntry.upsert({where:{userId_mediaId:{userId:user.id,mediaId:media.id}},create:{userId:user.id,mediaId:media.id,...data},update:data});
 return Response.json({ok:true,entryId:entry.id});
 }catch{return Response.json({error:'Could not save this film. Please try again.'},{status:503});}
}
