import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { MovieDetail } from '@/types/tmdb';
import { getMovieDetails, getImageUrl, searchMovies, getTMDBBasicMeta } from '@/lib/tmdb';
import siteConfig, { FeaturedItem } from '@/config';
import { cleanVideoUrl, getMovieUrl } from '@/lib/urls';
import { getMongoMovieBySlug, getMongoMovies } from '@/lib/mongodb/service';
import { isMongoConfigured } from '@/lib/mongodb/client';
import * as React from 'react';
import { memoryCache } from '@/lib/cache';

const reactCache: <T extends (...args: any[]) => any>(fn: T) => T = (React as any).cache || ((fn: any) => fn);

export interface CustomMovieFrontmatter {
  title?: string;
  tmdb_id: number | string;
  rating?: number | string;
  deskripsi?: string;
  description?: string;
  videourl?: string;
  video_url?: string;
  image_url?: string;
  tagline?: string;
  featured?: boolean | string;
  subtitle?: string;
  subtitles?: any;
  subtitle_url?: string;
  sub_url?: string;
  caption_url?: string;
  [key: string]: any;
}

export interface CustomMovieData {
  slug: string; // e.g. "movie" or "movie.md"
  filename: string;
  frontmatter: CustomMovieFrontmatter;
  contentHtml: string;
  rawContent?: string;
}

export interface MergedMovieDetail extends MovieDetail {
  isCustomMarkdown?: boolean;
  customSlug?: string;
  customVideoUrl?: string | null;
  customImageUrl?: string | null;
  customSubtitles?: any;
  customContentHtml?: string | null;
}

import { STATIC_MOVIE_FILES } from '@/lib/staticContentRegistry';

const CONTENT_DIR = path.join(process.cwd(), 'video');

/**
 * Ensures the video/ content directory exists.
 */
function ensureContentDirExists(): void {
  try {
    if (fs && typeof fs.existsSync === 'function' && !fs.existsSync(CONTENT_DIR)) {
      fs.mkdirSync(CONTENT_DIR, { recursive: true });
    }
  } catch {}
}

