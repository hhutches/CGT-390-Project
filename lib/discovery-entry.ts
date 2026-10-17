import {prisma} from '@/lib/prisma';
import {EntryStatus,Visibility,LogEventType,Prisma} from '@prisma/client';
export function entryInput(body:any){
 const status=body.status||'COMPLETED',visibility=body.visibility||'PRIVATE';
 if(!Object.values(EntryStatus).includes(status)||!Object.values(Visibility).includes(visibility))throw Error('Choose a valid status and visibility.');
 const rating=body.rating===null||body.rating===''||body.rating===undefined?null:Number(body.rating);
 if(rating!==null&&(!Number.isFinite(rating)||rating<.5||rating>5||!Number.isInteger(rating*2)))throw Error('Ratings must be from 0.5 to 5 in half-star steps.');
 const review=String(body.review||'').trim();if(review.length>10000)throw Error('Keep reviews under 10,000 characters.');
 const progressValue=String(body.progressValue||'').trim(),progressUnit=String(body.progressUnit||'').trim();
 if(progressValue.length>50||progressUnit.length>40)throw Error('Progress is too long.');
 if(progressValue&&(!Number.isFinite(Number(progressValue))||Number(progressValue)<0))throw Error('Progress must be a positive number.');
 const tasteNotes=body.tasteNotes===undefined?undefined:String(body.tasteNotes).trim();if(tasteNotes&&tasteNotes.length>4000)throw Error('Keep taste notes under 4,000 characters.');
 return{status:status as EntryStatus,visibility:visibility as Visibility,ratingValue:rating===null?null:rating*2,reviewText:review||null,progressValue,progressUnit,tasteNotes};
}
export async function saveMediaEntry(userId:string,mediaId:number,input:ReturnType<typeof entryInput>){
 return prisma.$transaction(async tx=>{
 const before=await tx.userMediaEntry.findUnique({where:{userId_mediaId:{userId,mediaId}}});
 const entry=await tx.userMediaEntry.upsert({where:{userId_mediaId:{userId,mediaId}},create:{userId,mediaId,status:input.status,visibility:input.visibility,ratingValue:input.ratingValue,reviewText:input.reviewText},update:{status:input.status,visibility:input.visibility,ratingValue:input.ratingValue,reviewText:input.reviewText,lastActivityAt:new Date()}});
 const eventType=!before?LogEventType.ADDED:input.reviewText?LogEventType.REVIEWED:input.ratingValue!==null?LogEventType.RATED:input.status==='COMPLETED'?LogEventType.COMPLETED:input.status==='IN_PROGRESS'?LogEventType.STARTED:LogEventType.UPDATED;
 await tx.userMediaLogEvent.create({data:{entryId:entry.id,mediaId,userId,eventType,bodyText:input.reviewText,ratingValue:input.ratingValue,progressValue:input.progressValue||null,progressUnit:input.progressUnit||null,details:{status:input.status}}});
 if(input.tasteNotes!==undefined){const key='taste-notes:'+userId+':'+mediaId;const value={text:input.tasteNotes} as Prisma.InputJsonValue;await tx.externalApiCache.upsert({where:{key},create:{key,value,expiresAt:new Date(Date.now()+3650*86400000)},update:{value}});}
 return entry;
 });
}
