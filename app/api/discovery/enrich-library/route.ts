import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {discoveryTmdb,sameOrigin} from '@/lib/discovery-tmdb';
import {Prisma} from '@prisma/client';
export const maxDuration=60;
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 try{const user=await getCurrentUser();if(!user)return Response.json({error:'Please sign in.'},{status:401});const body=await request.json();
 if(!Array.isArray(body.ids)||body.ids.length>8||!body.ids.length||body.ids.some((id:unknown)=>!Number.isInteger(id)||Number(id)<=0))return Response.json({error:'Choose up to eight films to refresh.'},{status:400});
 const ids:string[]=[...new Set((body.ids as number[]).map(String))];
 const owned=await prisma.mediaExternalRef.findMany({where:{provider:'TMDB',externalId:{in:ids},media:{type:'MOVIE',entries:{some:{userId:user.id}}}}});
 let updated=0;
 for(const ref of owned){const details=await discoveryTmdb('/movie/'+ref.externalId,{append_to_response:'credits,keywords'});await prisma.mediaExternalRef.update({where:{id:ref.id},data:{rawPayload:details as Prisma.InputJsonValue,lastSyncedAt:new Date()}});updated++;}
 return Response.json({updated});
 }catch{return Response.json({error:'Some film connections could not be loaded. Try refreshing them shortly.'},{status:503});}
}
