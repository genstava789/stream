import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Movie, TVShow } from '@/types/tmdb';
import { getImageUrl, getMovieDetails, getTVShowDetails } from '@/lib/tmdb';
import { getAllFeaturedCustomMovies } from '@/lib/markdownMovies';
import { getAllFeaturedCustomTV } from '@/lib/markdownTV';
import siteConfig, { FeaturedItem } from '@/config';
import { getMovieUrl, getTVUrl } from '@/lib/urls';
import { memoryCache } from '@/lib/cache';
import { serializeTinaMovie, serializeTinaTVShow } from '@/lib/tina/schema';
import { isMongoConfigured } from '@/lib/mongodb/client';
import { saveMongoMovie, saveMongoTVShow, getMongoMovies, getMongoTVShows } from '@/lib/mongodb/service';
import { STATIC_MOVIE_FILES, STATIC_TV_FILES } from '@/lib/staticContentRegistry';

const VIDEO_DIR = path.join(process.cwd(), 'video');
const TV_DIR = path.join(process.cwd(), 'tv');

export function normalizeTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export interface GetFeaturedOptions {
  maxItems?: number;
}

/**
 * Automatically enforces the featured limit:
 * If the number of items with `featured: true` exceeds `limit` (default: 7),
 * the newest items are retained as featured, and older items are demoted to `featured: false`.
 * Updates both disk markdown files and MongoDB to keep data in sync.
 */
export async function enforceFeaturedLimit(type: 'movie' | 'tv', limit: number = siteConfig.featuredLimit || 7): Promise<void> {
  try {
    if (type === 'movie') {
      const featuredMovies = await getAllFeaturedCustomMovies().catch(() => []);
      if (featuredMovies.length > limit) {
        const excessItems = featuredMovies.slice(limit);
        for (const item of excessItems) {
          const slug = String(item.id || '').replace(/^movie-/, '');
          if (!slug) continue;

          // 1. Update file on disk if exists
          try {
            const filePath = path.join(VIDEO_DIR, `${slug}.md`);
            if (fs && typeof fs.existsSync === 'function' && fs.existsSync(filePath)) {
              const raw = fs.readFileSync(filePath, 'utf8');
              const { data, content } = matter(raw);
              data.featured = false;
              const updatedContent = serializeTinaMovie(data, content);
              fs.writeFileSync(filePath, updatedContent, 'utf8');
            }
          } catch (e) {
            // Edge runtime / Cloudflare Workers
          }

          // 2. Update MongoDB if configured
          if (isMongoConfigured()) {
            await saveMongoMovie({ slug, featured: false }).catch(() => {});
          }
        }
        memoryCache.invalidate('featured_');
        memoryCache.invalidate('custom_movies_');
        memoryCache.invalidate('resolved_sections_');
      }
    } else if (type === 'tv') {
      const featuredTV = await getAllFeaturedCustomTV().catch(() => []);
      if (featuredTV.length > limit) {
        const excessItems = featuredTV.slice(limit);
        for (const item of excessItems) {
          const showSlug = String(item.id || '').replace(/^tv-/, '');
          if (!showSlug) continue;

          // 1. Update file on disk if exists
          try {
            const indexPath = path.join(TV_DIR, showSlug, '_index.md');
            if (fs && typeof fs.existsSync === 'function' && fs.existsSync(indexPath)) {
              const raw = fs.readFileSync(indexPath, 'utf8');
              const { data, content } = matter(raw);
              data.featured = false;
              const updatedContent = serializeTinaTVShow(data, content);
              fs.writeFileSync(indexPath, updatedContent, 'utf8');
            }
          } catch (e) {
            // Edge runtime / Cloudflare Workers
          }

          // 2. Update MongoDB if configured
          if (isMongoConfigured()) {
            await saveMongoTVShow({ showSlug, featured: false }).catch(() => {});
          }
        }
        memoryCache.invalidate('featured_');
        memoryCache.invalidate('custom_tv_');
        memoryCache.invalidate('resolved_sections_');
      }
    }
  } catch (err) {
    console.warn(`[featured] Error enforcing featured limit for ${type}:`, err);
  }
}

/**
 * Loads Featured Hero MOVIES for Home Page:
 * Sourced from custom markdown files and embedded static registry.
 */
