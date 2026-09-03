import siteConfig, { SectionConfig } from '@/config';
import { Movie, TVShow } from '@/types/tmdb';
import { getAllCustomMoviesForList } from '@/lib/markdownMovies';
import { getAllCustomTVShowsForList } from '@/lib/markdownTV';
import {
  getTrending,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getNowPlayingMovies,
  getTopRatedMovies,
  getTopRatedTV,
  getAiringTodayTV,
  discoverMovies,
  discoverTVShows,
} from '@/lib/tmdb';
import { memoryCache } from '@/lib/cache';

export interface ResolvedSection {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  weight: number;
  limit: number;
  items: (Movie | TVShow | any)[];
  seeAllHref?: string;
}

import { normalizeLangCode } from '@/lib/language';
export { normalizeLangCode };

/**
 * Checks if an item matches the section filter criteria
 */
function matchFilter(item: any, filter?: SectionConfig['filter']): boolean {
  if (!filter) return true;

  // 1. Trending Filter
  if (filter.trending !== undefined) {
    const isTrending = Boolean(item.trending);
    if (isTrending !== filter.trending) return false;
  }

  // 2. Language Filter
  if (filter.language) {
    const itemLang = normalizeLangCode(item.language || (item.original_language ? item.original_language : 'ID'));
    if (Array.isArray(filter.language)) {
      const allowedLangs = filter.language.map(normalizeLangCode);
      if (!allowedLangs.includes(itemLang)) return false;
    } else {
      const targetLang = normalizeLangCode(filter.language);
      if (itemLang !== targetLang) return false;
    }
  }

  // 3. Featured Filter
  if (filter.featured !== undefined) {
    const isFeatured = Boolean(item.featured);
    if (isFeatured !== filter.featured) return false;
  }

  // 4. Genre ID Filter
  if (filter.genreId !== undefined) {
    const genres = item.genre_ids || [];
    if (!genres.includes(filter.genreId)) return false;
  }

  return true;
}

/**
 * Fetches TMDB fallback items based on fallback configuration
 */
async function fetchTMDBFallback(
  fallback: NonNullable<SectionConfig['fallback']>,
  page: number = 1
): Promise<(Movie | TVShow)[]> {
  try {
    const endpoint = fallback.tmdbEndpoint || 'trending';
    const isTV = fallback.tmdbType === 'tv';

    if (endpoint === 'trending') {
      if (isTV) {
        const res = await getTrendingTV('week').catch(() => null);
        return res?.results || [];
      }
      const res = await getTrending('movie', 'week').catch(() => null);
      return res?.results || [];
    }

    if (endpoint === 'discover_language') {
      const lang = (fallback.tmdbLanguage || (isTV ? 'id' : 'id')).toLowerCase();
      if (isTV) {
        const res = await discoverTVShows(page, 'popularity.desc', undefined, lang).catch(() => null);
        return res?.results || [];
      }
      const res = await discoverMovies(page, 'popularity.desc', undefined, lang).catch(() => null);
      return res?.results || [];
    }

    if (endpoint === 'now_playing') {
      const res = await getNowPlayingMovies(page).catch(() => null);
      return res?.results || [];
    }

    if (endpoint === 'popular') {
      if (isTV) {
        const res = await getPopularTV(page).catch(() => null);
        return res?.results || [];
      }
      const res = await getPopularMovies(page).catch(() => null);
      return res?.results || [];
    }

    if (endpoint === 'top_rated') {
      if (isTV) {
        const res = await getTopRatedTV(page).catch(() => null);
        return res?.results || [];
      }
      const res = await getTopRatedMovies(page).catch(() => null);
      return res?.results || [];
    }

    if (endpoint === 'airing_today') {
      const res = await getAiringTodayTV(page).catch(() => null);
      return res?.results || [];
    }

    return [];
  } catch (err) {
    console.warn('[sections] Error fetching TMDB fallback:', err);
    return [];
  }
}

/**
 * Resolves all configured sections for a specific page ('home', 'movie', 'tv').
 * Follows strict priority:
 * 1. Local/custom content filtered by frontmatter.
 * 2. If local count >= limit -> 100% Local content (no TMDB used).
 * 3. If local count < limit and fallback enabled -> TMDB fills the shortfall.
 * 4. Ordered by section weight.
 */
