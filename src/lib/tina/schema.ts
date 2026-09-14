import matter from 'gray-matter';
import { cleanVideoUrl, slugify } from '@/lib/urls';
import { normalizeLangCode } from '@/lib/language';

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
  weight?: number; // Legacy sorting priority
  date?: string; // Standard ISO 8601 post date
  createdAt?: number | string;
  updatedAt?: number | string;
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
  weight?: number; // Legacy sorting priority
  date?: string; // Standard ISO 8601 post date
  createdAt?: number | string;
  updatedAt?: number | string;
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
  date?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
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
    cleanData.language = normalizeLangCode(String(frontmatter.language));
  }
  if (frontmatter.date && String(frontmatter.date).trim()) {
    cleanData.date = String(frontmatter.date).trim();
  } else if (frontmatter.createdAt || frontmatter.updatedAt) {
    const rawTime = Number(frontmatter.createdAt || frontmatter.updatedAt);
    if (rawTime > 0) cleanData.date = new Date(rawTime).toISOString();
  }
  if (frontmatter.createdAt !== undefined && frontmatter.createdAt !== null) {
    cleanData.createdAt = Number(frontmatter.createdAt) || frontmatter.createdAt;
  }
  if (frontmatter.updatedAt !== undefined && frontmatter.updatedAt !== null) {
    cleanData.updatedAt = Number(frontmatter.updatedAt) || frontmatter.updatedAt;
  }
  if (frontmatter.subtitles && String(frontmatter.subtitles).trim()) {
    cleanData.subtitles = String(frontmatter.subtitles).trim();
  }

  // Preserve any extra custom fields (excluding legacy weight unless explicitly non-empty)
  for (const [k, v] of Object.entries(frontmatter)) {
    if (k === 'weight') continue; // Omit weight from newly serialized files
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
    cleanData.language = normalizeLangCode(String(frontmatter.language));
  }
  if (frontmatter.date && String(frontmatter.date).trim()) {
    cleanData.date = String(frontmatter.date).trim();
  } else if (frontmatter.createdAt || frontmatter.updatedAt) {
    const rawTime = Number(frontmatter.createdAt || frontmatter.updatedAt);
    if (rawTime > 0) cleanData.date = new Date(rawTime).toISOString();
  }
  if (frontmatter.createdAt !== undefined && frontmatter.createdAt !== null) {
    cleanData.createdAt = Number(frontmatter.createdAt) || frontmatter.createdAt;
  }
  if (frontmatter.updatedAt !== undefined && frontmatter.updatedAt !== null) {
    cleanData.updatedAt = Number(frontmatter.updatedAt) || frontmatter.updatedAt;
  }

  for (const [k, v] of Object.entries(frontmatter)) {
    if (k === 'weight') continue; // Omit weight from newly serialized files
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
    videourl: cleanVideoUrl(frontmatter.videourl || frontmatter.video_url || '') || frontmatter.videourl || frontmatter.video_url || '',
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
