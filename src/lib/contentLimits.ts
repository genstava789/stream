import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import siteConfig from '@/config';
import { memoryCache } from '@/lib/cache';
import { serializeTinaMovie, serializeTinaTVShow } from '@/lib/tina/schema';
import { isMongoConfigured } from '@/lib/mongodb/client';
import {
  saveMongoMovie,
  saveMongoTVShow,
  getMongoMovies,
  getMongoTVShows,
} from '@/lib/mongodb/service';
import { STATIC_MOVIE_FILES, STATIC_TV_FILES } from '@/lib/staticContentRegistry';
import { saveGitHubFile, GitHubOptions } from '@/lib/githubStorage';
import { revalidatePath, revalidateTag } from 'next/cache';

const VIDEO_DIR = path.join(process.cwd(), 'video');
const TV_DIR = path.join(process.cwd(), 'tv');

export interface EnforceLimitOptions {
  type: 'movie' | 'tv';
  field: 'trending' | 'featured';
  limit?: number;
  ghConfig?: GitHubOptions;
}

export interface EnforceLimitResult {
  demoted: string[];
  kept: string[];
  total: number;
}

/**
 * Resolves the configured limit for Trending section
 */
export function getTrendingLimit(type: 'movie' | 'tv' = 'movie'): number {
  if (type === 'movie') {
    const section = siteConfig.sections?.find(
      (s) => s.id === 'trending' || (s.pages?.home && s.type === 'movie' && s.filter?.trending)
    );
    return (siteConfig as any).trendingLimit || section?.limit || 10;
  } else {
    const section = siteConfig.sections?.find(
      (s) => s.id === 'trendingTV' || (s.type === 'tv' && s.filter?.trending)
    );
    return (siteConfig as any).trendingTVLimit || section?.limit || 10;
  }
}

/**
 * Resolves the configured limit for Featured Hero items
 */
export function getFeaturedLimit(type: 'movie' | 'tv' = 'movie'): number {
  return siteConfig.featuredLimit || 7;
}

/**
 * Invalidates all caches related to content listings, sections, and admin CMS views
 */
export function invalidateLimitCaches(): void {
  try {
    memoryCache.invalidate('markdown_');
    memoryCache.invalidate('featured_');
    memoryCache.invalidate('trending_');
    memoryCache.invalidate('custom_');
    memoryCache.invalidate('resolved_sections_');
    memoryCache.invalidate('content_provider_');
    memoryCache.invalidate('cms_');
    memoryCache.invalidate('mongo_');
    memoryCache.invalidate('admin_');
    memoryCache.invalidate('hero_');
    memoryCache.invalidate('featured_custom_movies_list');
    memoryCache.invalidate('featured_custom_tv_list');
    memoryCache.invalidate('custom_movies_for_list');
    memoryCache.invalidate('custom_tv_for_list');
    memoryCache.invalidate('all_custom_movies_list');
    memoryCache.invalidate('all_custom_tv_list');
    memoryCache.invalidate('admin_repo_disk_scan');

    // Invalidate Next.js cache tags
    // @ts-ignore
    if (typeof revalidateTag === 'function') {
      try {
        // @ts-ignore
        revalidateTag('github-content');
        // @ts-ignore
        revalidateTag('featured');
        // @ts-ignore
        revalidateTag('trending');
        // @ts-ignore
        revalidateTag('sections');
      } catch {}
    }

    // Invalidate main paths
    // @ts-ignore
    if (typeof revalidatePath === 'function') {
      try {
        // @ts-ignore
        revalidatePath('/', 'page');
        // @ts-ignore
        revalidatePath('/admin', 'page');
        // @ts-ignore
        revalidatePath('/movie', 'page');
        // @ts-ignore
        revalidatePath('/tv', 'page');
      } catch {}
    }
  } catch (err) {
    console.warn('[contentLimits] Cache invalidation notice:', err);
  }
}

interface RankedItem {
  slug: string;
  tmdb_id?: number;
  title?: string;
  weight?: number;
  updatedAt: number;
  createdAt: number;
  release_date?: string;
}

function comparePriority(a: RankedItem, b: RankedItem): number {
  // 1. Explicit priority weight (smaller number = higher priority, e.g. 1 before 10)
  const hasWA = a.weight !== undefined && a.weight !== null && a.weight !== ('' as any);
  const hasWB = b.weight !== undefined && b.weight !== null && b.weight !== ('' as any);
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

  // 3. Release Date (newest release first)
  const relB = new Date(b.release_date || 0).getTime();
  const relA = new Date(a.release_date || 0).getTime();
  if (relB !== relA && !isNaN(relB) && !isNaN(relA)) {
    return relB - relA;
  }

  // 4. Stable deterministic tie-breaker: Title / Slug alphabetical
  const titleA = String(a.title || a.slug || '');
  const titleB = String(b.title || b.slug || '');
  return titleA.localeCompare(titleB);
}