export async function getResolvedSections(page: 'home' | 'movie' | 'tv'): Promise<ResolvedSection[]> {
  const cacheKey = `resolved_sections_${page}`;

  return memoryCache.getOrFetch<ResolvedSection[]>(
    cacheKey,
    async () => {
      // 1. Get and filter all sections enabled for this page, sorted by weight
      const pageSections = (siteConfig.sections || [])
        .filter((sec) => sec.pages && sec.pages[page])
        .sort((a, b) => (a.weight ?? 100) - (b.weight ?? 100));

      if (pageSections.length === 0) return [];

      // 2. Fetch all local custom movies and TV shows
      const [customMovies, customTVShows] = await Promise.all([
        getAllCustomMoviesForList().catch(() => []),
        getAllCustomTVShowsForList().catch(() => []),
      ]);

      const resolvedList: ResolvedSection[] = [];

      for (const section of pageSections) {
        const limit = section.limit || 10;
        let pool: any[] = [];

        if (section.type === 'movie') {
          pool = customMovies;
        } else if (section.type === 'tv') {
          pool = customTVShows;
        } else {
          // mixed: combine movies and TV shows
          pool = [...customMovies, ...customTVShows];
        }

        // 3. Filter local items matching section filter
        const localMatching = pool.filter((item) => matchFilter(item, section.filter));

        // Deduplicate local items by id or slug
        const seenLocalKeys = new Set<string>();
        const deduplicatedLocal: any[] = [];
        for (const item of localMatching) {
          const key = String(item.id || item.customSlug || item.title);
          if (!seenLocalKeys.has(key)) {
            seenLocalKeys.add(key);
            deduplicatedLocal.push(item);
          }
        }

        // Sort local items with deterministic, multi-level ordering:
        deduplicatedLocal.sort((a, b) => {
          // 1. Explicit priority weight (smaller number = higher priority)
          const hasWA = a.weight !== undefined && a.weight !== null && a.weight !== '';
          const hasWB = b.weight !== undefined && b.weight !== null && b.weight !== '';
          if (hasWA || hasWB) {
            const wA = hasWA ? Number(a.weight) : 999999;
            const wB = hasWB ? Number(b.weight) : 999999;
            if (wA !== wB) return wA - wB;
          }

          // 2. Updated / Created timestamp (newest updated/created content first)
          const timeB = Number(b.updatedAt) || Number(b.createdAt) || 0;
          const timeA = Number(a.updatedAt) || Number(a.createdAt) || 0;
          if (timeB > 0 && timeA > 0 && timeB !== timeA) {
            return timeB - timeA;
          }
          if (timeB > 0 && timeA === 0) return -1;
          if (timeA > 0 && timeB === 0) return 1;

          // 3. Release Date / Air Date (newest release first)
          const relB = new Date(b.release_date || b.first_air_date || 0).getTime();
          const relA = new Date(a.release_date || a.first_air_date || 0).getTime();
          if (relB !== relA) {
            return relB - relA;
          }

          // 4. Stable deterministic tie-breaker: Title / Slug alphabetical
          const titleA = String(a.title || a.name || a.slug || '');
          const titleB = String(b.title || b.name || b.slug || '');
          return titleA.localeCompare(titleB);
        });

        const selectedLocal = deduplicatedLocal.slice(0, limit);
        let finalItems = [...selectedLocal];

        // 4. TMDB Fallback: (Disimpan sebagai komentar sesuai permintaan; aktifkan kembali jika sewaktu-waktu dibutuhkan)
        /*
        if (finalItems.length === 0 && section.fallback?.enabled) {
          const fallbackCandidates = await fetchTMDBFallback(section.fallback);

          // Deduplicate against local items in pool
          const existingIds = new Set(pool.map((p) => String(p.id)));

          const addedFromTMDB: (Movie | TVShow)[] = [];
          for (const cand of fallbackCandidates) {
            if (addedFromTMDB.length >= limit) break;
            const candId = String(cand.id);
            if (!existingIds.has(candId)) {
              existingIds.add(candId);
              addedFromTMDB.push(cand);
            }
          }

          finalItems = addedFromTMDB;
        }
        */

        // Hanya tampilkan section yang memiliki konten (jika 0 konten, section otomatis disembunyikan)
        if (finalItems.length > 0) {
          const displayType: 'movie' | 'tv' =
            section.type === 'tv'
              ? 'tv'
              : section.type === 'movie'
              ? 'movie'
              : finalItems.some((i) => i.media_type === 'tv' || i.isCustomTV)
              ? 'tv'
              : 'movie';

          resolvedList.push({
            id: section.id,
            title: section.title,
            type: displayType,
            weight: section.weight,
            limit: section.limit,
            items: finalItems,
            seeAllHref: section.seeAllHref,
          });
        }
      }

      return resolvedList;
    },
    30_000,
    10_000
  );
}
