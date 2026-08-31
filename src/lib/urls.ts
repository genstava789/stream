import siteConfig from '@/config';

/**
 * Converts a string into a clean, URL-friendly kebab-case slug.
 * Accents are normalized to base ASCII (e.g. "é" -> "e", "ñ" -> "n").
 * Symbols like &, +, @ are converted to words.
 */
export function slugify(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD') // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)/g, '') // remove parenthesized expressions like (2026), (Edition)
    .replace(/&/g, '-and-')
    .replace(/\+/g, '-plus-')
    .replace(/@/g, '-at-')
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric chars except hyphen & space
    .replace(/\s+/g, '-') // collapse spaces into hyphen
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim hyphens
}

/**
 * Generates a safe, non-empty filename slug for Movie or TV content.
 * If title contains pure non-Latin characters (like "我是哪吒") that produce an empty slug,
 * it safely falls back to `${type}-${tmdbId}` (e.g. "movie-123456" or "tv-78910").
 */
export function generateSafeContentSlug(
  title?: string | null,
  tmdbId?: number | string | null,
  type: 'movie' | 'tv' = 'movie',
  customSlug?: string | null
): string {
  if (customSlug && customSlug.trim()) {
    const s = slugify(customSlug);
    if (s) return s;
  }

  if (title && title.trim()) {
    const s = slugify(title);
    if (s) return s;
  }

  const cleanId = tmdbId ? String(tmdbId).trim() : '';
  if (cleanId && /^\d+$/.test(cleanId)) {
    return `${type}-${cleanId}`;
  }

  return `${type}-${Date.now()}`;
}

/**
 * Validates whether a given string is a valid video stream or embed URL.
 * Relaxed validation: verifies that the URL starts with https:// (or http://, //, or local path).
 */
export function isValidVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = cleanVideoUrl(url);
  if (!clean) return false;
  const trimmed = clean.trim();
  if (trimmed.length < 5) return false;

  // Simple relaxed check: must start with https://, http://, protocol-relative //, or /
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/');
}

/**
 * Returns the proper URL for a movie according to `siteConfig.useTitleSlug`.
 * Formats as: /movie/mutiny-2026
 */
export function getMovieUrl(movie: {
  id?: number | string | null;
  tmdbId?: number | string | null;
  title?: string | null;
  release_date?: string | null;
  year?: number | string | null;
  customSlug?: string | null;
  link?: string | null;
}): string {
  // If a valid custom link is directly defined (and not placeholder filenames)
  if (
    movie.link &&
    !['/movie/movie', '/movie/test', '/movie/temp', '/movie/film', '/movie/undefined'].includes(movie.link) &&
    !movie.link.startsWith('http')
  ) {
    return movie.link;
  }

  const id = movie.tmdbId || movie.id;
  const title = movie.title || '';
  const customSlug = movie.customSlug;
  const rawYear = movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : null);
  const year = rawYear && !isNaN(Number(rawYear)) ? Number(rawYear) : null;

  // Check if customSlug is a generic placeholder or filename rather than an explicit custom route
  const isGenericSlug =
    !customSlug ||
    ['movie', 'test', 'temp', 'film', 'untitled', 'custom', 'index', 'undefined'].includes(customSlug.toLowerCase().replace(/\.(md|markdown)$/i, '')) ||
    /^(movie|test|temp|film)-\d+$/i.test(customSlug) ||
    customSlug === String(id);

  if (siteConfig.useTitleSlug) {
    if (title) {
      const slug = slugify(title);
      if (slug) {
        return year ? `/movie/${slug}-${year}` : `/movie/${slug}`;
      }
    }
    if (customSlug && !isGenericSlug) {
      return `/movie/${customSlug}`;
    }
  }

  // Fallback / ID mode
  if (customSlug && !isGenericSlug) {
    return `/movie/${customSlug}`;
  }
  return id ? `/movie/${id}` : (customSlug ? `/movie/${customSlug}` : '/movie');
}

/**
 * Returns the proper URL for a TV show according to `siteConfig.useTitleSlug`.
 * Formats as: /tv/lanterns-2026
 */
