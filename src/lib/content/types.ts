/**
 * Pluggable Content Provider Architecture Interfaces & Types
 * 
 * Supports:
 * 1. Local Markdown (default)
 * 2. Remote Storage Buckets (Cloudflare R2, AWS S3, Supabase Storage, MinIO)
 * 3. Headless CMS (Strapi, Sanity, Ghost, Decap, Custom GraphQL/REST)
 */

export interface ContentMetadata {
  title?: string;
  tmdb_id?: number | string;
  rating?: number | string;
  deskripsi?: string;
  description?: string;
  videourl?: string;
  video_url?: string;
  image_url?: string;
  tagline?: string;
  featured?: boolean | string;
  duration?: string;
  subtitles?: any;
  year?: number | string;
  genres?: string[];
  [key: string]: any;
}

export interface MovieRecord {
  id: string; // slug or identifier
  slug: string;
  title: string;
  relativePath: string;
  frontmatter: ContentMetadata;
  content: string;
  contentHtml?: string;
  updatedAt?: number;
}

export interface EpisodeRecord {
  id: string;
  showSlug: string;
  seasonFolder: string; // e.g. "s1"
  episodeNumber: number; // e.g. 1
  slug: string; // e.g. "e1"
  title: string;
  relativePath: string;
  frontmatter: ContentMetadata;
  content: string;
  contentHtml?: string;
  updatedAt?: number;
}

export interface TVShowRecord {
  id: string; // showSlug
  showSlug: string;
  title: string;
  relativePath: string;
  frontmatter: ContentMetadata;
  content: string;
  contentHtml?: string;
  episodes: EpisodeRecord[];
  updatedAt?: number;
}

export interface QueryParams {
  search?: string;
  featured?: boolean;
  sortBy?: 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'rating_desc';
  limit?: number;
  offset?: number;
}

export interface SaveMoviePayload {
  slug?: string;
  frontmatter: ContentMetadata;
  content?: string;
}

export interface SaveTVShowPayload {
  showSlug: string;
  frontmatter: ContentMetadata;
  content?: string;
}

export interface SaveEpisodePayload {
  showSlug: string;
  seasonFolder: string;
  episodeNumber: number;
  frontmatter: ContentMetadata;
  content?: string;
}

export interface MutationResult {
  success: boolean;
  relativePath: string;
  isUpdate?: boolean;
  error?: string;
}

/**
 * Standard Contract for All Content Providers
 */
export interface IContentProvider {
  /**
   * Unique name of the provider (e.g. "local-markdown", "cloudflare-r2", "strapi-cms")
   */
  readonly name: string;

  // ── Movies ──
  getMovies(query?: QueryParams): Promise<MovieRecord[]>;
  getMovieBySlug(slugOrId: string | number): Promise<MovieRecord | null>;
  getAllMovieSlugs(): Promise<string[]>;

  // ── TV Shows ──
  getTVShows(query?: QueryParams): Promise<TVShowRecord[]>;
  getTVShowBySlug(showSlugOrId: string | number): Promise<TVShowRecord | null>;
  getAllTVShowSlugs(): Promise<string[]>;

  // ── TV Episodes ──
  getEpisode(showSlug: string, seasonFolder: string, episodeSlug: string): Promise<EpisodeRecord | null>;

  // ── Mutations (Create / Update / Delete) ──
  saveMovie(payload: SaveMoviePayload): Promise<MutationResult>;
  saveTVShow(payload: SaveTVShowPayload): Promise<MutationResult>;
  saveEpisode(payload: SaveEpisodePayload): Promise<MutationResult>;
  deleteContent(relativePathOrId: string): Promise<{ success: boolean; error?: string }>;

  // ── Cache / Lifecycle ──
  invalidateCache(): void;
}
