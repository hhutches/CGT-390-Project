import 'server-only';
const allowed = [/^\/configuration$/, /^\/search\/(movie|keyword|person)$/, /^\/discover\/movie$/, /^\/movie\/\d+(\/(similar|recommendations))?$/, /^\/trending\/movie\/(day|week)$/, /^\/person\/\d+\/movie_credits$/];
export function isAllowedTmdbPath(path: string) { return allowed.some(re => re.test(path)); }
export function tmdbConfigured(){return Boolean(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY);}
export async function discoveryTmdb(path: string, params: Record<string,string> = {}) {
  if (!isAllowedTmdbPath(path)) throw new Error('Unsupported film request.');
  const token=process.env.TMDB_ACCESS_TOKEN, key=process.env.TMDB_API_KEY;
  if (!token && !key) throw new Error('Film search is temporarily unavailable.');
  const url=new URL('https://api.themoviedb.org/3'+path);
  for(const [name,value] of Object.entries(params)) if(name!=='api_key'&&name!=='access_token'&&value.length<=500)url.searchParams.set(name,value);
  url.searchParams.set('include_adult','false');
  if(key&&!token)url.searchParams.set('api_key',key);
  const response=await fetch(url,{headers:token?{Authorization:'Bearer '+token,accept:'application/json'}:{accept:'application/json'},signal:AbortSignal.timeout(12000),next:{revalidate:3600}});
  if(!response.ok)throw new Error(response.status===429?'Film search is busy. Please try again shortly.':'Film search is temporarily unavailable.');
  return response.json();
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