export async function getEnrichedFeaturedMovies(options: {
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const limit = options.maxItems || siteConfig.featuredLimit || 7;
  const cacheKey = `featured_hero_movies_only_${limit}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // Enforce auto-eviction if count exceeds limit
      await enforceFeaturedLimit('movie', limit).catch(() => {});
      let customMovies = await getAllFeaturedCustomMovies().catch(() => []);

      // If customMovies is empty (e.g. on Cloudflare Workers edge isolate without fs)
      if (customMovies.length === 0 && typeof STATIC_MOVIE_FILES === 'object') {
        const staticList: FeaturedItem[] = [];
        for (const [filePath, rawContent] of Object.entries(STATIC_MOVIE_FILES)) {
          try {
            const { data } = matter(rawContent);
            if (data && (data.featured === true || String(data.featured).toLowerCase() === 'true')) {
              const tmdbId = Number(data.tmdb_id);
              const tmdbDetails = tmdbId ? await getMovieDetails(tmdbId).catch(() => null) : null;
              const slug = path.basename(filePath, '.md');
              const bestLogo = tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === 'id' || !l.iso_639_1) || tmdbDetails?.images?.logos?.[0];
              const logoUrl = bestLogo?.file_path ? getImageUrl(bestLogo.file_path, 'original') : undefined;
              const trailer = tmdbDetails?.videos?.results?.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || tmdbDetails?.videos?.results?.find((v: any) => v.site === 'YouTube');
              const trailerKey = trailer?.key || undefined;

              staticList.push({
                id: tmdbId || slug,
                tmdbId: tmdbId,
                title: data.title || tmdbDetails?.title || slug,
                tagline: data.tagline || tmdbDetails?.tagline || '',
                overview: data.deskripsi || data.description || tmdbDetails?.overview || '',
                backdropUrl: tmdbDetails?.backdrop_path ? getImageUrl(tmdbDetails.backdrop_path, 'original') : (data.image_url ? getImageUrl(data.image_url, 'original') : ''),
                posterUrl: tmdbDetails?.poster_path ? getImageUrl(tmdbDetails.poster_path, 'w500') : (data.image_url || ''),
                logoUrl,
                trailerKey,
                rating: Number(data.rating || tmdbDetails?.vote_average || 0),
                year: tmdbDetails?.release_date ? new Date(tmdbDetails.release_date).getFullYear() : '',
                duration: tmdbDetails?.runtime ? `${Math.floor(tmdbDetails.runtime / 60)}h ${tmdbDetails.runtime % 60}m` : '',
                type: 'movie',
                genres: tmdbDetails?.genres?.map((g) => g.name) || [],
                link: `/movie/${slug}`,
                badge: 'Featured Movie',
                featured: true,
                isCustom: true,
              });
            }
          } catch (e) {
            console.error('Error parsing static movie featured:', e);
          }
        }
        if (staticList.length > 0) {
          customMovies = staticList;
        }
      }

      return customMovies.slice(0, limit);
    },
    60_000,
    15_000
  );
}

/**
 * Loads Featured Hero TV SERIES for TV Page:
 * Sourced from custom markdown TV shows and embedded static registry.
 */
export async function getEnrichedFeaturedTV(options: {
  maxItems?: number;
} = {}): Promise<FeaturedItem[]> {
  const limit = options.maxItems || siteConfig.featuredLimit || 7;
  const cacheKey = `featured_hero_tv_only_${limit}`;

  return memoryCache.getOrFetch<FeaturedItem[]>(
    cacheKey,
    async () => {
      // Enforce auto-eviction if count exceeds limit
      await enforceFeaturedLimit('tv', limit).catch(() => {});
      let customTV = await getAllFeaturedCustomTV().catch(() => []);

      // If customTV is empty (e.g. on Cloudflare Workers edge isolate without fs)
      if (customTV.length === 0 && typeof STATIC_TV_FILES === 'object') {
        const staticList: FeaturedItem[] = [];
        for (const [filePath, rawContent] of Object.entries(STATIC_TV_FILES)) {
          if (!filePath.endsWith('_index.md') && !filePath.endsWith('index.md')) continue;
          try {
            const { data } = matter(rawContent);
            if (data && (data.featured === true || String(data.featured).toLowerCase() === 'true')) {
              const tmdbId = Number(data.tmdb_id);
              const showSlug = filePath.replace(/^tv[\\\/]/, '').split(/[\\\/]/)[0];
              const tmdbDetails = tmdbId ? await getTVShowDetails(tmdbId).catch(() => null) : null;
              const bestLogo = tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === 'id' || !l.iso_639_1) || tmdbDetails?.images?.logos?.[0];
              const logoUrl = bestLogo?.file_path ? getImageUrl(bestLogo.file_path, 'original') : undefined;
              const trailer = tmdbDetails?.videos?.results?.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || tmdbDetails?.videos?.results?.find((v: any) => v.site === 'YouTube');
              const trailerKey = trailer?.key || undefined;

              staticList.push({
                id: tmdbId || showSlug,
                tmdbId: tmdbId,
                title: data.title || tmdbDetails?.name || showSlug,
                tagline: data.tagline || tmdbDetails?.tagline || '',
                overview: data.deskripsi || data.description || tmdbDetails?.overview || '',
                backdropUrl: tmdbDetails?.backdrop_path ? getImageUrl(tmdbDetails.backdrop_path, 'original') : (data.image_url ? getImageUrl(data.image_url, 'original') : ''),
                posterUrl: tmdbDetails?.poster_path ? getImageUrl(tmdbDetails.poster_path, 'w500') : (data.image_url || ''),
                logoUrl,
                trailerKey,
                rating: Number(data.rating || tmdbDetails?.vote_average || 0),
                year: tmdbDetails?.first_air_date ? new Date(tmdbDetails.first_air_date).getFullYear() : '',
                type: 'tv',
                genres: tmdbDetails?.genres?.map((g) => g.name) || [],
                link: `/tv/${showSlug}`,
                badge: 'Featured Series',
                featured: true,
                isCustom: true,
              });
            }
          } catch (e) {
            console.error('Error parsing static TV featured:', e);
          }
        }
        if (staticList.length > 0) {
          customTV = staticList;
        }
      }

      return customTV.slice(0, limit);
    },
    60_000,
    15_000
  );
}

/**
 * Enriched featured items strictly sourced from custom frontmatter
 */
export async function getEnrichedFeaturedItems(options: GetFeaturedOptions = {}): Promise<FeaturedItem[]> {
  return getEnrichedFeaturedMovies({
    maxItems: options.maxItems || siteConfig.featuredLimit || 7,
  });
}



