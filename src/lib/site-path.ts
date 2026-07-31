const configuredBase = import.meta.env.BASE_URL || '/';
const normalizedBase = configuredBase === '/'
  ? ''
  : `/${configuredBase.replace(/^\/+|\/+$/g, '')}`;

/**
 * Prefix a root-relative site path with Astro's configured base path.
 * External URLs, hashes, queries and already-prefixed paths are preserved.
 */
export function withBase(path: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || !normalizedBase) return path;
  if (path === normalizedBase || path.startsWith(`${normalizedBase}/`)) return path;
  return `${normalizedBase}${path}`;
}

export const siteBase = normalizedBase;
