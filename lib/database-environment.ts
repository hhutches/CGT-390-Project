/** Preview deployments must use an explicitly separate database. Never fall back to production. */
export function databaseConnectionString(env: Record<string, string | undefined>) {
  if (env.VERCEL_ENV === 'preview') {
    const preview = env.PREVIEW_DATABASE_URL;
    if (!preview) throw new Error('Preview database is not configured. Production database access is disabled.');
    if (env.DATABASE_URL && preview === env.DATABASE_URL) throw new Error('Preview and production database URLs must differ.');
    const productionHost = env.DATABASE_URL ? new URL(env.DATABASE_URL).hostname.replace('-pooler.', '.') : null;
    const previewHost = new URL(preview).hostname.replace('-pooler.', '.');
    if (productionHost && previewHost === productionHost) throw new Error('Preview must use a separate database endpoint.');
    return preview;
  }
  if (!env.DATABASE_URL) throw new Error('Database is not configured.');
  return env.DATABASE_URL;
}
