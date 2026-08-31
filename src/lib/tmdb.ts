import {
  Movie,
  MovieDetail,
  TMDBResponse,
  Genre,
  GenreListResponse,
  TVShow,
  TVShowDetail,
} from '@/types/tmdb';

const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || 'ea0c8bc1b7235d9e19b457c965b658ad';
const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

import { memoryCache } from '@/lib/cache';

export type ImageSize = 'w92' | 'w185' | 'w200' | 'w300' | 'w342' | 'w400' | 'w500' | 'w780' | 'w1280' | 'original';

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const mergedParams: Record<string, string> = {
    language: 'en-US',
    ...params,
  };
  const cacheKey = `tmdb_${endpoint}_${JSON.stringify(mergedParams)}`;

  return memoryCache.getOrFetch<T>(
    cacheKey,
    async () => {
      const url = new URL(`${BASE_URL}${endpoint}`);
      url.searchParams.set('api_key', API_KEY);
      Object.entries(mergedParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const response = await fetch(url.toString(), {
        next: { revalidate: 3600 },
      } as any);

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText} for ${endpoint}`);
      }

      return (await response.json()) as T;
    },
    600_000, // 10 min hard TTL
    120_000  // 2 min SWR background revalidate
  );
}

export function getImageUrl(path: string | null | undefined, size: ImageSize = 'w500'): string {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return '/placeholder-poster.svg';
  }

  const trimmed = path.trim();

  // If already a TMDB full URL, update it to the requested resolution size
  if (trimmed.includes('image.tmdb.org/t/p/')) {
    return trimmed.replace(/\/t\/p\/[^\/]+/, `/t/p/${size}`);
  }

  // If already another full URL (http or https), return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // If it's explicitly a local placeholder or static asset
  if (
    trimmed === '/placeholder-poster.svg' ||
    trimmed === '/placeholder-poster.jpg' ||
    trimmed === '/logo.png' ||
    trimmed.startsWith('/static/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/images/')
  ) {
    return trimmed;
  }

  // If path already starts with /t/p/ (TMDB partial path)
  if (trimmed.startsWith('/t/p/')) {
    return `https://image.tmdb.org${trimmed.replace(/\/t\/p\/[^\/]+/, `/t/p/${size}`)}`;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${IMAGE_BASE_URL}/${size}${cleanPath}`;
}

export async function getTrending(
  mediaType: 'movie' | 'tv' = 'movie',
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBResponse<Movie>> {
  return fetchTMDB<TMDBResponse<Movie>>(`/trending/${mediaType}/${timeWindow}`);
}

export async function getPopularMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
  return fetchTMDB<TMDBResponse<Movie>>('/movie/popular', { page: String(page) });
}

export async function getNowPlayingMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
  return fetchTMDB<TMDBResponse<Movie>>('/movie/now_playing', { page: String(page) });
}

export async function getTopRatedMovies(page: number = 1): Promise<TMDBResponse<Movie>> {
  return fetchTMDB<TMDBResponse<Movie>>('/movie/top_rated', { page: String(page) });
}

export async function getMovieDetails(id: number): Promise<MovieDetail | null> {
  try {
    const movie = await fetchTMDB<MovieDetail>(`/movie/${id}`, {
      append_to_response: 'videos,credits,similar,images',
      include_image_language: 'en,id,null',
      language: 'en-US',
    });
    return movie;
  } catch (e) {
    console.warn(`TMDB getMovieDetails error for ${id}:`, e);
    return null;
  }
}

export async function getTVShowDetails(id: number): Promise<TVShowDetail | null> {
  try {
    const show = await fetchTMDB<TVShowDetail>(`/tv/${id}`, {
      append_to_response: 'videos,credits,similar,images',
      include_image_language: 'en,id,null',
      language: 'en-US',
    });
    return show;
  } catch (e) {
    console.warn(`TMDB getTVShowDetails error for ${id}:`, e);
    return null;
  }
}

