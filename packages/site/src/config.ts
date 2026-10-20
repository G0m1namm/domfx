export function siteConfig(env: Record<string, string | undefined>): {
  site: string;
  indexable: boolean;
} {
  if (env.DOMFX_SITE_PRODUCTION === 'true' && !env.DOMFX_SITE_URL) {
    throw new Error('DOMFX_SITE_URL is required for a production site build.');
  }
  const site = new URL(env.DOMFX_SITE_URL ?? 'http://127.0.0.1:4321');
  if (
    !['http:', 'https:'].includes(site.protocol) ||
    site.pathname !== '/' ||
    site.search ||
    site.hash ||
    site.username ||
    site.password
  ) {
    throw new Error(
      'DOMFX_SITE_URL must be an HTTP(S) origin without credentials, path, query or fragment.',
    );
  }
  return {
    site: site.origin,
    indexable: env.DOMFX_INDEXING === 'true' && env.DOMFX_SITE_PREVIEW !== 'true',
  };
}
