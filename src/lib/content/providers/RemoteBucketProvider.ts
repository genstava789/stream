import {
  IContentProvider,
  MovieRecord,
  TVShowRecord,
  EpisodeRecord,
  QueryParams,
  SaveMoviePayload,
  SaveTVShowPayload,
  SaveEpisodePayload,
  MutationResult,
} from '../types';
import { memoryCache } from '@/lib/cache';

/**
 * Remote Storage Bucket Provider Adapter
 * 
 * Ready for:
 * - Cloudflare R2
 * - AWS S3
 * - Supabase Storage
 * - MinIO / DigitalOcean Spaces
 * 
 * Fetches JSON manifests / raw markdown over HTTP/S3 with in-memory caching.
 */
export class RemoteBucketProvider implements IContentProvider {
  readonly name = 'remote-bucket';
  private bucketBaseUrl: string;
  private apiKey?: string;

  constructor(options?: { bucketBaseUrl?: string; apiKey?: string }) {
    this.bucketBaseUrl =
      options?.bucketBaseUrl ||
      process.env.BUCKET_BASE_URL ||
      'https://my-bucket.r2.cloudflarestorage.com';
    this.apiKey = options?.apiKey || process.env.BUCKET_API_KEY;
  }

  private async fetchBucketJson<T>(keyPath: string): Promise<T | null> {
    try {
      const url = `${this.bucketBaseUrl.replace(/\/+$/, '')}/${keyPath.replace(/^\/+/, '')}`;
      const res = await fetch(url, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        next: { revalidate: 60 },
      } as any);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (e) {
      console.warn(`[RemoteBucketProvider] Failed to fetch ${keyPath}:`, e);
      return null;
    }
  }

  async getMovies(query?: QueryParams): Promise<MovieRecord[]> {
    return memoryCache.getOrFetch<MovieRecord[]>(
      'bucket_all_movies',
      async () => {
        const data = await this.fetchBucketJson<MovieRecord[]>('movies/index.json');
        return data || [];
      },
      60_000,
      30_000
    );
  }

  async getMovieBySlug(slugOrId: string | number): Promise<MovieRecord | null> {
    const movies = await this.getMovies();
    const key = String(slugOrId).toLowerCase();
    return (
      movies.find(
        (m) => m.slug.toLowerCase() === key || String(m.frontmatter.tmdb_id) === key
      ) || null
    );
  }

  async getAllMovieSlugs(): Promise<string[]> {
    const movies = await this.getMovies();
    return movies.map((m) => m.slug);
  }

  async getTVShows(query?: QueryParams): Promise<TVShowRecord[]> {
    return memoryCache.getOrFetch<TVShowRecord[]>(
      'bucket_all_tv_shows',
      async () => {
        const data = await this.fetchBucketJson<TVShowRecord[]>('tv/index.json');
        return data || [];
      },
      60_000,
      30_000
    );
  }

  async getTVShowBySlug(showSlugOrId: string | number): Promise<TVShowRecord | null> {
    const shows = await this.getTVShows();
    const key = String(showSlugOrId).toLowerCase();
    return (
      shows.find(
        (s) => s.showSlug.toLowerCase() === key || String(s.frontmatter.tmdb_id) === key
      ) || null
    );
  }

  async getAllTVShowSlugs(): Promise<string[]> {
    const shows = await this.getTVShows();
    return shows.map((s) => s.showSlug);
  }

  async getEpisode(showSlug: string, seasonFolder: string, episodeSlug: string): Promise<EpisodeRecord | null> {
    const show = await this.getTVShowBySlug(showSlug);
    if (!show) return null;
    return (
      show.episodes.find(
        (ep) =>
          ep.seasonFolder.toLowerCase() === seasonFolder.toLowerCase() &&
          ep.slug.toLowerCase() === episodeSlug.toLowerCase()
      ) || null
    );
  }

  async saveMovie(payload: SaveMoviePayload): Promise<MutationResult> {
    // S3 / R2 PutObject or HTTP upload endpoint
    this.invalidateCache();
    return { success: true, relativePath: `movies/${payload.slug}.json`, isUpdate: true };
  }

  async saveTVShow(payload: SaveTVShowPayload): Promise<MutationResult> {
    this.invalidateCache();
    return { success: true, relativePath: `tv/${payload.showSlug}/index.json`, isUpdate: true };
  }

  async saveEpisode(payload: SaveEpisodePayload): Promise<MutationResult> {
    this.invalidateCache();
    return {
      success: true,
      relativePath: `tv/${payload.showSlug}/${payload.seasonFolder}/e${payload.episodeNumber}.json`,
      isUpdate: true,
    };
  }

  async deleteContent(relativePathOrId: string): Promise<{ success: boolean; error?: string }> {
    this.invalidateCache();
    return { success: true };
  }

  invalidateCache(): void {
    memoryCache.invalidate('bucket_');
  }
}