export async function searchMovies(query: string, page: number = 1): Promise<TMDBResponse<Movie>> {
  try {
    return await fetchTMDB<TMDBResponse<Movie>>('/search/movie', {
      query,
      page: String(page),
      include_adult: 'false',
    });
  } catch {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
}

export async function searchTVShows(query: string, page: number = 1): Promise<TMDBResponse<TVShow>> {
  try {
    return await fetchTMDB<TMDBResponse<TVShow>>('/search/tv', {
      query,
      page: String(page),
      include_adult: 'false',
    });
  } catch {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
}

export async function searchMulti(query: string, page: number = 1): Promise<TMDBResponse<Movie | TVShow>> {
  try {
    const data = await fetchTMDB<TMDBResponse<any>>('/search/multi', {
      query,
      page: String(page),
      include_adult: 'false',
    });
    const filtered = (data.results || []).filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );
    return {
      ...data,
      results: filtered,
    };
  } catch {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
}

export async function discoverMovies(
  page: number = 1,
  sortBy: string = 'popularity.desc',
  genreId?: number,
  withOriginalLanguage?: string
): Promise<TMDBResponse<Movie>> {
  // Normalize sort_by for Movies
  let normalizedSort = sortBy;
  if (sortBy === 'first_air_date.desc') normalizedSort = 'release_date.desc';
  if (sortBy === 'first_air_date.asc') normalizedSort = 'release_date.asc';

  const params: Record<string, string> = {
    page: String(page),
    sort_by: normalizedSort,
  };
  if (genreId) {
    params.with_genres = String(genreId);
  }
  if (withOriginalLanguage) {
    params.with_original_language = withOriginalLanguage.toLowerCase();
  }
  return fetchTMDB<TMDBResponse<Movie>>('/discover/movie', params);
}

export async function getMoviesByGenre(
  genreId: number,
  page: number = 1,
  sortBy: string = 'popularity.desc'
): Promise<TMDBResponse<Movie>> {
  return discoverMovies(page, sortBy, genreId);
}

export async function getGenres(): Promise<Genre[]> {
  const data = await fetchTMDB<GenreListResponse>('/genre/movie/list', { language: 'en-US' });
  return data.genres;
}

export async function getPopularTV(page: number = 1): Promise<TMDBResponse<TVShow>> {
  return fetchTMDB<TMDBResponse<TVShow>>('/tv/popular', { page: String(page) });
}

export async function getTrendingTV(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBResponse<TVShow>> {
  return fetchTMDB<TMDBResponse<TVShow>>(`/trending/tv/${timeWindow}`);
}

export async function getTopRatedTV(page: number = 1): Promise<TMDBResponse<TVShow>> {
  return fetchTMDB<TMDBResponse<TVShow>>('/tv/top_rated', { page: String(page) });
}

export async function getAiringTodayTV(page: number = 1): Promise<TMDBResponse<TVShow>> {
  return fetchTMDB<TMDBResponse<TVShow>>('/tv/airing_today', { page: String(page) });
}

export async function getGenreById(genreId: number): Promise<Genre | null> {
  const genres = await getGenres();
  return genres.find((g) => g.id === genreId) || null;
}

export async function getTVGenres(): Promise<Genre[]> {
  const data = await fetchTMDB<GenreListResponse>('/genre/tv/list', { language: 'en-US' });
  return data.genres;
}

export async function getTVGenreById(genreId: number): Promise<Genre | null> {
  const genres = await getTVGenres().catch(() => []);
  return genres.find((g) => g.id === genreId) || null;
}

export async function getTVShowsByGenre(
  genreId: number,
  page: number = 1,
  sortBy: string = 'popularity.desc'
): Promise<TMDBResponse<TVShow>> {
  return discoverTVShows(page, sortBy, genreId);
}

export async function discoverTVShows(
  page: number = 1,
  sortBy: string = 'popularity.desc',
  genreId?: number,
  withOriginalLanguage?: string
): Promise<TMDBResponse<TVShow>> {
  // Normalize sort_by for TV shows (TMDB /discover/tv uses first_air_date, not release_date)
  let normalizedSort = sortBy;
  if (sortBy === 'release_date.desc') normalizedSort = 'first_air_date.desc';
  if (sortBy === 'release_date.asc') normalizedSort = 'first_air_date.asc';
  if (sortBy === 'revenue.desc') normalizedSort = 'popularity.desc';

  const params: Record<string, string> = {
    page: String(page),
    sort_by: normalizedSort,
  };
  if (genreId) {
    params.with_genres = String(genreId);
  }
  if (withOriginalLanguage) {
    params.with_original_language = withOriginalLanguage.toLowerCase();
  }
  return fetchTMDB<TMDBResponse<TVShow>>('/discover/tv', params);
}
/**
 * Preload images in the browser background cache for instant rendering
 */
export function prefetchImages(items: (Movie | TVShow | string)[], maxCount: number = 8): void {
  if (typeof window === 'undefined' || !items || !Array.isArray(items)) return;
  const targetItems = items.slice(0, maxCount);
  targetItems.forEach((item) => {
    if (!item) return;
    const path = typeof item === 'string' ? item : item.poster_path || item.backdrop_path;
    if (path) {
      const url = getImageUrl(path, 'w342');
      const img = new window.Image();
      img.src = url;
    }
  });
}

export interface TMDBImageItem {
  aspect_ratio: number;
  file_path: string;
  height: number;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
  width: number;
}

export interface TMDBImagesResponse {
  id: number;
  backdrops: TMDBImageItem[];
  posters: TMDBImageItem[];
  logos?: TMDBImageItem[];
}

/**
 * Fetches all available images (backdrops & posters) from TMDB for a movie or TV show.
 * Includes all language options including "no language" / textless (xx/null), en, id, etc.
 */
export async function getMediaImages(
  id: number,
  type: 'movie' | 'tv' = 'movie',
  includeImageLanguage: string = 'en,id,null,xx'
): Promise<TMDBImagesResponse | null> {
  try {
    return await fetchTMDB<TMDBImagesResponse>(`/${type}/${id}/images`, {
      include_image_language: includeImageLanguage,
    });
  } catch (e) {
    console.warn(`TMDB getMediaImages error for ${type} ${id}:`, e);
    return null;
  }
}


