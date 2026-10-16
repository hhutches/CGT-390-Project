import { getCurrentUser } from '@/lib/auth';
import { loadDiscoveryLibrary } from '@/lib/discovery-library';
export async function GET(){try{const user=await getCurrentUser();if(!user)return Response.json({error:'Please sign in.'},{status:401});return Response.json(await loadDiscoveryLibrary(user.id),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Your library is temporarily unavailable.'},{status:503});}}
