import { headers } from 'next/headers';
import { getBaseUrl as getIsomorphicBaseUrl, getAbsoluteUrl as getIsomorphicAbsoluteUrl } from './urls';
import siteConfig from '@/config';

/**
 * Dynamically resolves the Base URL on the server side using the active incoming HTTP request headers.
 * Extracts `x-forwarded-host` or `host` along with protocol (`x-forwarded-proto`).
 * If called during static build (SSG prerender), cleanly falls back to NEXT_PUBLIC_SITE_URL or siteConfig.url.
 */
export function getServerBaseUrl(): string {
  try {
    const headersList = headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    if (host) {
      const proto =
        headersList.get('x-forwarded-proto') ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  } catch {
    // headers() might throw during SSG/build phase when no incoming request exists
  }

  const envUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    siteConfig?.url ||
    'https://levistream.freebuff.app';

  return envUrl.replace(/\/+$/, '');
}

/**
 * Constructs an absolute URL using the dynamic server request origin.
 */
export function getServerAbsoluteUrl(path: string = ''): string {
  const origin = getServerBaseUrl();
  return getIsomorphicAbsoluteUrl(path, origin);
}
