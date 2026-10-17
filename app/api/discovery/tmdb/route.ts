import { discoveryTmdb, isAllowedTmdbPath } from '@/lib/discovery-tmdb';
export async function GET(request:Request){
  const url=new URL(request.url),path=url.searchParams.get('path')||'';
  if(!isAllowedTmdbPath(path))return Response.json({error:'Unsupported film request.'},{status:400});
  const params:Record<string,string>={};url.searchParams.forEach((v,k)=>{if(k!=='path')params[k]=v;});
  try{return Response.json(await discoveryTmdb(path,params),{headers:{'Cache-Control':'public, max-age=300'}});}
  catch{return Response.json({error:'Film search is temporarily unavailable. Please try again.'},{status:503});}
}
