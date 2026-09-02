import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { TVShowDetail } from '@/types/tmdb';
import { getTVShowDetails, getImageUrl, searchTVShows, getTMDBBasicMeta } from '@/lib/tmdb';
import { FeaturedItem } from '@/config';
import { cleanVideoUrl, getTVUrl } from '@/lib/urls';
import { getMongoTVShowBySlug, getMongoTVShows } from '@/lib/mongodb/service';
import { isMongoConfigured } from '@/lib/mongodb/client';
import * as React from 'react';
import { memoryCache } from '@/lib/cache';

const reactCache: <T extends (...args: any[]) => any>(fn: T) => T = (React as any).cache || ((fn: any) => fn);

export interface CustomTVFrontmatter {
  title?: string;
  tmdb_id: number | string;
  rating?: number | string;
  deskripsi?: string;
  description?: string;
  image_url?: string;
  tagline?: string;
  featured?: boolean | string;
  [key: string]: any;
}

export interface CustomEpisodeFrontmatter {
  title?: string;
  videourl?: string;
  video_url?: string;
  image_url?: string;
  deskripsi?: string;
  description?: string;
  episode_number?: number | string;
  season_number?: number | string;
  rating?: number | string;
  duration?: string;
  subtitles?: any;
  subtitle?: string;
  subtitle_url?: string;
  sub_url?: string;
  caption_url?: string;
  [key: string]: any;
}

export interface CustomEpisode {
  slug: string; // e.g. "e1" or "s1/e1"
  filename: string; // e.g. "e1.md"
  seasonNumber: number | null;
  seasonFolder: string | null; // e.g. "s1" or null
  episodeNumber: number;
  episodeLabel: string; // e.g. "S1:E1" or "EP 01"
  title: string;
  videoUrl: string | null;
  imageUrl?: string | null;
  overview?: string;
  rating?: number | null;
  duration?: string | null;
  subtitles?: any;
  contentHtml?: string | null;
  rawContent?: string;
  urlPath?: string; // e.g. "/tv/lanterns/s1/e1"
  frontmatter?: CustomEpisodeFrontmatter;
}

export interface CustomSeason {
  seasonNumber: number | null;
  seasonName?: string;
  seasonFolder: string | null;
  seasonLabel?: string;
  episodes: CustomEpisode[];
}

export interface CustomTVShowData {
  slug: string;
  dirName: string;
  showSlug?: string;
  hasSeasons?: boolean;
  frontmatter: CustomTVFrontmatter;
  contentHtml: string | null;
  rawContent?: string;
  seasons: CustomSeason[];
  allEpisodes: CustomEpisode[];
}

export interface MergedTVShowDetail extends TVShowDetail {
  isCustomMarkdown?: boolean;
  isCustomTV?: boolean;
  customSlug?: string;
  customImageUrl?: string | null;
  customContentHtml?: string | null;
  hasSeasons?: boolean;
  seasonsList?: CustomSeason[];
  customSeasons?: CustomSeason[];
  allEpisodes?: CustomEpisode[];
  customEpisodes?: CustomEpisode[];
  activeEpisode?: CustomEpisode | null;
}

import { STATIC_TV_FILES } from '@/lib/staticContentRegistry';

const TV_CONTENT_DIR = path.join(process.cwd(), 'tv');

/**
 * Ensures the tv/ content directory exists.
 */
function ensureTVDirExists(): void {
  try {
    if (fs && typeof fs.existsSync === 'function' && !fs.existsSync(TV_CONTENT_DIR)) {
      fs.mkdirSync(TV_CONTENT_DIR, { recursive: true });
    }
  } catch {}
}

export function getRawTVFileContent(relOrFullPath: string): string | null {
  try {
    if (fs && typeof fs.existsSync === 'function' && fs.existsSync(relOrFullPath)) {
      return fs.readFileSync(relOrFullPath, 'utf8');
    }
  } catch {}

  const normalized = relOrFullPath
    .replace(/^[a-zA-Z]:[\\\/].*?[\\\/]tv[\\\/]/i, '')
    .replace(/^tv[\\\/]/i, '')
    .replace(/\\/g, '/');

  const key1 = `tv/${normalized}`;
  const key2 = `tv\\${normalized.replace(/\//g, '\\')}`;
  return (
    STATIC_TV_FILES[key1] ||
    STATIC_TV_FILES[key2] ||
    STATIC_TV_FILES[relOrFullPath] ||
    null
  );
}

/**
 * Parses episode number from filename or string (e.g. "e1.md", "episode-2.md", "03.md").
 */
