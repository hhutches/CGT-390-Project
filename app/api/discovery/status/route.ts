import { tmdbConfigured } from '@/lib/discovery-tmdb';
export async function GET(){return Response.json({tmdb:tmdbConfigured(),accounts:true,preview:process.env.VERCEL_ENV==='preview',databaseReady:process.env.VERCEL_ENV==='preview'?Boolean(process.env.PREVIEW_DATABASE_URL):Boolean(process.env.DATABASE_URL)},{headers:{'Cache-Control':'no-store'}});}