export function getTVUrl(show: {
  id?: number | string | null;
  tmdbId?: number | string | null;
  name?: string | null;
  title?: string | null;
  first_air_date?: string | null;
  year?: number | string | null;
  customSlug?: string | null;
  link?: string | null;
}): string {
  if (show.link && !show.link.startsWith('http')) {
    return show.link;
  }

  const id = show.tmdbId || show.id;
  const name = show.name || show.title || '';
  const customSlug = show.customSlug;
  const rawYear = show.year || (show.first_air_date ? new Date(show.first_air_date).getFullYear() : null);
  const year = rawYear && !isNaN(Number(rawYear)) ? Number(rawYear) : null;

  const isGenericSlug =
    !customSlug ||
    customSlug === 'tv' ||
    /^tv-\d+$/i.test(customSlug) ||
    customSlug === String(id);

  if (siteConfig.useTitleSlug) {
    if (name) {
      const slug = slugify(name);
      if (slug) {
        return year ? `/tv/${slug}-${year}` : `/tv/${slug}`;
      }
    }
    if (customSlug && !isGenericSlug) {
      return year ? `/tv/${customSlug}-${year}` : `/tv/${customSlug}`;
    }
  }

  if (customSlug && !isGenericSlug) {
    return `/tv/${customSlug}`;
  }
  return id ? `/tv/${id}` : (customSlug ? `/tv/${customSlug}` : '/tv');
}

/**
 * Sanitizes and normalizes a video URL:
 * - Strips enclosing quotes, stray backticks, whitespace, and YAML scalar artifacts.
 * - Auto-corrects common URL protocol typos (e.g. "https//:", "https:/", "http//:").
 */
export function cleanVideoUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  let clean = url.trim();

  // Strip wrapping/stray quotes (single quotes, double quotes, backticks)
  clean = clean.replace(/^["'`]+|["'`]+$/g, '').trim();

  // Fix typo protocol https//: or http//: -> https:// or http://
  clean = clean.replace(/^(https?)\/\/:(.*)$/i, '$1://$2');
  clean = clean.replace(/^(https?):\/\/:(.*)$/i, '$1://$2');

  // Fix typo protocol https:/ or http:/ with single slash (not followed by /)
  clean = clean.replace(/^(https?):\/(?!\/)(.*)$/i, '$1://$2');

  // Fix 3+ slashes: https:/// -> https://
  clean = clean.replace(/^(https?):\/{3,}(.*)$/i, '$1://$2');

  // Strip any remaining quotes at ends
  clean = clean.replace(/^["'`]+|["'`]+$/g, '').trim();

  if (!clean || clean === 'null' || clean === 'undefined') return null;
  return clean;
}

/**
 * Parses user input which can be either a numeric TMDB ID or a full TMDB URL
 * (e.g. "https://www.themoviedb.org/movie/1084244-toy-story-5?language=id").
 * Returns the extracted numeric ID and media type if detected.
 */
export function extractTmdbIdAndType(input?: string | null): { id: string | null; type?: 'movie' | 'tv' } {
  if (!input || typeof input !== 'string') return { id: null };
  const trimmed = input.trim();

  // Pure numeric ID
  if (/^\d+$/.test(trimmed)) {
    return { id: trimmed };
  }

  // Matches themoviedb.org/movie/1084244... or themoviedb.org/tv/95350...
  const urlMatch = trimmed.match(/(?:themoviedb\.org|api\.themoviedb\.org)(?:\/3)?\/(movie|tv)\/(\d+)/i);
  if (urlMatch) {
    return {
      type: urlMatch[1].toLowerCase() === 'tv' ? 'tv' : 'movie',
      id: urlMatch[2],
    };
  }

  // Any generic URL path with /movie/123 or /tv/123
  const genericMatch = trimmed.match(/\/(movie|tv)\/(\d+)/i);
  if (genericMatch) {
    return {
      type: genericMatch[1].toLowerCase() === 'tv' ? 'tv' : 'movie',
      id: genericMatch[2],
    };
  }

  // Fallback: extract standalone numeric sequence of 2 or more digits
  const digitMatch = trimmed.match(/(\d{2,})/);
  if (digitMatch) {
    return { id: digitMatch[1] };
  }

  return { id: null };
}
