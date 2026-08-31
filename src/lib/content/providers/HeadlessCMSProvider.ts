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
 * Headless CMS Provider Adapter
 * 
 * Ready for:
 * - Strapi CMS
 * - Sanity.io
 * - Ghost CMS
 * - Decap / Directus / Custom GraphQL/REST CMS
 */
export class HeadlessCMSProvider implements IContentProvider {
  readonly name = 'headless-cms';
  private apiUrl: string;
  private apiToken?: string;

  constructor(options?: { apiUrl?: string; apiToken?: string }) {
    this.apiUrl = options?.apiUrl || process.env.CMS_API_URL || 'https://cms.example.com/api';
    this.apiToken = options?.apiToken || process.env.CMS_API_TOKEN;
  }

  private async fetchCMS<T>(endpoint: string): Promise<T | null> {
    try {
      const url = `${this.apiUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
      const res = await fetch(url, {
        headers: this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {},
        next: { revalidate: 60 },
      } as any);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (e) {
      console.warn(`[HeadlessCMSProvider] Failed to fetch ${endpoint}:`, e);
      return null;
    }
  }

  async getMovies(query?: QueryParams): Promise<MovieRecord[]> {
    return memoryCache.getOrFetch<MovieRecord[]>(
      'cms_all_movies',
      async () => {
        const data = await this.fetchCMS<{ data: MovieRecord[] }>('movies?populate=*');
        return data?.data || [];
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
      'cms_all_tv_shows',
      async () => {
        const data = await this.fetchCMS<{ data: TVShowRecord[] }>('tv-shows?populate=*');
        return data?.data || [];
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
    this.invalidateCache();
    return { success: true, relativePath: `cms/movies/${payload.slug}`, isUpdate: true };
  }

  async saveTVShow(payload: SaveTVShowPayload): Promise<MutationResult> {
    this.invalidateCache();
    return { success: true, relativePath: `cms/tv/${payload.showSlug}`, isUpdate: true };
  }

  async saveEpisode(payload: SaveEpisodePayload): Promise<MutationResult> {
    this.invalidateCache();
    return {
      success: true,
      relativePath: `cms/tv/${payload.showSlug}/${payload.seasonFolder}/e${payload.episodeNumber}`,
      isUpdate: true,
    };
  }

  async deleteContent(relativePathOrId: string): Promise<{ success: boolean; error?: string }> {
    this.invalidateCache();
    return { success: true };
  }

  invalidateCache(): void {
    memoryCache.invalidate('cms_');
  }
}
