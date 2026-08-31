import matter from 'gray-matter';
import { cleanVideoUrl, slugify } from '@/lib/urls';

/**
 * TinaCMS-Aligned TypeScript Types & Serializers
 */

export interface TinaMovieFrontmatter {
  tmdb_id: number | string;
  videourl: string;
  title?: string;
  deskripsi?: string;
  image_url?: string;
  rating?: number | string;
  featured?: boolean;
  trending?: boolean;
  language?: string; // e.g. 'ID', 'KR', 'EN'
  weight?: number; // Sorting priority (smaller = first)
  subtitles?: string;
  [key: string]: any;
}

export interface TinaTVShowFrontmatter {
  tmdb_id: number | string;
  title?: string;
  deskripsi?: string;
  image_url?: string;
  rating?: number | string;
  featured?: boolean;
  trending?: boolean;
  language?: string; // e.g. 'ID', 'KR', 'EN'
  weight?: number; // Sorting priority (smaller = first)
  [key: string]: any;
}

export interface TinaTVEpisodeFrontmatter {
  videourl: string;
  title?: string;
  deskripsi?: string;
  image_url?: string;
  rating?: number | string;
  duration?: string;
  subtitles?: string;
  [key: string]: any;
}

/**
 * Serializes Movie data into valid Tina-compliant markdown string.
 */
export function serializeTinaMovie(
  frontmatter: Partial<TinaMovieFrontmatter> | Record<string, any>,
  bodyContent: string = ''
): string {
  const cleanData: Record<string, any> = {
    tmdb_id: Number(frontmatter.tmdb_id) || frontmatter.tmdb_id,
    videourl: cleanVideoUrl(frontmatter.videourl || '') || frontmatter.videourl || '',
  };

  if (frontmatter.title && String(frontmatter.title).trim()) {
    cleanData.title = String(frontmatter.title).trim();
  }
  if (frontmatter.deskripsi && String(frontmatter.deskripsi).trim()) {
    cleanData.deskripsi = String(frontmatter.deskripsi).trim();
  }
  if (frontmatter.image_url && String(frontmatter.image_url).trim()) {
    cleanData.image_url = String(frontmatter.image_url).trim();
  }
  if (frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== '') {
    cleanData.rating = isNaN(Number(frontmatter.rating)) ? frontmatter.rating : Number(frontmatter.rating);
  }
  if (frontmatter.featured !== undefined) {
    cleanData.featured = Boolean(frontmatter.featured);
  }
  if (frontmatter.trending !== undefined) {
    cleanData.trending = Boolean(frontmatter.trending);
  }
  if (frontmatter.language && String(frontmatter.language).trim()) {
    cleanData.language = String(frontmatter.language).trim().toUpperCase();
  }
  if (frontmatter.weight !== undefined && frontmatter.weight !== null && frontmatter.weight !== '') {
    cleanData.weight = Number(frontmatter.weight);
  }
  if (frontmatter.subtitles && String(frontmatter.subtitles).trim()) {
    cleanData.subtitles = String(frontmatter.subtitles).trim();
  }

  // Preserve any extra custom fields
  for (const [k, v] of Object.entries(frontmatter)) {
    if (cleanData[k] === undefined && v !== undefined && v !== null && v !== '') {
      cleanData[k] = v;
    }
  }

  return matter.stringify(bodyContent || '', cleanData);
}

/**
 * Serializes TV Show (_index.md) into valid Tina-compliant markdown string.
 */
export function serializeTinaTVShow(
  frontmatter: Partial<TinaTVShowFrontmatter> | Record<string, any>,
  bodyContent: string = ''
): string {
  const cleanData: Record<string, any> = {
    tmdb_id: Number(frontmatter.tmdb_id) || frontmatter.tmdb_id,
  };

  if (frontmatter.title && String(frontmatter.title).trim()) {
    cleanData.title = String(frontmatter.title).trim();
  }
  if (frontmatter.deskripsi && String(frontmatter.deskripsi).trim()) {
    cleanData.deskripsi = String(frontmatter.deskripsi).trim();
  }
  if (frontmatter.image_url && String(frontmatter.image_url).trim()) {
    cleanData.image_url = String(frontmatter.image_url).trim();
  }
  if (frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== '') {
    cleanData.rating = isNaN(Number(frontmatter.rating)) ? frontmatter.rating : Number(frontmatter.rating);
  }
  if (frontmatter.featured !== undefined) {
    cleanData.featured = Boolean(frontmatter.featured);
  }
  if (frontmatter.trending !== undefined) {
    cleanData.trending = Boolean(frontmatter.trending);
  }
  if (frontmatter.language && String(frontmatter.language).trim()) {
    cleanData.language = String(frontmatter.language).trim().toUpperCase();
  }
  if (frontmatter.weight !== undefined && frontmatter.weight !== null && frontmatter.weight !== '') {
    cleanData.weight = Number(frontmatter.weight);
  }

  for (const [k, v] of Object.entries(frontmatter)) {
    if (cleanData[k] === undefined && v !== undefined && v !== null && v !== '') {
      cleanData[k] = v;
    }
  }

  return matter.stringify(bodyContent || '', cleanData);
}

/**
 * Serializes TV Episode markdown into valid Tina-compliant markdown string.
 */
export function serializeTinaTVEpisode(
  frontmatter: Partial<TinaTVEpisodeFrontmatter> | Record<string, any>,
  bodyContent: string = ''
): string {
  const cleanData: Record<string, any> = {
    videourl: cleanVideoUrl(frontmatter.videourl || '') || frontmatter.videourl || '',
  };

  if (frontmatter.title && String(frontmatter.title).trim()) {
    cleanData.title = String(frontmatter.title).trim();
  }
  if (frontmatter.deskripsi && String(frontmatter.deskripsi).trim()) {
    cleanData.deskripsi = String(frontmatter.deskripsi).trim();
  }
  if (frontmatter.image_url && String(frontmatter.image_url).trim()) {
    cleanData.image_url = String(frontmatter.image_url).trim();
  }
  if (frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== '') {
    cleanData.rating = isNaN(Number(frontmatter.rating)) ? frontmatter.rating : Number(frontmatter.rating);
  }
  if (frontmatter.duration && String(frontmatter.duration).trim()) {
    cleanData.duration = String(frontmatter.duration).trim();
  }
  if (frontmatter.subtitles && String(frontmatter.subtitles).trim()) {
    cleanData.subtitles = String(frontmatter.subtitles).trim();
  }

  for (const [k, v] of Object.entries(frontmatter)) {
    if (cleanData[k] === undefined && v !== undefined && v !== null && v !== '') {
      cleanData[k] = v;
    }
  }

  return matter.stringify(bodyContent || '', cleanData);
}
