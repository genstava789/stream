import { IContentProvider } from './types';
import { LocalMarkdownProvider } from './providers/LocalMarkdownProvider';
import { RemoteBucketProvider } from './providers/RemoteBucketProvider';
import { HeadlessCMSProvider } from './providers/HeadlessCMSProvider';

export * from './types';
export * from './providers/LocalMarkdownProvider';
export * from './providers/RemoteBucketProvider';
export * from './providers/HeadlessCMSProvider';

// Singleton instance cache
let currentProvider: IContentProvider | null = null;

/**
 * Returns the active Content Provider based on environment configuration.
 * 
 * Set CONTENT_PROVIDER environment variable:
 * - "local" (default): Fast in-memory cached Local Markdown files in video/ and tv/
 * - "bucket": Cloudflare R2, AWS S3, or Supabase Storage
 * - "headless": Strapi, Sanity, Ghost, or GraphQL/REST CMS
 */
export function getContentProvider(): IContentProvider {
  if (currentProvider) {
    return currentProvider;
  }

  const providerType = (process.env.CONTENT_PROVIDER || 'local').toLowerCase().trim();

  switch (providerType) {
    case 'bucket':
    case 's3':
    case 'r2':
      currentProvider = new RemoteBucketProvider();
      break;

    case 'headless':
    case 'cms':
    case 'strapi':
    case 'sanity':
      currentProvider = new HeadlessCMSProvider();
      break;

    case 'local':
    default:
      currentProvider = new LocalMarkdownProvider();
      break;
  }

  return currentProvider;
}

/**
 * Allows switching provider programmatically (e.g. for testing or runtime switching).
 */
export function setContentProvider(provider: IContentProvider): void {
  currentProvider = provider;
}

export default getContentProvider;