function parseEpisodeNumber(filename: string, fallbackIndex: number): number {
  const clean = filename.replace(/\.(md|markdown)$/i, '');
  const match = clean.match(/(?:ep?|episode[-_]?)?(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return fallbackIndex + 1;
}

/**
 * Parses season number from folder name (e.g. "s1", "season-2", "season3").
 */
function parseSeasonNumber(folderName: string): number | null {
  const match = folderName.match(/(?:s|season[-_]?)?(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Gets all TV show directory names from the `tv/` folder on local disk with fallback to static registry.
 */
export function getAllCustomTVShowDirs(): string[] {
  let dirs: string[] = [];
  try {
    ensureTVDirExists();
    if (fs && typeof fs.existsSync === 'function' && fs.existsSync(TV_CONTENT_DIR)) {
      const entries = fs.readdirSync(TV_CONTENT_DIR, { withFileTypes: true });
      dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    }
  } catch (error) {
    // Edge/Cloudflare Workers
  }

  if (dirs.length === 0 && typeof STATIC_TV_FILES === 'object') {
    const set = new Set<string>();
    for (const key of Object.keys(STATIC_TV_FILES)) {
      const parts = key.replace(/^tv[\\\/]/, '').split(/[\\\/]/);
      if (parts.length > 0 && parts[0]) {
        set.add(parts[0]);
      }
    }
    dirs = Array.from(set);
  }

  return dirs;
}

export async function getAllCustomTVShowDirsAsync(): Promise<string[]> {
  try {
    const mongoShows = await getMongoTVShows();
    if (mongoShows && mongoShows.length > 0) {
      const mongoDirs = mongoShows.map((s) => s.showSlug);
      const localDirs = getAllCustomTVShowDirs();
      return Array.from(new Set([...mongoDirs, ...localDirs]));
    }
  } catch {}

  return getAllCustomTVShowDirs();
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
 * Returns all possible slug paths for Next.js generateStaticParams().
/**
 * Returns all possible slug paths for Next.js generateStaticParams().
 * E.g. [
 *   { slug: ['lanterns'] },
 *   { slug: ['lanterns-2026'] },
 *   { slug: ['lanterns-2026', 's1', 'e1'] },
 *   { slug: ['lanterns', 's1', 'e1'] },
 *   { slug: ['lanterns', 's1', 'e1.md'] },
 *   { slug: ['lanterns-95350', 's1', 'e1'] },
 *   { slug: ['95350', 's1', 'e1'] }
 * ]
 */
export async function getAllCustomTVSlugPaths(): Promise<{ slug: string[] }[]> {
  const pathsMap = new Map<string, { slug: string[] }>();

  const addPath = (segments: string[]) => {
    const key = segments.join('/');
    if (!pathsMap.has(key)) {
      pathsMap.set(key, { slug: segments });
    }
  };

  // 1. Primary: Get from MongoDB if configured
  if (isMongoConfigured()) {
    try {
      const mongoShows = await getMongoTVShows();
      for (const show of mongoShows) {
        const showSlug = show.showSlug;
        const possibleShowSlugs = [showSlug];
        possibleShowSlugs.push(`${showSlug}-2026`);

        if (show.tmdb_id) {
          possibleShowSlugs.push(String(show.tmdb_id));
          if (show.title) {
            const tSlug = cleanSlug(show.title);
            if (tSlug) {
              possibleShowSlugs.push(tSlug);
              possibleShowSlugs.push(`${tSlug}-2026`);
              possibleShowSlugs.push(`${tSlug}-${show.tmdb_id}`);
            }
          }
        }

        for (const sSlug of possibleShowSlugs) {
          addPath([sSlug]);
          for (const ep of show.episodes || []) {
            const cleanEp = ep.episode || ep.slug || 'e1';
            const seasonFolder = ep.seasonFolder || 's1';
            addPath([sSlug, seasonFolder, cleanEp]);
            addPath([sSlug, seasonFolder, `${cleanEp}.md`]);
            addPath([sSlug, cleanEp]);
          }
        }
      }
    } catch (mErr) {
      console.warn('[markdownTV] getAllCustomTVSlugPaths MongoDB notice:', mErr);
    }
  }

  // 2. Also check local disk dirs as fallback or complement
  const dirs = getAllCustomTVShowDirs();
  for (const showSlug of dirs) {
    const showData = await getCustomTVShowBySlug(showSlug);
    if (!showData) continue;

    const possibleShowSlugs = [showSlug];
    const year = showData.frontmatter.year || showData.frontmatter.first_air_date?.slice(0, 4) || '2026';
    possibleShowSlugs.push(`${showSlug}-${year}`);

    if (showData.frontmatter.tmdb_id) {
      possibleShowSlugs.push(String(showData.frontmatter.tmdb_id));
      if (showData.frontmatter.title) {
        const tSlug = cleanSlug(showData.frontmatter.title);
        if (tSlug) {
          possibleShowSlugs.push(tSlug);
          possibleShowSlugs.push(`${tSlug}-${year}`);
          possibleShowSlugs.push(`${tSlug}-${showData.frontmatter.tmdb_id}`);
        }
      }
    }

    for (const sSlug of possibleShowSlugs) {
      addPath([sSlug]);

      for (const ep of showData.allEpisodes) {
        const baseEp = ep.filename.replace(/\.(md|markdown)$/i, '');
        if (ep.seasonFolder) {
          addPath([sSlug, ep.seasonFolder, baseEp]);
          addPath([sSlug, ep.seasonFolder, ep.filename]);
        } else {
          addPath([sSlug, baseEp]);
          addPath([sSlug, ep.filename]);
        }
      }
    }
  }

  return Array.from(pathsMap.values());
}

/**
 * Reads and parses a custom TV show and all its episodes.
 * PRIORITY 1: MongoDB (Live Cloud Database)
 * PRIORITY 2: Local Disk / Static Registry Fallback
 */
export async function getCustomTVShowBySlug(showSlugOrTmdbId: string | number): Promise<CustomTVShowData | null> {
  const cacheKey = `custom_tv_by_slug_${String(showSlugOrTmdbId).trim().toLowerCase()}`;
  return memoryCache.getOrFetch<CustomTVShowData | null>(
    cacheKey,
    async () => {
      const searchKey = String(showSlugOrTmdbId).trim().toLowerCase();

      // ── 1. PRIMARY: Check MongoDB first (Cloud Database as Single Source of Truth) ──
      if (isMongoConfigured()) {
        try {
          const cleanSearch = searchKey.replace(/-(19\d{2}|20\d{2}|\d+)$/, '');
          let mongoDoc = await getMongoTVShowBySlug(searchKey);
          if (!mongoDoc && cleanSearch !== searchKey) {
            mongoDoc = await getMongoTVShowBySlug(cleanSearch);
          }

          if (mongoDoc) {
            const episodes: CustomEpisode[] = (mongoDoc.episodes || []).map((ep) => {
              const epNum = Number(ep.episode.replace(/\D/g, '')) || 1;
              const seasonNum = ep.seasonFolder ? Number(ep.seasonFolder.replace(/\D/g, '')) || 1 : 1;
              const sFolder = ep.seasonFolder || 's1';
              const baseEp = ep.episode;
              const epLabel = `S${seasonNum}:E${epNum}`;
              const urlPath = `/tv/${mongoDoc!.showSlug}/${sFolder}/${baseEp}`;

              return {
                slug: `${sFolder}/${baseEp}`,
                filename: `${baseEp}.md`,
                seasonNumber: seasonNum,
                seasonFolder: sFolder,
                episodeNumber: epNum,
                episodeLabel: epLabel,
                title: ep.title,
                videoUrl: ep.videourl || null,
                imageUrl: ep.image_url || mongoDoc!.image_url || null,
                overview: ep.deskripsi || '',
                rating: ep.rating || null,
                duration: ep.duration || null,
                subtitles: ep.subtitles || null,
                contentHtml: ep.content ? ((marked.parse(ep.content)) as string) : null,
                rawContent: ep.content || '',
                urlPath,
                frontmatter: {
                  title: ep.title,
                  videourl: ep.videourl,
                  image_url: ep.image_url,
                  deskripsi: ep.deskripsi,
                  rating: ep.rating,
                  duration: ep.duration,
                  subtitles: ep.subtitles,
                },
              };
            });

            // Group into seasons
            const seasonsMap = new Map<number, CustomEpisode[]>();
            episodes.forEach((ep) => {
              const sNum = ep.seasonNumber || 1;
              if (!seasonsMap.has(sNum)) {
                seasonsMap.set(sNum, []);
              }
              seasonsMap.get(sNum)!.push(ep);
            });

            const seasons: CustomSeason[] = Array.from(seasonsMap.entries())
              .map(([sNum, eps]) => ({
                seasonNumber: sNum,
                seasonName: `Season ${sNum}`,
                seasonFolder: eps[0]?.seasonFolder || `s${sNum}`,
                episodes: eps,
              }))
              .sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0));

            const showHtml = mongoDoc.content ? ((await marked.parse(mongoDoc.content)) as string) : null;

            return {
              slug: mongoDoc.showSlug,
              dirName: mongoDoc.showSlug,
              showSlug: mongoDoc.showSlug,
              hasSeasons: seasons.length > 0,
              frontmatter: {
                title: mongoDoc.title,
                tmdb_id: mongoDoc.tmdb_id,
                image_url: mongoDoc.image_url,
                deskripsi: mongoDoc.deskripsi,
                rating: mongoDoc.rating,
                featured: mongoDoc.featured,
                trending: mongoDoc.trending,
                language: mongoDoc.language,
                weight: mongoDoc.weight,
              },
              contentHtml: showHtml,
              rawContent: mongoDoc.content || '',
              seasons,
              allEpisodes: episodes,
            };
          }
        } catch (mErr) {
          console.warn('[markdownTV] MongoDB getCustomTVShowBySlug notice:', mErr);
        }
      }

      // ── 2. FALLBACK: Check Local Disk / Static Registry if not found in MongoDB ──
      ensureTVDirExists();
      const showDirs = getAllCustomTVShowDirs();

      // Extract trailing ID (e.g. "lanterns-95350" -> "95350") or strip year/ID
      const idMatch = searchKey.match(/-(\d+)$/);
      const trailingId = idMatch ? idMatch[1] : null;
      const cleanWithoutSuffix = searchKey.replace(/-(19\d{2}|20\d{2}|\d+)$/, '');

      let matchedDir: string | null = null;
      let showDirFullPath = '';

      // 1. Direct directory match (e.g. "lanterns" or "lanterns-2026" matching "lanterns")
      for (const dir of showDirs) {
        const dirLower = dir.toLowerCase();
        if (dirLower === searchKey || dirLower === cleanWithoutSuffix) {
          matchedDir = dir;
          showDirFullPath = path.join(TV_CONTENT_DIR, dir);
          break;
        }
      }

      // 2. Search by tmdb_id, title slug, or trailing ID in _index.md
      if (!matchedDir) {
        for (const dir of showDirs) {
          const indexContent =
            getRawTVFileContent(`tv/${dir}/_index.md`) ||
            getRawTVFileContent(`tv/${dir}/index.md`);

          if (indexContent) {
            try {
              const { data } = matter(indexContent);
              if (data) {
                const tmdbIdStr = String(data.tmdb_id || '').trim();
                const titleSlug = cleanSlug(data.title || data.name);

                // Direct TMDB ID or trailing ID match
                if (tmdbIdStr && (tmdbIdStr === searchKey || tmdbIdStr === trailingId)) {
                  matchedDir = dir;
                  showDirFullPath = path.join(TV_CONTENT_DIR, dir);
                  break;
                }

                // Title slug match (e.g. "lanterns" or "lanterns-2026")
                if (
                  titleSlug &&
                  (titleSlug === searchKey ||
                    titleSlug === cleanWithoutSuffix ||
                    searchKey.startsWith(titleSlug))
                ) {
                  matchedDir = dir;
                  showDirFullPath = path.join(TV_CONTENT_DIR, dir);
                  break;
                }
              }
            } catch (e) {
              console.error(`Error reading index for ${dir}:`, e);
            }
          }
        }
      }

      if (!matchedDir) {
        return null;
      }

      // Read _index.md
      let indexFrontmatter: CustomTVFrontmatter = { tmdb_id: 0 };
      let indexContentHtml: string | null = null;

      const indexRaw =
        getRawTVFileContent(`tv/${matchedDir}/_index.md`) ||
        getRawTVFileContent(`tv/${matchedDir}/index.md`);

      if (indexRaw) {
        try {
          const { data, content } = matter(indexRaw);
          indexFrontmatter = data as CustomTVFrontmatter;
          if (content && content.trim()) {
            indexContentHtml = await marked.parse(content);
          }
        } catch (e) {
          console.error(`Error parsing index for ${matchedDir}:`, e);
        }
      }

      // Scan for episodes and seasons
      const seasonsMap = new Map<number | null, CustomEpisode[]>();
  const allEpisodes: CustomEpisode[] = [];
  let hasSeasons = false;

  try {
    let subDirs: { name: string; isDirectory: () => boolean }[] = [];
    try {
      if (fs && typeof fs.existsSync === 'function' && fs.existsSync(showDirFullPath)) {
        const entries = fs.readdirSync(showDirFullPath, { withFileTypes: true });
        subDirs = entries.filter((e) => e.isDirectory());
      }
    } catch {}

    if (subDirs.length === 0 && typeof STATIC_TV_FILES === 'object') {
      const seasonSet = new Set<string>();
      for (const key of Object.keys(STATIC_TV_FILES)) {
        const parts = key.replace(/^tv[\\\/]/, '').split(/[\\\/]/);
        if (parts[0] === matchedDir && parts.length >= 3) {
          seasonSet.add(parts[1]);
        }
      }
      subDirs = Array.from(seasonSet).map((s) => ({
        name: s,
        isDirectory: () => true,
      }));
    }

    if (subDirs.length > 0) {
      hasSeasons = true;

      // Sort season folders (e.g. s1, s2, s3)
      subDirs.sort((a, b) => {
        const sA = parseSeasonNumber(a.name) || 0;
        const sB = parseSeasonNumber(b.name) || 0;
        return sA - sB;
      });

      for (const sDir of subDirs) {
        const seasonNumber = parseSeasonNumber(sDir.name);
        const seasonDirPath = path.join(showDirFullPath, sDir.name);
        let epFiles: string[] = [];

        try {
          if (fs && typeof fs.existsSync === 'function' && fs.existsSync(seasonDirPath)) {
            epFiles = fs
              .readdirSync(seasonDirPath)
              .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
          }
        } catch {}

        if (epFiles.length === 0 && typeof STATIC_TV_FILES === 'object') {
          for (const key of Object.keys(STATIC_TV_FILES)) {
            const parts = key.replace(/^tv[\\\/]/, '').split(/[\\\/]/);
            if (parts[0] === matchedDir && parts[1] === sDir.name && parts.length === 3) {
              epFiles.push(parts[2]);
            }
          }
        }

        // Sort episode files (e.g. e1, e2, e3)
        epFiles.sort((a, b) => parseEpisodeNumber(a, 0) - parseEpisodeNumber(b, 0));

        const seasonEpisodes: CustomEpisode[] = [];

        for (let index = 0; index < epFiles.length; index++) {
          const file = epFiles[index];
          try {
            const raw = getRawTVFileContent(`tv/${matchedDir}/${sDir.name}/${file}`);
            if (!raw) continue;
            const { data, content } = matter(raw);
            const frontmatter = data as CustomEpisodeFrontmatter;

            const epNum = frontmatter.episode_number !== undefined
              ? Number(frontmatter.episode_number)
              : parseEpisodeNumber(file, index);

            const seasonNum = frontmatter.season_number !== undefined
              ? Number(frontmatter.season_number)
              : seasonNumber;

            const baseName = file.replace(/\.(md|markdown)$/i, '');
            const epLabel = seasonNum !== null ? `S${seasonNum}:E${epNum}` : `EP ${epNum < 10 ? '0' + epNum : epNum}`;
            const rawTitle = frontmatter.title?.trim() || '';
            const isCodeTitle = !rawTitle || new RegExp(`^(?:e|ep)?${epNum}$`, 'i').test(rawTitle) || rawTitle.toLowerCase() === baseName.toLowerCase();
            const title = isCodeTitle ? `Episode ${epNum}` : rawTitle;
            const videoUrl = cleanVideoUrl(frontmatter.videourl || frontmatter.video_url);
            const imageUrl = frontmatter.image_url || null;
            const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;
            const overview = (frontmatter.deskripsi || frontmatter.description || '').trim();
            const rawRating = frontmatter.rating !== undefined && frontmatter.rating !== null ? Number(frontmatter.rating) : null;
            const rating = rawRating && !isNaN(rawRating) && rawRating > 0 ? rawRating : null;
            const duration = frontmatter.duration || null;
            const contentHtml = content && content.trim() ? await marked.parse(content) : null;
            const urlPath = `/tv/${matchedDir}/${sDir.name}/${baseName}`;

            const customEp: CustomEpisode = {
              slug: `${sDir.name}/${baseName}`,
              filename: file,
              seasonNumber: seasonNum,
              seasonFolder: sDir.name,
              episodeNumber: epNum,
              episodeLabel: epLabel,
              title,
              videoUrl,
              imageUrl,
              overview,
              rating,
              duration,
              subtitles,
              contentHtml,
              rawContent: content,
              urlPath,
            };

            seasonEpisodes.push(customEp);
            allEpisodes.push(customEp);
          } catch (err) {
            console.error(`Error parsing episode file ${file}:`, err);
          }
        }

        seasonsMap.set(seasonNumber, seasonEpisodes);
      }
    } else {
      // Flat episodes directly inside show folder (no season folders)
      hasSeasons = false;
      let epFiles: string[] = [];

      try {
        if (fs && typeof fs.existsSync === 'function' && fs.existsSync(showDirFullPath)) {
          const entries = fs.readdirSync(showDirFullPath, { withFileTypes: true });
          epFiles = entries
            .filter(
              (e) =>
                e.isFile() &&
                (e.name.endsWith('.md') || e.name.endsWith('.markdown')) &&
                e.name !== '_index.md' &&
                e.name !== 'index.md'
            )
            .map((e) => e.name);
        }
      } catch {}

      if (epFiles.length === 0 && typeof STATIC_TV_FILES === 'object') {
        for (const key of Object.keys(STATIC_TV_FILES)) {
          const parts = key.replace(/^tv[\\\/]/, '').split(/[\\\/]/);
          if (parts[0] === matchedDir && parts.length === 2 && parts[1] !== '_index.md' && parts[1] !== 'index.md') {
            epFiles.push(parts[1]);
          }
        }
      }

      epFiles.sort((a, b) => parseEpisodeNumber(a, 0) - parseEpisodeNumber(b, 0));

      const flatEpisodes: CustomEpisode[] = [];

      for (let index = 0; index < epFiles.length; index++) {
        const file = epFiles[index];
        try {
          const raw = getRawTVFileContent(`tv/${matchedDir}/${file}`);
          if (!raw) continue;
          const { data, content } = matter(raw);
          const frontmatter = data as CustomEpisodeFrontmatter;

          const epNum = frontmatter.episode_number !== undefined
            ? Number(frontmatter.episode_number)
            : parseEpisodeNumber(file, index);

          const baseName = file.replace(/\.(md|markdown)$/i, '');
          const epLabel = `EP ${epNum < 10 ? '0' + epNum : epNum}`;
          const rawTitle = frontmatter.title?.trim() || '';
          const isCodeTitle = !rawTitle || new RegExp(`^(?:e|ep)?${epNum}$`, 'i').test(rawTitle) || rawTitle.toLowerCase() === baseName.toLowerCase();
          const title = isCodeTitle ? `Episode ${epNum}` : rawTitle;
          const videoUrl = cleanVideoUrl(frontmatter.videourl || frontmatter.video_url);
          const imageUrl = frontmatter.image_url || null;
          const subtitles = frontmatter.subtitles || frontmatter.subtitle || frontmatter.subtitle_url || frontmatter.sub_url || frontmatter.caption_url || null;
          const overview = (frontmatter.deskripsi || frontmatter.description || '').trim();
          const rawRating = frontmatter.rating !== undefined && frontmatter.rating !== null ? Number(frontmatter.rating) : null;
          const rating = rawRating && !isNaN(rawRating) && rawRating > 0 ? rawRating : null;
          const duration = frontmatter.duration || null;
          const contentHtml = content && content.trim() ? await marked.parse(content) : null;
          const urlPath = `/tv/${matchedDir}/${baseName}`;

          const customEp: CustomEpisode = {
            slug: baseName,
            filename: file,
            seasonNumber: null,
            seasonFolder: null,
            episodeNumber: epNum,
            episodeLabel: epLabel,
            title,
            videoUrl,
            imageUrl,
            overview,
            rating,
            duration,
            subtitles,
            contentHtml,
            rawContent: content,
            urlPath,
          };

          flatEpisodes.push(customEp);
          allEpisodes.push(customEp);
        } catch (err) {
          console.error(`Error parsing flat episode ${file}:`, err);
        }
      }

      seasonsMap.set(null, flatEpisodes);
    }
  } catch (err) {
    console.error(`Error reading TV show directory ${showDirFullPath}:`, err);
  }

  // Format seasons array
  const seasons: CustomSeason[] = [];
  seasonsMap.forEach((eps, seasonNum) => {
    seasons.push({
      seasonNumber: seasonNum,
      seasonName: seasonNum !== null ? `Season ${seasonNum}` : 'Semua Episode',
      seasonFolder: eps[0]?.seasonFolder || null,
      episodes: eps,
    });
  });

    return {
      slug: matchedDir,
      dirName: matchedDir,
      showSlug: matchedDir,
      hasSeasons,
      frontmatter: indexFrontmatter,
      contentHtml: indexContentHtml,
      seasons,
      allEpisodes,
    };
  },
  60_000,
  15_000
);
}

/**
 * Fetches TMDB TV Show details and merges with custom markdown TV data and active episode.
 */
export const getTVShowDetailsWithCustomOverride = reactCache(async function getTVShowDetailsWithCustomOverride(
  slugArray: string[]
): Promise<MergedTVShowDetail | null> {
  if (!slugArray || slugArray.length === 0) return null;
  const cacheKey = `tv_detail_override_${slugArray.join('/').toLowerCase()}`;
  return memoryCache.getOrFetch<MergedTVShowDetail | null>(
    cacheKey,
    async () => {
      const showSlugOrId = slugArray[0];
      let customTV = await getCustomTVShowBySlug(showSlugOrId);

  let tmdbId: number | null = null;

  if (customTV) {
    tmdbId = Number(customTV.frontmatter.tmdb_id);
    if (!tmdbId || isNaN(tmdbId)) {
      tmdbId = 0;
    }
  } else {
    const str = String(showSlugOrId).trim();
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
          const searchRes = await searchTVShows(cleanSearch);
          if (searchRes.results && searchRes.results.length > 0) {
            const matched = searchYear
              ? searchRes.results.find((s) => s.first_air_date && s.first_air_date.startsWith(searchYear)) || searchRes.results[0]
              : searchRes.results[0];
            tmdbId = matched ? matched.id : null;
          }
        } catch (e) {
          console.warn(`Error searching TMDB for TV slug ${str}:`, e);
        }
      }
    }
  }

  // If customTV wasn't found by slug directly, but tmdbId was resolved,
  // check if there is an existing custom markdown TV show with this tmdb_id!
  if (!customTV && tmdbId && tmdbId > 0) {
    customTV = await getCustomTVShowBySlug(tmdbId);
  }

  if (tmdbId === null || isNaN(tmdbId)) {
    return null;
  }

  // Fetch baseline TMDB details
  const tmdbShow = tmdbId > 0 ? await getTVShowDetails(tmdbId) : null;
  if (!tmdbShow && !customTV) return null;

  if (!customTV) {
    if (!tmdbShow) return null;
    return {
      ...tmdbShow,
      isCustomTV: false,
      hasSeasons: Boolean(tmdbShow.number_of_seasons && tmdbShow.number_of_seasons > 0),
      seasonsList: [],
      allEpisodes: [],
      activeEpisode: null,
    };
  }

  const { frontmatter, contentHtml, seasons, allEpisodes, hasSeasons } = customTV;

  // Overrides from frontmatter
  const overriddenName = frontmatter.title && frontmatter.title.trim() !== ''
    ? frontmatter.title
    : (tmdbShow?.name || customTV.showSlug);

  const overriddenRating = frontmatter.rating !== undefined && frontmatter.rating !== null && frontmatter.rating !== ''
    ? Number(frontmatter.rating)
    : (tmdbShow?.vote_average || 0);

  const overriddenOverview = (frontmatter.deskripsi || frontmatter.description)?.trim() || tmdbShow?.overview || '';
  const overriddenTagline = frontmatter.tagline?.trim() || tmdbShow?.tagline || '';
  const customImageUrl = frontmatter.image_url || null;

  // Determine active episode
  let activeEpisode: CustomEpisode | null = null;

  if (slugArray.length > 1) {
    const episodePathSegments = slugArray.slice(1);
    const joinedEpisodePath = episodePathSegments.join('/').toLowerCase().replace(/\.(md|markdown)$/i, '');

    activeEpisode =
      allEpisodes.find(
        (ep) =>
          ep.slug.toLowerCase() === joinedEpisodePath ||
          ep.slug.toLowerCase().endsWith(joinedEpisodePath) ||
          ep.filename.toLowerCase().replace(/\.(md|markdown)$/i, '') === joinedEpisodePath
      ) || null;
  }

  // Poster and backdrop strictly use TMDB or explicit custom poster fields, NOT image_url (which is reserved for player/generic content)
  const overriddenPoster = (frontmatter.poster_path ? frontmatter.poster_path : tmdbShow?.poster_path) || null;
  const overriddenBackdrop = (frontmatter.backdrop_url ? frontmatter.backdrop_url : tmdbShow?.backdrop_path) || null;

  return {
    ...(tmdbShow || {}),
    id: tmdbShow?.id || tmdbId || 0,
    name: overriddenName,
    vote_average: overriddenRating,
    vote_count: tmdbShow?.vote_count || 0,
    overview: overriddenOverview,
    tagline: overriddenTagline,
    first_air_date: tmdbShow?.first_air_date || (frontmatter.year ? `${frontmatter.year}-01-01` : '2026-01-01'),
    poster_path: overriddenPoster,
    backdrop_path: overriddenBackdrop,
    genres: tmdbShow?.genres || [],
    number_of_seasons: hasSeasons ? seasons.length : (tmdbShow?.number_of_seasons || 1),
    number_of_episodes: allEpisodes.length > 0 ? allEpisodes.length : (tmdbShow?.number_of_episodes || 0),
    isCustomTV: true,
    customSlug: customTV.showSlug,
    customImageUrl,
    customContentHtml: contentHtml,
    hasSeasons,
    seasonsList: seasons,
    allEpisodes,
    activeEpisode,
  } as any;
    },
    60_000,
    15_000
  );
});

/**
 * Returns a mapping of tmdb_id -> custom TV show slug (e.g. { 95350: 'lanterns' }).
 */
export function getCustomTVTmdbMapping(): Record<string, string> {
  const dirs = getAllCustomTVShowDirs();
  const mapping: Record<string, string> = {};

  dirs.forEach((dir) => {
    try {
      const fullPath = path.join(TV_CONTENT_DIR, dir);
      const indexPath = fs.existsSync(path.join(fullPath, '_index.md'))
        ? path.join(fullPath, '_index.md')
        : fs.existsSync(path.join(fullPath, 'index.md'))
        ? path.join(fullPath, 'index.md')
        : null;

      if (indexPath) {
        const content = fs.readFileSync(indexPath, 'utf8');
        const { data } = matter(content);
        if (data && data.tmdb_id) {
          mapping[String(data.tmdb_id)] = dir;
        }
      }
    } catch (e) {
      console.error(`Error parsing TV mapping for ${dir}:`, e);
    }
  });

  return mapping;
}

/**
 * Returns all custom markdown TV shows that have `featured: true` in their metadata.
 * Sourced directly from MongoDB with fallback to local files.
 */
export async function getAllFeaturedCustomTV(): Promise<FeaturedItem[]> {
  return memoryCache.getOrFetch<FeaturedItem[]>(
    'featured_custom_tv_list',
    async () => {
      try {
        let showDocs: any[] = [];
        if (isMongoConfigured()) {
          const mongoShows = await getMongoTVShows().catch(() => []);
          if (mongoShows && mongoShows.length > 0) {
            showDocs = mongoShows.filter((s) => Boolean(s.featured));
          }
        }

        // Fallback to local disk files only if MongoDB is empty or unconfigured
        if (showDocs.length === 0 && !isMongoConfigured()) {
          ensureTVDirExists();
          const showDirs = fs.existsSync(TV_CONTENT_DIR)
            ? fs.readdirSync(TV_CONTENT_DIR, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name)
            : [];

          const diskShows = showDirs
            .map((showDir) => {
              try {
                const showPath = path.join(TV_CONTENT_DIR, showDir);
                const indexPath = fs.existsSync(path.join(showPath, '_index.md'))
                  ? path.join(showPath, '_index.md')
                  : fs.existsSync(path.join(showPath, 'index.md'))
                  ? path.join(showPath, 'index.md')
                  : null;
                if (indexPath) {
                  const raw = fs.readFileSync(indexPath, 'utf8');
                  const { data } = matter(raw);
                  return {
                    showSlug: showDir,
                    tmdb_id: Number(data.tmdb_id) || 0,
                    title: data.title || showDir,
                    image_url: data.image_url || data.poster_path || '',
                    deskripsi: data.deskripsi || data.overview || '',
                    rating: Number(data.rating) || 0,
                    featured: Boolean(data.featured),
                    trending: Boolean(data.trending),
                    language: data.language ? String(data.language).trim().toUpperCase() : 'ID',
                    weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : undefined,
                    episodes: [],
                    createdAt: 0,
                    updatedAt: 0,
                  };
                }
              } catch {}
              return null;
            })
            .filter(Boolean) as any[];

          showDocs = diskShows.filter((s) => Boolean(s.featured));
        }

        const mappedItems = await Promise.all(
          showDocs.map(async (s) => {
            let overview = (s.deskripsi || (s as any).description || '').trim();
            let rating = s.rating || 0;
            let genres: string[] = [];
            let posterUrl = s.image_url ? getImageUrl(s.image_url, 'w500') : '/placeholder-poster.svg';
            let backdropUrl = s.image_url ? getImageUrl(s.image_url, 'original') : '/placeholder-poster.svg';
            let logoUrl: string | undefined = undefined;
            let trailerKey: string | undefined = undefined;

            if (s.tmdb_id) {
              try {
                const tmdbId = Number(s.tmdb_id);
                const tmdb = await memoryCache.getOrFetch(
                  `admin_tmdb_tv_${tmdbId}`,
                  () => getTVShowDetails(tmdbId).catch(() => null),
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

            const link = `/tv/${s.showSlug}`;

            return {
              id: `tv-${s.showSlug}`,
              tmdbId: s.tmdb_id || 0,
              title: s.title || s.showSlug,
              tagline: undefined,
              overview: overview || 'Saksikan serial seru ini dengan kualitas terbaik di LeviStream.',
              backdropUrl,
              posterUrl,
              logoUrl,
              trailerKey,
              rating: rating || 8.5,
              year: '2026',
              duration: s.episodes?.length ? `${s.episodes.length} Episodes` : undefined,
              type: 'tv' as const,
              genres,
              link,
              badge: 'Featured',
              featured: true,
              trending: Boolean(s.trending),
              language: s.language ? String(s.language).trim().toUpperCase() : 'ID',
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
        console.warn('[markdownTV] getAllFeaturedCustomTV error:', err);
        return [];
      }
    },
    60_000,
    15_000
  );
}

/**
 * Returns all custom TV shows formatted as TVShow objects for display in homepage rows and grids.
 * Sourced directly from MongoDB when configured.
 */
export async function getAllCustomTVShowsForList(): Promise<any[]> {
  return memoryCache.getOrFetch<any[]>(
    'custom_tv_shows_for_list',
    async () => {
      try {
        let showDocs: any[] = [];

        if (isMongoConfigured()) {
          const mongoShows = await getMongoTVShows().catch(() => []);
          if (mongoShows && mongoShows.length > 0) {
            showDocs = mongoShows;
          }
        }

        // Fallback to local files only if MongoDB is genuinely not configured
        if (showDocs.length === 0 && !isMongoConfigured()) {
          ensureTVDirExists();
          const showDirs = fs.existsSync(TV_CONTENT_DIR)
            ? fs.readdirSync(TV_CONTENT_DIR, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name)
            : [];

          const diskShows: any[] = [];
          for (const showDir of showDirs) {
            try {
              const showPath = path.join(TV_CONTENT_DIR, showDir);
              const indexPath = fs.existsSync(path.join(showPath, '_index.md'))
                ? path.join(showPath, '_index.md')
                : fs.existsSync(path.join(showPath, 'index.md'))
                ? path.join(showPath, 'index.md')
                : null;
              if (indexPath) {
                const raw = fs.readFileSync(indexPath, 'utf8');
                let fileTime = 0;
                try {
                  const stat = fs.statSync(indexPath);
                  fileTime = stat.mtimeMs || stat.birthtimeMs || 0;
                } catch {}
                const { data } = matter(raw);
                diskShows.push({
                  showSlug: showDir,
                  tmdb_id: Number(data.tmdb_id) || 0,
                  title: data.title || showDir,
                  image_url: data.image_url || data.poster_path || '',
                  deskripsi: data.deskripsi || data.overview || '',
                  rating: Number(data.rating) || 0,
                  featured: Boolean(data.featured),
                  trending: Boolean(data.trending),
                  language: data.language ? String(data.language).trim().toUpperCase() : 'ID',
                  weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : undefined,
                  episodes: [],
                  createdAt: fileTime,
                  updatedAt: fileTime,
                });
              }
            } catch {}
          }
          showDocs = diskShows;
        }

        return await Promise.all(
          showDocs.map(async (s) => {
            let poster: string | null = null;
            let backdrop: string | null = null;
            let rating = Number(s.rating) || 0;
            let overview = s.deskripsi || '';
            let genreIds: number[] = [];
            let firstAirDate = '2026-01-01';

            if (s.tmdb_id) {
              try {
                const tmdb = await getTMDBBasicMeta('tv', Number(s.tmdb_id));
                if (tmdb) {
                  // Default poster from TMDB API
                  if (tmdb.poster_path) poster = tmdb.poster_path;
                  if (tmdb.backdrop_path) backdrop = tmdb.backdrop_path;
                  if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
                  if (!overview && tmdb.overview) overview = tmdb.overview;
                  if (tmdb.first_air_date) firstAirDate = tmdb.first_air_date;
                  if (Array.isArray(tmdb.genres)) genreIds = tmdb.genres.map((g) => g.id);
                }
              } catch {}
            }

            // Fallback for poster & backdrop if TMDB didn't return one
            if (!poster && s.image_url) {
              poster = s.image_url;
            }
            if (!backdrop && s.image_url) {
              backdrop = s.image_url;
            }

            return {
              id: s.tmdb_id || s.showSlug,
              name: s.title || s.showSlug,
              title: s.title || s.showSlug,
              overview,
              poster_path: poster,
              backdrop_path: backdrop,
              first_air_date: firstAirDate,
              vote_average: rating,
              vote_count: 0,
              genre_ids: genreIds,
              popularity: 100,
              isCustomTV: true,
              media_type: 'tv',
              customSlug: s.showSlug,
              customImageUrl: s.image_url || null,
              featured: Boolean(s.featured),
              trending: Boolean(s.trending),
              language: s.language ? String(s.language).trim().toUpperCase() : 'ID',
              weight: s.weight !== undefined && s.weight !== null ? Number(s.weight) : undefined,
              updatedAt: Number(s.updatedAt) || Number(s.createdAt) || 0,
              createdAt: Number(s.createdAt) || Number(s.updatedAt) || 0,
              link: `/tv/${s.showSlug}`,
            };
          })
        );
      } catch (err) {
        console.warn('[markdownTV] getAllCustomTVShowsForList error:', err);
        return [];
      }
    },
    60_000,
    15_000
  );
}