export function getRawMovieFileContent(file: string): string | null {
  try {
    const filePath = path.join(CONTENT_DIR, file);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {}

  const base = path.basename(file);
  const key1 = `video/${base}`;
  const key2 = `video\\${base}`;
  return (
    STATIC_MOVIE_FILES[key1] ||
    STATIC_MOVIE_FILES[key2] ||
    STATIC_MOVIE_FILES[file] ||
    null
  );
}

/**
 * Gets all markdown files from the `video/` directory on local disk with fallback to static registry.
 */
export function getAllCustomMovieFiles(): string[] {
  let files: string[] = [];
  try {
    ensureContentDirExists();
    if (fs && typeof fs.existsSync === 'function' && fs.existsSync(CONTENT_DIR)) {
      const dirFiles = fs.readdirSync(CONTENT_DIR);
      files = dirFiles.filter(
        (file) =>
          (file.endsWith('.md') || file.endsWith('.markdown')) &&
          !file.startsWith('.') &&
          file.replace(/\.(md|markdown)$/i, '').trim().length > 0
      );
    }
  } catch (error) {
    // Cloudflare Workers / Edge
  }

  if (files.length === 0 && typeof STATIC_MOVIE_FILES === 'object') {
    files = Object.keys(STATIC_MOVIE_FILES).map((k) => path.basename(k));
  }

  return files;
}

export async function getAllCustomMovieFilesAsync(): Promise<string[]> {
  try {
    const mongoDocs = await getMongoMovies();
    if (mongoDocs && mongoDocs.length > 0) {
      const mongoFiles = mongoDocs
        .filter((m) => m.slug && m.slug.trim().length > 0)
        .map((m) => `${m.slug}.md`);
      const localFiles = getAllCustomMovieFiles();
      return Array.from(new Set([...mongoFiles, ...localFiles]));
    }
  } catch {}

  return getAllCustomMovieFiles();
}

/**
 * Converts text into URL slug for route matching.
 */
function cleanSlug(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns all possible slugs for static path generation.
 * Generates combinations of: filename, filename.md, tmdb_id, title slug, title-year slug, and title-id slug.
 */
export function getAllCustomMovieSlugs(): string[] {
  const files = getAllCustomMovieFiles();
  const slugs: string[] = [];

  files.forEach((file) => {
    const baseSlug = file.replace(/\.(md|markdown)$/i, '').trim();
    if (baseSlug) {
      slugs.push(baseSlug);
      slugs.push(file);
    }

    try {
      const filePath = path.join(CONTENT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);
      if (data) {
        if (data.tmdb_id) {
          slugs.push(String(data.tmdb_id));
        }
        if (data.title) {
          const titleSlug = cleanSlug(data.title);
          if (titleSlug) {
            slugs.push(titleSlug);
            const year = data.year || (data.release_date ? data.release_date.slice(0, 4) : undefined);
            if (year) {
              slugs.push(`${titleSlug}-${year}`);
            }
            if (data.tmdb_id) {
              slugs.push(`${titleSlug}-${data.tmdb_id}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${file} for slugs:`, error);
    }
  });

  // Include featured items from siteConfig to ensure instant static/ISR generation
  if (siteConfig.featuredItems && Array.isArray(siteConfig.featuredItems)) {
    siteConfig.featuredItems.forEach((item) => {
      if (item.type === 'movie' || !item.type) {
        if (item.tmdbId) slugs.push(String(item.tmdbId));
        if (item.title) {
          const tSlug = cleanSlug(item.title);
          if (tSlug) {
            slugs.push(tSlug);
            const year = item.year || '2026';
            slugs.push(`${tSlug}-${year}`);
            if (item.tmdbId) slugs.push(`${tSlug}-${item.tmdbId}`);
          }
        }
      }
    });
  }

  return Array.from(new Set(slugs));
}

export async function getAllCustomMovieSlugsAsync(): Promise<string[]> {
  const slugsSet = new Set<string>(getAllCustomMovieSlugs());
  if (isMongoConfigured()) {
    try {
      const mongoDocs = await getMongoMovies();
      for (const m of mongoDocs) {
        if (m.slug) {
          slugsSet.add(m.slug);
          slugsSet.add(`${m.slug}.md`);
        }
        if (m.tmdb_id) {
          slugsSet.add(String(m.tmdb_id));
        }
        if (m.title) {
          const tSlug = cleanSlug(m.title);
          if (tSlug) {
            slugsSet.add(tSlug);
            slugsSet.add(`${tSlug}-2026`);
            if (m.tmdb_id) {
              slugsSet.add(`${tSlug}-${m.tmdb_id}`);
            }
          }
        }
      }
    } catch {}
  }
  return Array.from(slugsSet);
}

/**
 * Gets a mapping of TMDB IDs to their custom markdown movie slugs.
 */
export function getCustomMovieTmdbMapping(): Record<string, string> {
  const files = getAllCustomMovieFiles();
  const mapping: Record<string, string> = {};

  files.forEach((file) => {
    try {
      const fileContent = getRawMovieFileContent(file);
      if (fileContent) {
        const { data } = matter(fileContent);
        if (data && data.tmdb_id) {
          mapping[String(data.tmdb_id)] = file;
        }
      }
    } catch (e) {
      console.error(`Error parsing mapping for ${file}:`, e);
    }
  });

  return mapping;
}

export function getCustomMovieSlugsByTmdbId(): Record<number, string> {
  const files = getAllCustomMovieFiles();
  const mapping: Record<number, string> = {};

  files.forEach((file) => {
    try {
      const fileContent = getRawMovieFileContent(file);
      if (fileContent) {
        const { data } = matter(fileContent);
        if (data && data.tmdb_id) {
          const baseSlug = file.replace(/\.(md|markdown)$/i, '');
          mapping[Number(data.tmdb_id)] = baseSlug;
        }
      }
    } catch (error) {
      console.error(`Error reading ${file} for TMDB ID mapping:`, error);
    }
  });

  return mapping;
}

/**
 * Finds and parses a custom markdown movie by its slug, title slug, title-year, trailing ID, or tmdb_id.
 * PRIORITY 1: MongoDB (Live Cloud Database)
 * PRIORITY 2: Local Disk / Static Registry Fallback
 */
export async function getCustomMovieBySlug(slugOrId: string | number): Promise<CustomMovieData | null> {
  const cacheKey = `custom_movie_by_slug_${String(slugOrId).trim().toLowerCase()}`;
  return memoryCache.getOrFetch<CustomMovieData | null>(
    cacheKey,
    async () => {
      const searchKey = String(slugOrId).trim().toLowerCase();
      const cleanKey = searchKey.replace(/\.(md|markdown)$/i, '');
      const isNumeric = /^\d+$/.test(cleanKey);

      // ── 1. PRIMARY: Check MongoDB first (Cloud Database as Single Source of Truth) ──
      if (isMongoConfigured()) {
        try {
          const mongoDoc = await getMongoMovieBySlug(slugOrId);
          if (mongoDoc) {
            const frontmatter: CustomMovieFrontmatter = {
              title: mongoDoc.title,
              tmdb_id: mongoDoc.tmdb_id,
              rating: mongoDoc.rating,
              deskripsi: mongoDoc.deskripsi,
              videourl: mongoDoc.videourl,
              image_url: mongoDoc.image_url,
              featured: mongoDoc.featured,
              trending: mongoDoc.trending,
              language: mongoDoc.language,
              weight: mongoDoc.weight,
              subtitles: mongoDoc.subtitles,
              duration: mongoDoc.duration,
            };
            const contentHtml = mongoDoc.content ? ((await marked.parse(mongoDoc.content)) as string) : '';
            return {
              slug: mongoDoc.slug,
              filename: `${mongoDoc.slug}.md`,
              frontmatter,
              contentHtml,
              rawContent: mongoDoc.content || '',
            };
          }

          // If MongoDB is configured and populated, do not fall back to disk/static files.
          // This prevents deleted movies from resurrecting on movie detail pages.
          const mongoAll = await getMongoMovies().catch(() => []);
          if (mongoAll.length > 0) {
            return null;
          }
        } catch (mErr) {
          console.warn('[markdownMovies] MongoDB getCustomMovieBySlug notice:', mErr);
        }
      }

      // ── 2. FALLBACK: Check Local Disk / Static Registry only if MongoDB is empty or not configured ──
      ensureContentDirExists();
      const idMatch = cleanKey.match(/-(\d{4,})$/);
      const trailingId = idMatch ? idMatch[1] : null;
      const cleanWithoutSuffix = cleanKey.replace(/-(19\d{2}|20\d{2}|\d{4,})$/, '');

      const files = getAllCustomMovieFiles();
      let matchedFile: string | null = null;
      let fileContent = '';

      // A. Direct filename or slug exact match (e.g. "mutiny.md", "mutiny-2026", "movie.md")
      for (const file of files) {
        const fileWithoutExt = file.replace(/\.(md|markdown)$/i, '').toLowerCase();
        const fullFileName = file.toLowerCase();

        if (fullFileName === searchKey || fileWithoutExt === cleanKey || (!isNumeric && fileWithoutExt === cleanWithoutSuffix)) {
          matchedFile = file;
          break;
        }
      }

      if (matchedFile) {
        fileContent = getRawMovieFileContent(matchedFile) || '';
      }

      // B. Match by frontmatter tmdb_id, exact title slug, or title-year slug across local files
      if (!matchedFile || !fileContent) {
        for (const file of files) {
          try {
            const rawContent = getRawMovieFileContent(file);
            if (!rawContent) continue;

            const parsed = matter(rawContent);
            const data = parsed.data as CustomMovieFrontmatter;

            if (data) {
              const tmdbIdStr = String(data.tmdb_id || '').trim();
              const titleSlug = cleanSlug(data.title);

              // If searchKey is a numeric TMDB ID (e.g. "533535" or "1288445")
              if (isNumeric) {
                if (tmdbIdStr === cleanKey) {
                  matchedFile = file;
                  fileContent = rawContent;
                  break;
                }
                continue;
              }

              // Direct TMDB ID match or trailing ID match (e.g. "mutiny-1288445" -> tmdb_id 1288445)
              if (tmdbIdStr && (tmdbIdStr === cleanKey || (trailingId && tmdbIdStr === trailingId))) {
                matchedFile = file;
                fileContent = rawContent;
                break;
              }

              // Exact title slug match (e.g. "mutiny" === "mutiny" or "mutiny-2026" === "mutiny-2026")
              if (titleSlug) {
                const year = data.year || (data.release_date ? data.release_date.slice(0, 4) : undefined);
                if (
                  titleSlug === cleanKey ||
                  titleSlug === cleanWithoutSuffix ||
                  (year && cleanKey === `${titleSlug}-${year}`) ||
                  (tmdbIdStr && cleanKey === `${titleSlug}-${tmdbIdStr}`)
                ) {
                  matchedFile = file;
                  fileContent = rawContent;
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`Error reading ${file}:`, err);
          }
        }
      }

      if (matchedFile && fileContent) {
        const { data, content } = matter(fileContent);
        const frontmatter = data as CustomMovieFrontmatter;
        const contentHtml = await marked.parse(content || '');

        return {
          slug: matchedFile.replace(/\.(md|markdown)$/i, ''),
          filename: matchedFile,
          frontmatter,
          contentHtml,
          rawContent: content,
        };
      }

      return null;
    },
    60_000,
    15_000
  );
}

/**
 * Fetches movie details and merges TMDB API baseline data with custom markdown overrides.
 * Supports dual-routing: ID (1288445), title-year (mutiny-2026), and title-id slug (mutiny-1288445).
 * Cached with React cache() to deduplicate requests between generateMetadata and Page.
 */
export const getMovieDetailsWithCustomOverride = reactCache(async function getMovieDetailsWithCustomOverride(
  slugOrId: string | number
): Promise<MergedMovieDetail | null> {
  const cacheKey = `movie_detail_override_${String(slugOrId).trim().toLowerCase()}`;
  return memoryCache.getOrFetch<MergedMovieDetail | null>(
    cacheKey,
    async () => {
      let customMovie = await getCustomMovieBySlug(slugOrId);

  let tmdbId: number | null = null;

  if (customMovie && customMovie.frontmatter.tmdb_id) {
    const parsedId = Number(customMovie.frontmatter.tmdb_id);
    if (!isNaN(parsedId) && parsedId > 0) {
      tmdbId = parsedId;
    }
  }

  // If no tmdbId from direct custom movie match, resolve tmdbId from slugOrId
  if (!tmdbId || isNaN(tmdbId)) {
    const str = String(slugOrId).trim();
    if (/^\d+$/.test(str)) {
      tmdbId = Number(str);
    } else {
      const yearMatch = str.match(/-(19\d{2}|20\d{2})$/);
      const explicitIdMatch = str.match(/-tmdb-(\d+)$/i) || str.match(/-(\d{5,})$/);

      if (explicitIdMatch && !yearMatch) {
        tmdbId = Number(explicitIdMatch[1]);
      } else {
        const cleanSearch = (yearMatch ? str.slice(0, yearMatch.index) : str).replace(/-/g, ' ');
        const searchYear = yearMatch ? yearMatch[1] : undefined;
        try {
          const searchRes = await searchMovies(cleanSearch);
          if (searchRes.results && searchRes.results.length > 0) {
            const matched = searchYear
              ? searchRes.results.find((m) => m.release_date && m.release_date.startsWith(searchYear)) || searchRes.results[0]
              : searchRes.results[0];
            tmdbId = matched ? matched.id : null;
          }
        } catch (e) {
          console.warn(`Error searching TMDB for movie slug ${str}:`, e);
        }
      }
    }
  }

  // If customMovie wasn't found by slug directly, but tmdbId was resolved,
  // check if there is an existing custom markdown movie with this tmdb_id!
  if (!customMovie && tmdbId) {
    customMovie = await getCustomMovieBySlug(tmdbId);
  }

  if (!tmdbId || isNaN(tmdbId)) {
    if (customMovie) {
      const { frontmatter, contentHtml } = customMovie;
      return {
        id: 0,
        title: frontmatter.title || customMovie.slug,
        tagline: frontmatter.tagline || '',
        overview: (frontmatter.deskripsi || frontmatter.description || '').trim(),
        poster_path: frontmatter.poster_path || null,
        backdrop_path: frontmatter.backdrop_url || null,
        release_date: frontmatter.year ? `${frontmatter.year}-01-01` : '2026-01-01',
        vote_average: frontmatter.rating ? Number(frontmatter.rating) : 0,
        vote_count: 0,
        genres: [],
        runtime: 120,
        credits: { cast: [], crew: [] },
        videos: { results: [] },
        similar: { page: 1, results: [], total_pages: 0, total_results: 0 },
        isCustomMarkdown: true,
        customSlug: customMovie.slug,
        customVideoUrl: cleanVideoUrl(frontmatter.videourl || frontmatter.video_url),
        customImageUrl: frontmatter.image_url || null,
        customSubtitles: frontmatter.subtitles || null,
        customContentHtml: contentHtml && contentHtml.trim().length > 0 ? contentHtml : null,
      } as any;
    }
    return null;
  }

  // Fetch full baseline data from TMDB API
  const tmdbMovie = await getMovieDetails(tmdbId);
  if (!tmdbMovie) {
    if (customMovie) {
      const { frontmatter, contentHtml } = customMovie;
      return {
        id: tmdbId,
        title: frontmatter.title || customMovie.slug,
        tagline: frontmatter.tagline || '',
        overview: (frontmatter.deskripsi || frontmatter.description || '').trim(),
        poster_path: frontmatter.poster_path || null,
        backdrop_path: frontmatter.backdrop_url || null,
        release_date: frontmatter.year ? `${frontmatter.year}-01-01` : '2026-01-01',
        vote_average: frontmatter.rating ? Number(frontmatter.rating) : 0,
        vote_count: 0,
        genres: [],
        runtime: 120,
        credits: { cast: [], crew: [] },
        videos: { results: [] },
        similar: { page: 1, results: [], total_pages: 0, total_results: 0 },
        isCustomMarkdown: true,
        customSlug: customMovie.slug,
        customVideoUrl: cleanVideoUrl(frontmatter.videourl || frontmatter.video_url),
        customImageUrl: frontmatter.image_url || null,
        customSubtitles: frontmatter.subtitles || null,
        customContentHtml: contentHtml && contentHtml.trim().length > 0 ? contentHtml : null,
      } as any;
    }
    return null;
  }

  // If no custom markdown file is associated, return baseline TMDB details
  if (!customMovie) {
    return {
      ...tmdbMovie,
      isCustomMarkdown: false,
      customVideoUrl: null,
      customContentHtml: null,
    };
  }

  const { frontmatter, contentHtml } = customMovie;

  // Merge overrides from markdown frontmatter
  const overriddenTitle = frontmatter.title && frontmatter.title.trim() !== ''
    ? frontmatter.title
    : tmdbMovie.title;

  const overriddenRating = frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== ''
    ? Number(frontmatter.rating)
    : tmdbMovie.vote_average;

  const overriddenOverview = (frontmatter.deskripsi || frontmatter.description)?.trim() || tmdbMovie.overview;

  const overriddenTagline = frontmatter.tagline?.trim() || tmdbMovie.tagline;

  const videoUrl = cleanVideoUrl(frontmatter.videourl || frontmatter.video_url);
  const imageUrl = frontmatter.image_url || null;
  const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;

  // Poster and backdrop strictly use TMDB or explicit custom poster fields, NOT image_url (which is reserved for player/generic content)
  const overriddenPoster = (frontmatter.poster_path ? frontmatter.poster_path : tmdbMovie.poster_path) || null;
  const overriddenBackdrop = (frontmatter.backdrop_url ? frontmatter.backdrop_url : tmdbMovie.backdrop_path) || null;
  const overriddenReleaseDate = frontmatter.year ? `${frontmatter.year}-01-01` : (frontmatter.release_date || tmdbMovie.release_date);
  const overriddenRuntime = frontmatter.duration ? (typeof frontmatter.duration === 'number' ? frontmatter.duration : tmdbMovie.runtime) : tmdbMovie.runtime;

  return {
    ...tmdbMovie,
    title: overriddenTitle,
    vote_average: overriddenRating,
    overview: overriddenOverview,
    tagline: overriddenTagline,
    release_date: overriddenReleaseDate,
    runtime: overriddenRuntime,
    poster_path: overriddenPoster,
    backdrop_path: overriddenBackdrop,
    isCustomMarkdown: true,
    customSlug: customMovie.slug,
    customVideoUrl: videoUrl,
    customImageUrl: imageUrl,
    customSubtitles: subtitles,
    customContentHtml: contentHtml && contentHtml.trim().length > 0 ? contentHtml : null,
  };
    },
    60_000,
    15_000
  );
});

/**
 * Returns all custom markdown movies that have `featured: true` in their frontmatter.
 * Sourced directly from MongoDB with fallback to local files.
 */
export async function getAllFeaturedCustomMovies(): Promise<FeaturedItem[]> {
  return memoryCache.getOrFetch<FeaturedItem[]>(
    'featured_custom_movies_list',
    async () => {
      try {
        let movieDocs: any[] = [];
        if (isMongoConfigured()) {
          const mongoMovies = await getMongoMovies().catch(() => []);
          if (mongoMovies && mongoMovies.length > 0) {
            movieDocs = mongoMovies.filter((m) => Boolean(m.featured));
          }
        }

        // Fallback to local files only if MongoDB is empty or unconfigured
        if (movieDocs.length === 0 && !isMongoConfigured()) {
          ensureContentDirExists();
          const files = getAllCustomMovieFiles();
          const diskMovies = files
            .map((file) => {
              try {
                const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
                const { data } = matter(raw);
                return {
                  slug: file.replace(/\.(md|markdown)$/i, ''),
                  tmdb_id: Number(data.tmdb_id) || 0,
                  title: data.title || file.replace(/\.(md|markdown)$/i, ''),
                  videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
                  image_url: data.image_url || data.poster_path || '',
                  deskripsi: data.deskripsi || data.overview || '',
                  rating: Number(data.rating) || 0,
                  featured: Boolean(data.featured),
                  trending: Boolean(data.trending),
                  language: data.language ? String(data.language).trim().toUpperCase() : 'ID',
                  weight: data.weight !== undefined && data.weight !== null ? Number(data.weight) : undefined,
                  createdAt: 0,
                  updatedAt: 0,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean) as any[];

          movieDocs = diskMovies.filter((m) => Boolean(m.featured));
        }

        const mappedItems = await Promise.all(
          movieDocs.map(async (m) => {
            let overview = (m.deskripsi || (m as any).description || '').trim();
            let rating = m.rating || 0;
            let genres: string[] = [];
            let posterUrl = m.image_url ? getImageUrl(m.image_url, 'w500') : '/placeholder-poster.svg';
            let backdropUrl = m.image_url ? getImageUrl(m.image_url, 'original') : '/placeholder-poster.svg';
            let logoUrl: string | undefined = undefined;
            let trailerKey: string | undefined = undefined;

            if (m.tmdb_id) {
              try {
                const tmdbId = Number(m.tmdb_id);
                const tmdb = await memoryCache.getOrFetch(
                  `admin_tmdb_movie_${tmdbId}`,
                  () => getMovieDetails(tmdbId).catch(() => null),
                  3600_000,
                  600_000
                );
                if (tmdb) {
                  if (tmdb.backdrop_path) {
                    backdropUrl = getImageUrl(tmdb.backdrop_path, 'original');
                  } else if (backdropUrl === '/placeholder-poster.svg' && tmdb.poster_path) {
                    backdropUrl = getImageUrl(tmdb.poster_path, 'original');
                  }
                  if (tmdb.poster_path) {
                    posterUrl = getImageUrl(tmdb.poster_path, 'w500');
                  }
                  const bestLogo = tmdb.images?.logos?.find((l) => l.iso_639_1 === 'en' || l.iso_639_1 === 'id' || !l.iso_639_1) || tmdb.images?.logos?.[0];
                  if (bestLogo?.file_path) {
                    logoUrl = getImageUrl(bestLogo.file_path, 'original');
                  }
                  const trailer = tmdb.videos?.results?.find((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || tmdb.videos?.results?.find((v) => v.site === 'YouTube');
                  if (trailer?.key) {
                    trailerKey = trailer.key;
                  }
                  if (!overview && tmdb.overview) overview = tmdb.overview;
                  if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
                  if (tmdb.genres) genres = tmdb.genres.map((g) => g.name);
                }
              } catch {}
            }

            return {
              id: `movie-${m.slug}`,
              tmdbId: m.tmdb_id || 0,
              title: m.title || m.slug,
              tagline: undefined,
              overview: overview || 'Tonton film ini dengan kualitas terbaik di LeviStream.',
              backdropUrl,
              posterUrl,
              logoUrl,
              trailerKey,
              rating: rating || 8.5,
              year: '2026',
              duration: m.duration || undefined,
              type: 'movie' as const,
              genres,
              link: `/movie/${m.slug}`,
              badge: 'Featured',
              featured: true,
              trending: Boolean(m.trending),
              language: m.language ? String(m.language).trim().toUpperCase() : 'ID',
              isCustom: true,
            } as FeaturedItem;
          })
        );

        // Deduplicate
        const seen = new Set<string>();
        const uniqueItems: FeaturedItem[] = [];
        for (const item of mappedItems) {
          const key = String(item.tmdbId || item.id || item.title || '').toLowerCase().trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueItems.push(item);
          }
        }
        return uniqueItems;
      } catch (err) {
        console.warn('[markdownMovies] getAllFeaturedCustomMovies error:', err);
        return [];
      }
    },
    60_000,
    15_000
  );
}

/**
 * Returns all custom movies formatted as Movie objects for display in homepage rows and grids.
 * Directly sourced from MongoDB when configured.
 */
export async function getAllCustomMoviesForList(): Promise<any[]> {
  return memoryCache.getOrFetch<any[]>(
    'custom_movies_for_list',
    async () => {
      try {
        let movieDocs: any[] = [];

        if (isMongoConfigured()) {
          const mongoMovies = await getMongoMovies().catch(() => []);
          if (mongoMovies && mongoMovies.length > 0) {
            movieDocs = mongoMovies;
          }
        }

        // Fallback to local files only if MongoDB is genuinely not configured
        if (movieDocs.length === 0 && !isMongoConfigured()) {
          ensureContentDirExists();
          const files = getAllCustomMovieFiles();
          const diskMovies: any[] = [];
          for (const file of files) {
            const slug = file.replace(/\.(md|markdown)$/i, '');
            try {
              const fullPath = path.join(CONTENT_DIR, file);
              const raw = fs.readFileSync(fullPath, 'utf8');
              let fileTime = 0;
              try {
                const stat = fs.statSync(fullPath);
                fileTime = stat.mtimeMs || stat.birthtimeMs || 0;
              } catch {}
              const { data } = matter(raw);
              diskMovies.push({
                slug,
                tmdb_id: Number(data.tmdb_id) || 0,
                title: data.title || slug,
                videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
                image_url: data.image_url || data.poster_path || '',
                deskripsi: data.deskripsi || data.overview || '',
                rating: Number(data.rating) || 0,
                featured: Boolean(data.featured),
                trending: Boolean(data.trending),
                language: data.language ? String(data.language).trim().toUpperCase() : 'ID',
                weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : undefined,
                createdAt: Number(data.createdAt) || fileTime,
                updatedAt: Number(data.updatedAt) || Number(data.createdAt) || fileTime,
              });
            } catch {}
          }
          movieDocs = diskMovies;
        }

        return await Promise.all(
          movieDocs.map(async (m) => {
            let poster: string | null = null;
            let backdrop: string | null = null;
            let rating = Number(m.rating) || 0;
            let overview = m.deskripsi || '';
            let genreIds: number[] = [];
            let releaseDate = '2026-01-01';

            if (m.tmdb_id) {
              try {
                const tmdb = await getTMDBBasicMeta('movie', Number(m.tmdb_id));
                if (tmdb) {
                  // Default poster from TMDB API
                  if (tmdb.poster_path) poster = tmdb.poster_path;
                  if (tmdb.backdrop_path) backdrop = tmdb.backdrop_path;
                  if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
                  if (!overview && tmdb.overview) overview = tmdb.overview;
                  if (tmdb.release_date) releaseDate = tmdb.release_date;
                  if (Array.isArray(tmdb.genres)) genreIds = tmdb.genres.map((g) => g.id);
                }
              } catch {}
            }

            // Fallback for poster & backdrop if TMDB didn't return one
            if (!poster && m.image_url) {
              poster = m.image_url;
            }
            if (!backdrop && m.image_url) {
              backdrop = m.image_url;
            }

            return {
              id: m.tmdb_id || m.slug,
              title: m.title || m.slug,
              overview,
              poster_path: poster,
              backdrop_path: backdrop,
              release_date: releaseDate,
              vote_average: rating,
              vote_count: 0,
              genre_ids: genreIds,
              popularity: 100,
              adult: false,
              video: false,
              isCustomMarkdown: true,
              media_type: 'movie',
              customSlug: m.slug,
              customVideoUrl: m.videourl,
              customImageUrl: m.image_url || null,
              featured: Boolean(m.featured),
              trending: Boolean(m.trending),
              language: m.language ? String(m.language).trim().toUpperCase() : 'ID',
              weight: m.weight !== undefined && m.weight !== null ? Number(m.weight) : undefined,
              updatedAt: Number(m.updatedAt) || Number(m.createdAt) || 0,
              createdAt: Number(m.createdAt) || Number(m.updatedAt) || 0,
            };
          })
        );
      } catch (err) {
        console.warn('[markdownMovies] getAllCustomMoviesForList error:', err);
        return [];
      }
    },
    60_000,
    15_000
  );
}
