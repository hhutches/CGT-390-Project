/** Serve discovery as a full viewport workspace on the same origin as auth and the media library. */
export async function GET(request:Request){return Response.redirect(new URL('/mood/index.html',request.url));}