/**
 * Universal limit enforcer:
 * Ensures that if the number of items with `trending: true` or `featured: true`
 * exceeds `limit`, the older/lower-ranked items are automatically demoted to `false`.
 * Synchronizes across Local Disk Markdown files, In-Memory Static Registry, MongoDB, and GitHub.
 */
export async function enforceContentLimit(options: EnforceLimitOptions): Promise<EnforceLimitResult> {
  const { type, field, ghConfig } = options;
  const limit = options.limit ?? (field === 'trending' ? getTrendingLimit(type) : getFeaturedLimit(type));
  const demoted: string[] = [];
  const kept: string[] = [];

  try {
    if (type === 'movie') {
      const itemsMap = new Map<string, RankedItem>();

      // 1. Source from MongoDB if configured
      if (isMongoConfigured()) {
        const mongoMovies = await getMongoMovies().catch(() => []);
        for (const m of mongoMovies || []) {
          if (Boolean(m[field])) {
            const slug = String(m.slug || '').replace(/\.(md|markdown)$/i, '').trim();
            if (!slug) continue;
            itemsMap.set(slug, {
              slug,
              tmdb_id: m.tmdb_id,
              title: m.title,
              weight: m.weight,
              updatedAt: Number(m.updatedAt) || Number(m.createdAt) || 0,
              createdAt: Number(m.createdAt) || 0,
              release_date: m.release_date,
            });
          }
        }
      }

      // 2. Source from Local Disk
      if (fs.existsSync(VIDEO_DIR)) {
        try {
          const files = fs.readdirSync(VIDEO_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
          for (const file of files) {
            const fullPath = path.join(VIDEO_DIR, file);
            try {
              const raw = fs.readFileSync(fullPath, 'utf8');
              const { data } = matter(raw);
              if (Boolean(data[field])) {
                const slug = file.replace(/\.(md|markdown)$/i, '').trim();
                let fileTime = 0;
                try {
                  const stat = fs.statSync(fullPath);
                  fileTime = stat.mtimeMs || stat.birthtimeMs || 0;
                } catch {}

                const existing = itemsMap.get(slug);
                itemsMap.set(slug, {
                  slug,
                  tmdb_id: Number(data.tmdb_id) || existing?.tmdb_id,
                  title: data.title || existing?.title || slug,
                  weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : existing?.weight,
                  updatedAt: Number(data.updatedAt) || Number(data.createdAt) || existing?.updatedAt || fileTime,
                  createdAt: Number(data.createdAt) || existing?.createdAt || fileTime,
                  release_date: data.release_date || existing?.release_date,
                });
              }
            } catch {}
          }
        } catch {}
      }

      // 3. Source from Static Registry fallback
      if (itemsMap.size === 0 && typeof STATIC_MOVIE_FILES === 'object') {
        for (const [relPath, raw] of Object.entries(STATIC_MOVIE_FILES)) {
          if (!relPath.endsWith('.md') && !relPath.endsWith('.markdown')) continue;
          try {
            const { data } = matter(raw);
            if (Boolean(data[field])) {
              const normKey = relPath.replace(/\\/g, '/');
              const file = path.basename(normKey);
              const slug = file.replace(/\.(md|markdown)$/i, '').trim();
              if (!itemsMap.has(slug)) {
                itemsMap.set(slug, {
                  slug,
                  tmdb_id: Number(data.tmdb_id),
                  title: data.title || slug,
                  weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : undefined,
                  updatedAt: Number(data.updatedAt) || Number(data.createdAt) || 0,
                  createdAt: Number(data.createdAt) || 0,
                  release_date: data.release_date,
                });
              }
            }
          } catch {}
        }
      }

      const allActive = Array.from(itemsMap.values());
      allActive.sort(comparePriority);

      for (let i = 0; i < allActive.length; i++) {
        if (i < limit) {
          kept.push(allActive[i].slug);
        } else {
          // Excess item: must be demoted (uncheck)
          const excess = allActive[i];
          const slug = excess.slug;
          demoted.push(slug);

          let updatedContent = '';

          // A. Update local disk file
          try {
            const filePath = path.join(VIDEO_DIR, `${slug}.md`);
            if (fs && typeof fs.existsSync === 'function' && fs.existsSync(filePath)) {
              const raw = fs.readFileSync(filePath, 'utf8');
              const { data, content } = matter(raw);
              data[field] = false;
              updatedContent = serializeTinaMovie(data, content);
              fs.writeFileSync(filePath, updatedContent, 'utf8');
            }
          } catch (e) {
            console.warn(`[contentLimits] Error writing local disk demotion for movie ${slug}:`, e);
          }

          // B. Update in-memory static registry
          if (typeof STATIC_MOVIE_FILES === 'object') {
            const k1 = `video/${slug}.md`;
            const k2 = `video\\${slug}.md`;
            if (updatedContent) {
              STATIC_MOVIE_FILES[k1] = updatedContent;
              STATIC_MOVIE_FILES[k2] = updatedContent;
            } else if (STATIC_MOVIE_FILES[k1] || STATIC_MOVIE_FILES[k2]) {
              try {
                const raw = STATIC_MOVIE_FILES[k1] || STATIC_MOVIE_FILES[k2];
                const { data, content } = matter(raw);
                data[field] = false;
                const serialized = serializeTinaMovie(data, content);
                STATIC_MOVIE_FILES[k1] = serialized;
                STATIC_MOVIE_FILES[k2] = serialized;
                if (!updatedContent) updatedContent = serialized;
              } catch {}
            }
          }

          // C. Update MongoDB
          if (isMongoConfigured()) {
            await saveMongoMovie({ slug, [field]: false } as any).catch((mErr) => {
              console.warn(`[contentLimits] MongoDB movie demotion notice (${slug}):`, mErr);
            });
          }

          // D. GitHub auto-commit if token available
          if (ghConfig?.token && updatedContent) {
            try {
              await saveGitHubFile(
                `video/${slug}.md`,
                updatedContent,
                `cms: auto-uncheck ${field} limit for ${slug}`,
                ghConfig
              );
            } catch (ghErr) {
              console.warn(`[contentLimits] GitHub auto-commit notice for ${slug}:`, ghErr);
            }
          }
        }
      }
    } else if (type === 'tv') {
      const itemsMap = new Map<string, RankedItem>();

      // 1. Source from MongoDB
      if (isMongoConfigured()) {
        const mongoTV = await getMongoTVShows().catch(() => []);
        for (const s of mongoTV || []) {
          if (Boolean(s[field])) {
            const showSlug = String(s.showSlug || '').replace(/\.(md|markdown)$/i, '').trim();
            if (!showSlug) continue;
            itemsMap.set(showSlug, {
              slug: showSlug,
              tmdb_id: s.tmdb_id,
              title: s.title,
              weight: s.weight,
              updatedAt: Number(s.updatedAt) || Number(s.createdAt) || 0,
              createdAt: Number(s.createdAt) || 0,
              release_date: (s as any).first_air_date || (s as any).release_date,
            });
          }
        }
      }

      // 2. Source from Local Disk
      if (fs.existsSync(TV_DIR)) {
        try {
          const dirs = fs.readdirSync(TV_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
          for (const d of dirs) {
            const showSlug = d.name;
            const indexPath = fs.existsSync(path.join(TV_DIR, showSlug, '_index.md'))
              ? path.join(TV_DIR, showSlug, '_index.md')
              : fs.existsSync(path.join(TV_DIR, showSlug, 'index.md'))
              ? path.join(TV_DIR, showSlug, 'index.md')
              : null;

            if (indexPath) {
              try {
                const raw = fs.readFileSync(indexPath, 'utf8');
                const { data } = matter(raw);
                if (Boolean(data[field])) {
                  let fileTime = 0;
                  try {
                    const stat = fs.statSync(indexPath);
                    fileTime = stat.mtimeMs || stat.birthtimeMs || 0;
                  } catch {}

                  const existing = itemsMap.get(showSlug);
                  itemsMap.set(showSlug, {
                    slug: showSlug,
                    tmdb_id: Number(data.tmdb_id) || existing?.tmdb_id,
                    title: data.title || existing?.title || showSlug,
                    weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : existing?.weight,
                    updatedAt: Number(data.updatedAt) || Number(data.createdAt) || existing?.updatedAt || fileTime,
                    createdAt: Number(data.createdAt) || existing?.createdAt || fileTime,
                    release_date: data.first_air_date || data.release_date || existing?.release_date,
                  });
                }
              } catch {}
            }
          }
        } catch {}
      }

      // 3. Source from Static Registry fallback
      if (itemsMap.size === 0 && typeof STATIC_TV_FILES === 'object') {
        for (const [relPath, raw] of Object.entries(STATIC_TV_FILES)) {
          if (!relPath.endsWith('_index.md') && !relPath.endsWith('index.md')) continue;
          try {
            const { data } = matter(raw);
            if (Boolean(data[field])) {
              const showSlug = relPath.replace(/^tv[\\\/]/, '').split(/[\\\/]/)[0];
              if (showSlug && !itemsMap.has(showSlug)) {
                itemsMap.set(showSlug, {
                  slug: showSlug,
                  tmdb_id: Number(data.tmdb_id),
                  title: data.title || showSlug,
                  weight: data.weight !== undefined && data.weight !== null && data.weight !== '' ? Number(data.weight) : undefined,
                  updatedAt: Number(data.updatedAt) || Number(data.createdAt) || 0,
                  createdAt: Number(data.createdAt) || 0,
                  release_date: data.first_air_date || data.release_date,
                });
              }
            }
          } catch {}
        }
      }

      const allActive = Array.from(itemsMap.values());
      allActive.sort(comparePriority);

      for (let i = 0; i < allActive.length; i++) {
        if (i < limit) {
          kept.push(allActive[i].slug);
        } else {
          // Excess item: must be demoted (uncheck)
          const excess = allActive[i];
          const showSlug = excess.slug;
          demoted.push(showSlug);

          let updatedContent = '';
          let actualRelPath = `tv/${showSlug}/_index.md`;

          // A. Update local disk file
          try {
            const p1 = path.join(TV_DIR, showSlug, '_index.md');
            const p2 = path.join(TV_DIR, showSlug, 'index.md');
            const targetPath = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : p1;
            if (fs.existsSync(p2) && !fs.existsSync(p1)) {
              actualRelPath = `tv/${showSlug}/index.md`;
            }

            if (fs && typeof fs.existsSync === 'function' && fs.existsSync(targetPath)) {
              const raw = fs.readFileSync(targetPath, 'utf8');
              const { data, content } = matter(raw);
              data[field] = false;
              updatedContent = serializeTinaTVShow(data, content);
              fs.writeFileSync(targetPath, updatedContent, 'utf8');
            }
          } catch (e) {
            console.warn(`[contentLimits] Error writing local disk demotion for TV show ${showSlug}:`, e);
          }

          // B. Update in-memory static registry
          if (typeof STATIC_TV_FILES === 'object') {
            const k1 = `tv/${showSlug}/_index.md`;
            const k2 = `tv\\${showSlug}\\_index.md`;
            if (updatedContent) {
              STATIC_TV_FILES[k1] = updatedContent;
              STATIC_TV_FILES[k2] = updatedContent;
            } else if (STATIC_TV_FILES[k1] || STATIC_TV_FILES[k2]) {
              try {
                const raw = STATIC_TV_FILES[k1] || STATIC_TV_FILES[k2];
                const { data, content } = matter(raw);
                data[field] = false;
                const serialized = serializeTinaTVShow(data, content);
                STATIC_TV_FILES[k1] = serialized;
                STATIC_TV_FILES[k2] = serialized;
                if (!updatedContent) updatedContent = serialized;
              } catch {}
            }
          }

          // C. Update MongoDB
          if (isMongoConfigured()) {
            await saveMongoTVShow({ showSlug, [field]: false } as any).catch((mErr) => {
              console.warn(`[contentLimits] MongoDB TV demotion notice (${showSlug}):`, mErr);
            });
          }

          // D. GitHub auto-commit if token available
          if (ghConfig?.token && updatedContent) {
            try {
              await saveGitHubFile(
                actualRelPath,
                updatedContent,
                `cms: auto-uncheck ${field} limit for ${showSlug}`,
                ghConfig
              );
            } catch (ghErr) {
              console.warn(`[contentLimits] GitHub auto-commit notice for TV show ${showSlug}:`, ghErr);
            }
          }
        }
      }
    }

    if (demoted.length > 0) {
      invalidateLimitCaches();
    }
  } catch (err) {
    console.warn(`[contentLimits] Error enforcing ${field} limit for ${type}:`, err);
  }

  return {
    demoted,
    kept,
    total: kept.length + demoted.length,
  };
}

/**
 * Convenience helper for Trending limit enforcement
 */
export async function enforceTrendingLimit(
  type: 'movie' | 'tv',
  limit?: number,
  ghConfig?: GitHubOptions
): Promise<EnforceLimitResult> {
  const targetLimit = limit ?? getTrendingLimit(type);
  return enforceContentLimit({ type, field: 'trending', limit: targetLimit, ghConfig });
}

/**
 * Convenience helper for Featured limit enforcement
 */
export async function enforceFeaturedLimit(
  type: 'movie' | 'tv',
  limit?: number,
  ghConfig?: GitHubOptions
): Promise<EnforceLimitResult> {
  const targetLimit = limit ?? getFeaturedLimit(type);
  return enforceContentLimit({ type, field: 'featured', limit: targetLimit, ghConfig });
}
