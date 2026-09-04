import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { revalidatePath, revalidateTag } from 'next/cache';
import { slugify, cleanVideoUrl, extractTmdbIdAndType, generateSafeContentSlug, isValidVideoUrl } from '@/lib/urls';
import {
  saveGitHubFile,
  deleteGitHubFile,
  deleteGitHubFolder,
  getGitHubTree,
  getGitHubBlob,
  getGitHubRawFile,
  commitMultipleGitHubFiles,
  resolveGitHubOptions,
  parseGitHubRepoInput,
  GitHubOptions,
} from '@/lib/githubStorage';
import { getMovieDetails, getTVShowDetails, getImageUrl } from '@/lib/tmdb';
import { memoryCache } from '@/lib/cache';
import { getContentProvider } from '@/lib/content';
import {
  serializeTinaMovie,
  serializeTinaTVShow,
  serializeTinaTVEpisode,
} from '@/lib/tina/schema';
import {
  getMongoMovies,
  getMongoTVShows,
  getMongoMovieBySlug,
  getMongoTVShowBySlug,
  getPaginatedMongoMovies,
  getPaginatedMongoTVShows,
  getMongoContentCounts,
  saveMongoMovie,
  deleteMongoMovie,
  saveMongoTVShow,
  deleteMongoTVShow,
  deleteMongoEpisode,
  syncMongoDBToGitHub,
  syncGitHubToMongoDB,
  getStoredGitHubSettings,
  saveStoredGitHubSettings,
  isMongoConfigured,
} from '@/lib/mongodb/service';
import { deleteRequestsByContent } from '@/lib/mongodb/requestService';
import { STATIC_MOVIE_FILES, STATIC_TV_FILES } from '@/lib/staticContentRegistry';
import { normalizeLangCode } from '@/lib/language';

const VIDEO_DIR = path.join(process.cwd(), 'video');
const TV_DIR = path.join(process.cwd(), 'tv');

export function ensureDirectories() {
  try {
    if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
    if (!fs.existsSync(TV_DIR)) fs.mkdirSync(TV_DIR, { recursive: true });
  } catch {
    // Read-only filesystem in cloud/vercel
  }
}

export async function getGitHubConfigFromRequest(req: Request, explicitBody?: any): Promise<GitHubOptions> {
  const headers = req.headers;
  const stored = await getStoredGitHubSettings().catch(() => null);

  const rawToken =
    explicitBody?.token ||
    headers.get('x-github-token') ||
    stored?.token ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    null;

  const rawOwner =
    explicitBody?.owner ||
    headers.get('x-github-owner') ||
    stored?.owner ||
    process.env.GITHUB_BACKUP_OWNER ||
    process.env.GITHUB_OWNER ||
    'genstava789';

  const rawRepo =
    explicitBody?.repo ||
    headers.get('x-github-repo') ||
    stored?.repo ||
    process.env.GITHUB_BACKUP_REPO ||
    'filmes-content';

  const rawBranch =
    explicitBody?.branch ||
    headers.get('x-github-branch') ||
    stored?.branch ||
    process.env.GITHUB_BACKUP_BRANCH ||
    process.env.GITHUB_BRANCH ||
    'main';

  return resolveGitHubOptions({
    token: rawToken,
    owner: rawOwner,
    repo: rawRepo,
    branch: rawBranch,
  });
}

/**
 * Optimized Selective Revalidation:
 * Only invalidates markdown and content provider cache without purging TMDB API responses.
 * Ensures the homepage loads in < 20ms instead of 1-3 seconds of remote TMDB latency!
 */
export function selectiveRevalidateAll(
  targetSlug?: string,
  tmdbId?: number | string,
  type: 'movie' | 'tv' = 'movie'
) {
  try {
    // 1. Invalidate local memory caches
    memoryCache.invalidate('markdown_');
    memoryCache.invalidate('featured_');
    memoryCache.invalidate('custom_');
    memoryCache.invalidate('resolved_sections_');
    memoryCache.invalidate('content_provider_');
    memoryCache.invalidate('cms_');
    memoryCache.invalidate('mongo_');
    memoryCache.invalidate('admin_');
    memoryCache.invalidate('bucket_');
    memoryCache.invalidate('hero_');
    memoryCache.invalidate('featured_custom_movies_list');
    memoryCache.invalidate('featured_custom_tv_list');
    memoryCache.invalidate('all_custom_movies_list');
    memoryCache.invalidate('all_custom_tv_list');
    memoryCache.invalidate('movie_detail_');
    memoryCache.invalidate('movie_detail_override_');
    memoryCache.invalidate('tv_detail_');
    memoryCache.invalidate('tv_detail_override_');
    memoryCache.invalidate('custom_movie_');
    memoryCache.invalidate('custom_tv_');

    // 2. Invalidate content provider in-memory registry
    try {
      getContentProvider().invalidateCache();
    } catch {}

    // 3. Invalidate Next.js cache tags
    // @ts-ignore
    if (typeof revalidateTag === 'function') {
      try {
        // @ts-ignore
        revalidateTag('github-content');
        // @ts-ignore
        revalidateTag('featured');
        // @ts-ignore
        revalidateTag('content');
        // @ts-ignore
        revalidateTag('sections');
        // @ts-ignore
        revalidateTag('movies');
        // @ts-ignore
        revalidateTag('tv_shows');
      } catch {}
    }

    try {
      revalidatePath('/');
      revalidatePath('/', 'page');
      revalidatePath('/', 'layout');
      revalidatePath('/movie', 'page');
      revalidatePath('/movie/[id]', 'page');
      revalidatePath('/tv', 'page');
      revalidatePath('/tv/browse', 'page');
      revalidatePath('/tv/[...slug]', 'page');
      revalidatePath('/embed/movie/[id]', 'page');
      revalidatePath('/embed/tv/[...slug]', 'page');
      revalidatePath('/admin', 'page');
      revalidatePath('/genre/[id]', 'page');

      if (targetSlug) {
        const cleanTarget = targetSlug.replace(/\.(md|markdown)$/i, '').trim();
        if (type === 'movie') {
          revalidatePath(`/movie/${cleanTarget}`, 'page');
          revalidatePath(`/movie/${cleanTarget}-2026`, 'page');
          revalidatePath(`/embed/movie/${cleanTarget}`, 'page');
          revalidatePath(`/embed/movie/${cleanTarget}-2026`, 'page');
          if (tmdbId) {
            revalidatePath(`/movie/${tmdbId}`, 'page');
            revalidatePath(`/movie/${cleanTarget}-${tmdbId}`, 'page');
            revalidatePath(`/embed/movie/${tmdbId}`, 'page');
            revalidatePath(`/embed/movie/${cleanTarget}-${tmdbId}`, 'page');
          }
        } else {
          revalidatePath(`/tv/${cleanTarget}`, 'page');
          revalidatePath(`/tv/${cleanTarget}-2026`, 'page');
          revalidatePath(`/embed/tv/${cleanTarget}`, 'page');
          if (tmdbId) {
            revalidatePath(`/tv/${tmdbId}`, 'page');
            revalidatePath(`/tv/${cleanTarget}-${tmdbId}`, 'page');
            revalidatePath(`/embed/tv/${tmdbId}`, 'page');
          }
        }
      }
    } catch {}
  } catch (err) {
    console.warn('[cmsService] Revalidation notice:', err);
  }
}

export interface FetchPaginatedAdminOptions {
  tab?: 'movies' | 'tv';
  moviePage?: number;
  tvPage?: number;
  search?: string;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'rating' | 'title' | 'weight';
  language?: string;
  status?: string;
}

/**
 * High-performance paginated content fetching for Admin Dashboard.
 * Queries only 7 items per page directly from MongoDB/cache and enriches only the visible 7 items!
 */
export async function fetchPaginatedAdminContent(
  ghConfig: GitHubOptions,
  options: FetchPaginatedAdminOptions = {}
) {
  ensureDirectories();
  const isLocal = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
  const limit = Math.max(1, Number(options.limit) || 7);
  const moviePage = Math.max(1, Number(options.moviePage) || 1);
  const tvPage = Math.max(1, Number(options.tvPage) || 1);
  const search = (options.search || '').trim().toLowerCase();
  const sort = options.sort || 'newest';
  const language = options.language || 'all';
  const status = options.status || 'all';

  // 1. Fetch Paginated Data from MongoDB only if configured
  const [mongoMoviesPaged, mongoTVPaged, counts] = isMongoConfigured()
    ? await Promise.all([
        getPaginatedMongoMovies({ page: moviePage, limit, search, sort, language, status }),
        getPaginatedMongoTVShows({ page: tvPage, limit, search, sort, language, status }),
        getMongoContentCounts(),
      ])
    : [
        { items: [], total: 0, totalPages: 1 },
        { items: [], total: 0, totalPages: 1 },
        { totalMovies: 0, totalTvShows: 0, totalEpisodes: 0 },
      ];

  const hasMongoMovies = mongoMoviesPaged.items.length > 0;
  const hasMongoTV = mongoTVPaged.items.length > 0;

  let localDiskMovies: any[] = [];
  let localDiskTVShows: any[] = [];

  if (!hasMongoMovies || !hasMongoTV) {
    try {
      const diskData = await memoryCache.getOrFetch<{ movies: any[]; tvShows: any[] }>(
        'admin_repo_disk_scan',
        async () => {
          let diskMovies: any[] = [];
          let diskTV: any[] = [];

          if (fs.existsSync(VIDEO_DIR)) {
            const files = fs.readdirSync(VIDEO_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
            diskMovies = files.map((file) => {
              try {
                const fullPath = path.join(VIDEO_DIR, file);
                const raw = fs.readFileSync(fullPath, 'utf8');
                const stat = fs.statSync(fullPath);
                const { data, content } = matter(raw);
                const slug = file.replace(/\.(md|markdown)$/i, '');
                return {
                  filename: file,
                  slug,
                  relativePath: `video/${file}`,
                  frontmatter: data || {},
                  content: content || '',
                  updatedAt: Number(data?.updatedAt) || Number(data?.createdAt) || stat.mtimeMs || Date.now(),
                };
              } catch {
                return null;
              }
            }).filter(Boolean) as any[];
          }

          // Fallback to static registry for Cloudflare Workers / Edge where local filesystem is unavailable
          if (diskMovies.length === 0 && typeof STATIC_MOVIE_FILES === 'object') {
            const seenSlugs = new Set<string>();
            for (const [key, raw] of Object.entries(STATIC_MOVIE_FILES)) {
              const normKey = key.replace(/\\/g, '/');
              const file = path.basename(normKey);
              const slug = file.replace(/\.(md|markdown)$/i, '');
              if (seenSlugs.has(slug)) continue;
              seenSlugs.add(slug);
              try {
                const { data, content } = matter(raw);
                diskMovies.push({
                  filename: file,
                  slug,
                  relativePath: `video/${file}`,
                  frontmatter: data || {},
                  content: content || '',
                  updatedAt: Number(data?.updatedAt) || Number(data?.createdAt) || 0,
                });
              } catch {}
            }
          }

          if (fs.existsSync(TV_DIR)) {
            const dirs = fs.readdirSync(TV_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
            for (const d of dirs) {
              const showPath = path.join(TV_DIR, d.name);
              let indexData: any = {};
              let indexContent = '';
              const indexPath = fs.existsSync(path.join(showPath, '_index.md'))
                ? path.join(showPath, '_index.md')
                : fs.existsSync(path.join(showPath, 'index.md'))
                ? path.join(showPath, 'index.md')
                : null;

              if (indexPath) {
                const raw = fs.readFileSync(indexPath, 'utf8');
                const parsed = matter(raw);
                indexData = parsed.data || {};
                indexContent = parsed.content || '';
              }

              const episodes: any[] = [];
              const entries = fs.readdirSync(showPath, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name === '_index.md' || entry.name === 'index.md') continue;
                if (entry.isDirectory()) {
                  const seasonFolder = entry.name;
                  const seasonPath = path.join(showPath, seasonFolder);
                  const epFiles = fs.readdirSync(seasonPath).filter((f) => /\.(md|markdown)$/i.test(f));
                  for (const epFile of epFiles) {
                    const raw = fs.readFileSync(path.join(seasonPath, epFile), 'utf8');
                    const { data, content } = matter(raw);
                    const epSlug = epFile.replace(/\.(md|markdown)$/i, '');
                    episodes.push({
                      showSlug: d.name,
                      seasonFolder,
                      filename: epFile,
                      slug: epSlug,
                      relativePath: `tv/${d.name}/${seasonFolder}/${epFile}`,
                      frontmatter: data || {},
                      content: content || '',
                      displayTitle: data?.title || epSlug,
                      posterUrl: data?.image_url ? getImageUrl(data.image_url, 'w500') : null,
                      updatedAt: Date.now(),
                    });
                  }
                }
              }

              diskTV.push({
                showSlug: d.name,
                relativePath: `tv/${d.name}/_index.md`,
                indexFrontmatter: indexData,
                indexContent,
                updatedAt: Date.now(),
                episodes,
              });
            }
          }

          // Fallback to static registry for Cloudflare Workers / Edge
          if (diskTV.length === 0 && typeof STATIC_TV_FILES === 'object') {
            const showsMap = new Map<string, any>();
            for (const [key, raw] of Object.entries(STATIC_TV_FILES)) {
              const normKey = key.replace(/\\/g, '/');
              const parts = normKey.split('/');
              if (parts[0] !== 'tv' || parts.length < 2) continue;
              const showSlug = parts[1];
              if (!showsMap.has(showSlug)) {
                showsMap.set(showSlug, {
                  showSlug,
                  relativePath: `tv/${showSlug}/_index.md`,
                  indexFrontmatter: {},
                  indexContent: '',
                  updatedAt: Date.now(),
                  episodes: [],
                });
              }
              const show = showsMap.get(showSlug);
              const lastPart = parts[parts.length - 1];
              if (lastPart === '_index.md' || lastPart === 'index.md') {
                try {
                  const { data, content } = matter(raw);
                  show.indexFrontmatter = data || {};
                  show.indexContent = content || '';
                } catch {}
              } else if (/\.(md|markdown)$/i.test(lastPart)) {
                try {
                  const { data, content } = matter(raw);
                  const seasonFolder = parts.length > 3 ? parts[2] : 's1';
                  const epSlug = lastPart.replace(/\.(md|markdown)$/i, '');
                  if (!show.episodes.some((e: any) => e.slug === epSlug && e.seasonFolder === seasonFolder)) {
                    show.episodes.push({
                      showSlug,
                      seasonFolder,
                      filename: lastPart,
                      slug: epSlug,
                      relativePath: `tv/${showSlug}/${seasonFolder}/${lastPart}`,
                      frontmatter: data || {},
                      content: content || '',
                      displayTitle: data?.title || epSlug,
                      posterUrl: data?.image_url ? getImageUrl(data.image_url, 'w500') : null,
                      updatedAt: Date.now(),
                    });
                  }
                } catch {}
              }
            }
            diskTV = Array.from(showsMap.values());
          }

          diskMovies.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          diskTV.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          return { movies: diskMovies, tvShows: diskTV };
        },
        60_000,
        15_000
      );

      localDiskMovies = diskData.movies;
      localDiskTVShows = diskData.tvShows;
    } catch (err) {
      console.warn('[cmsService] Repository disk scan notice:', err);
    }
  }

  // ----------------------------------------------------
  // RESOLVE MOVIES: MongoDB (Live Cloud DB) with Disk Fallback
  // ----------------------------------------------------
  let rawMovies: any[] = [];
  let totalMovies = 0;
  let totalMoviePages = 1;
  let totalAllMoviesCount = 0;

  if (hasMongoMovies) {
    rawMovies = mongoMoviesPaged.items.map((m) => ({
      filename: `${m.slug}.md`,
      slug: m.slug,
      relativePath: `video/${m.slug}.md`,
      frontmatter: {
        tmdb_id: m.tmdb_id,
        title: m.title,
        videourl: m.videourl,
        image_url: m.image_url,
        deskripsi: m.deskripsi,
        rating: m.rating,
        featured: m.featured,
        trending: m.trending,
        language: normalizeLangCode(m.language),
        weight: m.weight !== undefined && m.weight !== null ? Number(m.weight) : undefined,
        subtitles: m.subtitles,
        duration: m.duration,
      },
      content: m.content || '',
      updatedAt: m.updatedAt || Date.now(),
    }));

    totalMovies = mongoMoviesPaged.total;
    totalMoviePages = mongoMoviesPaged.totalPages;
    totalAllMoviesCount = counts.totalMovies || totalMovies;
  }

  if (rawMovies.length === 0 && localDiskMovies.length > 0) {
    let filtered = [...localDiskMovies];
    if (search) {
      filtered = filtered.filter(
        (m) =>
          (m.frontmatter.title || m.slug).toLowerCase().includes(search) ||
          String(m.frontmatter.tmdb_id || '').includes(search)
      );
    }
    if (language && language !== 'all') {
      const reqLang = language.toUpperCase().trim();
      if (reqLang === 'ID') {
        filtered = filtered.filter((m) => {
          const l = (m.frontmatter.language || 'ID').toUpperCase();
          return l === 'ID' || l === 'IND' || l === 'INDONESIA';
        });
      } else if (reqLang === 'MS') {
        filtered = filtered.filter((m) => {
          const l = (m.frontmatter.language || '').toUpperCase();
          return l === 'MS' || l === 'MY' || l === 'MALAY' || l === 'MELAYU';
        });
      } else {
        filtered = filtered.filter((m) => (m.frontmatter.language || 'ID').toUpperCase() === reqLang);
      }
    }
    if (status === 'trending') {
      filtered = filtered.filter((m) => Boolean(m.frontmatter.trending));
    } else if (status === 'featured') {
      filtered = filtered.filter((m) => Boolean(m.frontmatter.featured));
    }

    if (sort === 'oldest') {
      filtered.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    } else if (sort === 'rating') {
      filtered.sort((a, b) => Number(b.frontmatter.rating || 0) - Number(a.frontmatter.rating || 0));
    } else if (sort === 'title') {
      filtered.sort((a, b) => (a.frontmatter.title || a.slug).localeCompare(b.frontmatter.title || b.slug));
    } else if (sort === 'weight') {
      filtered.sort((a, b) => {
        const wA = a.frontmatter.weight !== undefined ? Number(a.frontmatter.weight) : 999999;
        const wB = b.frontmatter.weight !== undefined ? Number(b.frontmatter.weight) : 999999;
        return wA - wB;
      });
    } else {
      // newest
      filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    totalMovies = filtered.length;
    totalMoviePages = Math.max(1, Math.ceil(totalMovies / limit));
    totalAllMoviesCount = localDiskMovies.length;
    const start = (moviePage - 1) * limit;
    rawMovies = filtered.slice(start, start + limit);
  }

  // ----------------------------------------------------
  // RESOLVE TV SHOWS: MongoDB (Live Cloud DB) with Disk Fallback
  // ----------------------------------------------------
  let rawTvShows: any[] = [];
  let totalTvShows = 0;
  let totalTvPages = 1;
  let totalAllTvShowsCount = 0;
  let totalEpisodesCount = counts.totalEpisodes || 0;

  if (hasMongoTV) {
    rawTvShows = mongoTVPaged.items.map((s) => ({
      showSlug: s.showSlug,
      relativePath: `tv/${s.showSlug}/_index.md`,
      indexFrontmatter: {
        tmdb_id: s.tmdb_id,
        title: s.title,
        image_url: s.image_url,
        deskripsi: s.deskripsi,
        rating: s.rating,
        featured: s.featured,
        trending: s.trending,
        language: normalizeLangCode(s.language),
        weight: s.weight !== undefined && s.weight !== null ? Number(s.weight) : undefined,
      },
      indexContent: s.content || '',
      updatedAt: s.updatedAt || Date.now(),
      episodes: (s.episodes || []).map((ep) => ({
        showSlug: s.showSlug,
        seasonFolder: ep.seasonFolder,
        filename: `${ep.episode}.md`,
        slug: ep.slug || ep.episode,
        relativePath: `tv/${s.showSlug}/${ep.seasonFolder}/${ep.episode}.md`,
        frontmatter: {
          title: ep.title,
          videourl: ep.videourl,
          image_url: ep.image_url,
          deskripsi: ep.deskripsi,
          rating: ep.rating,
          duration: ep.duration,
          subtitles: ep.subtitles,
        },
        content: ep.content || '',
        displayTitle: ep.title || ep.episode,
        posterUrl: ep.image_url ? getImageUrl(ep.image_url, 'w500') : null,
        updatedAt: ep.updatedAt || Date.now(),
      })),
    }));

    totalTvShows = mongoTVPaged.total;
    totalTvPages = mongoTVPaged.totalPages;
    totalAllTvShowsCount = counts.totalTVShows || totalTvShows;
  }

  if (rawTvShows.length === 0 && localDiskTVShows.length > 0) {
    let filtered = [...localDiskTVShows];
    if (search) {
      filtered = filtered.filter(
        (s) =>
          (s.indexFrontmatter.title || s.showSlug).toLowerCase().includes(search) ||
          String(s.indexFrontmatter.tmdb_id || '').includes(search)
      );
    }
    if (language && language !== 'all') {
      const reqLang = language.toUpperCase().trim();
      if (reqLang === 'ID') {
        filtered = filtered.filter((s) => {
          const l = (s.indexFrontmatter.language || 'ID').toUpperCase();
          return l === 'ID' || l === 'IND' || l === 'INDONESIA';
        });
      } else if (reqLang === 'MS') {
        filtered = filtered.filter((s) => {
          const l = (s.indexFrontmatter.language || '').toUpperCase();
          return l === 'MS' || l === 'MY' || l === 'MALAY' || l === 'MELAYU';
        });
      } else {
        filtered = filtered.filter((s) => (s.indexFrontmatter.language || 'ID').toUpperCase() === reqLang);
      }
    }
    if (status === 'trending') {
      filtered = filtered.filter((s) => Boolean(s.indexFrontmatter.trending));
    } else if (status === 'featured') {
      filtered = filtered.filter((s) => Boolean(s.indexFrontmatter.featured));
    }

    if (sort === 'oldest') {
      filtered.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    } else if (sort === 'rating') {
      filtered.sort((a, b) => Number(b.indexFrontmatter.rating || 0) - Number(a.indexFrontmatter.rating || 0));
    } else if (sort === 'title') {
      filtered.sort((a, b) => (a.indexFrontmatter.title || a.showSlug).localeCompare(b.indexFrontmatter.title || b.showSlug));
    } else if (sort === 'weight') {
      filtered.sort((a, b) => {
        const wA = a.indexFrontmatter.weight !== undefined ? Number(a.indexFrontmatter.weight) : 999999;
        const wB = b.indexFrontmatter.weight !== undefined ? Number(b.indexFrontmatter.weight) : 999999;
        return wA - wB;
      });
    } else {
      // newest
      filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    totalTvShows = filtered.length;
    totalTvPages = Math.max(1, Math.ceil(totalTvShows / limit));
    totalAllTvShowsCount = localDiskTVShows.length;
    totalEpisodesCount = localDiskTVShows.reduce((acc, s) => acc + (s.episodes?.length || 0), 0);
    const start = (tvPage - 1) * limit;
    rawTvShows = filtered.slice(start, start + limit);
  }

  // 2. ENRICH ONLY THE 7 ITEMS IN THE CURRENT PAGE (Blazing fast: ~1-5ms with in-memory memoization)
  const movies = await Promise.all(
    rawMovies.map(async (m) => {
      let displayTitle = m.frontmatter.title || m.slug;
      let year: number | null = null;
      let rating = m.frontmatter.rating ? Number(m.frontmatter.rating) : null;
      let tmdbPoster: string | null = null;

      if (m.frontmatter.tmdb_id) {
        try {
          const tmdbId = Number(m.frontmatter.tmdb_id);
          const tmdb = await memoryCache.getOrFetch(
            `admin_tmdb_movie_${tmdbId}`,
            () => getMovieDetails(tmdbId).catch(() => null),
            3600_000,
            600_000
          );
          if (tmdb) {
            if (tmdb.poster_path) tmdbPoster = getImageUrl(tmdb.poster_path, 'w500');
            if (!m.frontmatter.title && tmdb.title) displayTitle = tmdb.title;
            if (tmdb.release_date) year = new Date(tmdb.release_date).getFullYear();
            if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
          }
        } catch {}
      }

      const customImg = m.frontmatter.image_url || null;
      let posterUrl: string | null = null;
      if (tmdbPoster) {
        posterUrl = tmdbPoster;
      } else if (m.frontmatter.poster_path) {
        posterUrl = getImageUrl(String(m.frontmatter.poster_path).trim(), 'w500');
      } else if (customImg && String(customImg).trim()) {
        posterUrl = getImageUrl(String(customImg).trim(), 'w500');
      }

      return {
        ...m,
        posterUrl,
        customImageUrl: customImg || null,
        displayTitle,
        year,
        rating,
      };
    })
  );

  const tvShows = await Promise.all(
    rawTvShows.map(async (s) => {
      let displayTitle = s.indexFrontmatter.title || s.showSlug;
      let year: number | null = null;
      let rating = s.indexFrontmatter.rating ? Number(s.indexFrontmatter.rating) : null;
      let tmdbPoster: string | null = null;

      if (s.indexFrontmatter.tmdb_id) {
        try {
          const tmdbId = Number(s.indexFrontmatter.tmdb_id);
          const tmdb = await memoryCache.getOrFetch(
            `admin_tmdb_tv_${tmdbId}`,
            () => getTVShowDetails(tmdbId).catch(() => null),
            3600_000,
            600_000
          );
          if (tmdb) {
            if (tmdb.poster_path) tmdbPoster = getImageUrl(tmdb.poster_path, 'w500');
            if (!s.indexFrontmatter.title && tmdb.name) displayTitle = tmdb.name;
            if (tmdb.first_air_date) year = new Date(tmdb.first_air_date).getFullYear();
            if (!rating && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
          }
        } catch {}
      }

      const customImg = s.indexFrontmatter.image_url || null;
      let posterUrl: string | null = null;
      if (tmdbPoster) {
        posterUrl = tmdbPoster;
      } else if (s.indexFrontmatter.poster_path) {
        posterUrl = getImageUrl(String(s.indexFrontmatter.poster_path).trim(), 'w500');
      } else if (customImg && String(customImg).trim()) {
        posterUrl = getImageUrl(String(customImg).trim(), 'w500');
      }

      return {
        showSlug: s.showSlug,
        relativePath: s.relativePath,
        frontmatter: s.indexFrontmatter,
        content: s.indexContent,
        updatedAt: s.updatedAt,
        episodes: s.episodes,
        posterUrl,
        customImageUrl: customImg || null,
        displayTitle,
        year,
        rating,
      };
    })
  );

  return {
    movies,
    tvShows,
    moviePage,
    tvPage,
    totalMovies,
    totalTvShows,
    totalMoviePages,
    totalTvPages,
    totalAllMoviesCount,
    totalAllTvShowsCount,
    totalEpisodesCount,
    limit,
    isLocal,
    defaultOwner: process.env.GITHUB_OWNER || 'genstava789',
    defaultRepo: process.env.GITHUB_REPO || 'filmes',
    defaultBranch: process.env.GITHUB_BRANCH || 'main',
  };
}

/**
 * Fetch all movies and TV shows for Admin Dashboard
 */
export async function fetchAllAdminContent(ghConfig: GitHubOptions) {
  return memoryCache.getOrFetch(
    'admin_all_content',
    async () => {
      ensureDirectories();
      const isLocal = !process.env.VERCEL && process.env.NODE_ENV !== 'production';

      const localMoviesMap = new Map<string, any>();
      const localTvShowsMap = new Map<string, any>();

      // 1. Fetch from MongoDB (Persistent Cloud Database) only if configured
      if (isMongoConfigured()) {
        try {
          const mongoMovies = await getMongoMovies();
          const mongoShows = await getMongoTVShows();

          for (const m of mongoMovies) {
            const rel = `video/${m.slug}.md`;
            localMoviesMap.set(rel, {
              filename: `${m.slug}.md`,
              slug: m.slug,
              relativePath: rel,
              frontmatter: {
                tmdb_id: m.tmdb_id,
                title: m.title,
                videourl: m.videourl,
                image_url: m.image_url,
                deskripsi: m.deskripsi,
                rating: m.rating,
                featured: m.featured,
                trending: m.trending,
                language: m.language ? String(m.language).toUpperCase() : 'ID',
                weight: m.weight !== undefined && m.weight !== null ? Number(m.weight) : undefined,
                subtitles: m.subtitles,
                duration: m.duration,
              },
              content: m.content || '',
              updatedAt: m.updatedAt || Date.now(),
            });
          }

          for (const s of mongoShows) {
            localTvShowsMap.set(s.showSlug, {
              showSlug: s.showSlug,
              relativePath: `tv/${s.showSlug}/_index.md`,
              indexFrontmatter: {
                tmdb_id: s.tmdb_id,
                title: s.title,
                image_url: s.image_url,
                deskripsi: s.deskripsi,
                rating: s.rating,
                featured: s.featured,
                trending: s.trending,
                language: s.language ? String(s.language).toUpperCase() : 'ID',
                weight: s.weight !== undefined && s.weight !== null ? Number(s.weight) : undefined,
              },
              indexContent: s.content || '',
              updatedAt: s.updatedAt || Date.now(),
              episodes: (s.episodes || []).map((ep) => ({
                showSlug: s.showSlug,
                seasonFolder: ep.seasonFolder,
                filename: `${ep.episode}.md`,
                slug: ep.slug || ep.episode,
                relativePath: `tv/${s.showSlug}/${ep.seasonFolder}/${ep.episode}.md`,
                frontmatter: {
                  title: ep.title,
                  videourl: ep.videourl,
                  image_url: ep.image_url,
                  deskripsi: ep.deskripsi,
                  rating: ep.rating,
                  duration: ep.duration,
                  subtitles: ep.subtitles,
                },
                content: ep.content || '',
                displayTitle: ep.title || ep.episode,
                posterUrl: ep.image_url ? getImageUrl(ep.image_url, 'w500') : null,
                updatedAt: ep.updatedAt || Date.now(),
              })),
            });
          }
        } catch (mongoErr) {
          console.warn('[cmsService] MongoDB fetch notice:', mongoErr);
        }
      }

  // 2. Read local disk files as fallback or overlay
  let movieFiles: string[] = [];
  try {
    if (fs.existsSync(VIDEO_DIR)) {
      movieFiles = fs.readdirSync(VIDEO_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
    }
  } catch (e) {
    console.warn('[cmsService] Read video dir notice:', e);
  }

  for (const file of movieFiles) {
    const fullPath = path.join(VIDEO_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const stat = fs.statSync(fullPath);
      const { data, content } = matter(raw);
      const rel = `video/${file}`;
      if (!localMoviesMap.has(rel)) {
        localMoviesMap.set(rel, {
          filename: file,
          slug: file.replace(/\.(md|markdown)$/i, ''),
          relativePath: rel,
          frontmatter: data,
          content: content || '',
          updatedAt: stat.mtimeMs || Date.now(),
        });
      }
    } catch {}
  }

  let tvDirs: string[] = [];
  try {
    if (fs.existsSync(TV_DIR)) {
      tvDirs = fs
        .readdirSync(TV_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    }
  } catch (e) {
    console.warn('[cmsService] Read tv dir notice:', e);
  }

  for (const showDir of tvDirs) {
    if (localTvShowsMap.has(showDir)) continue;
    const showPath = path.join(TV_DIR, showDir);
    let indexFrontmatter: any = {};
    let indexContent = '';
    let updatedAt = Date.now();

    const indexPath = fs.existsSync(path.join(showPath, '_index.md'))
      ? path.join(showPath, '_index.md')
      : fs.existsSync(path.join(showPath, 'index.md'))
      ? path.join(showPath, 'index.md')
      : null;

    if (indexPath) {
      try {
        const raw = fs.readFileSync(indexPath, 'utf8');
        const stat = fs.statSync(indexPath);
        const parsed = matter(raw);
        indexFrontmatter = parsed.data;
        indexContent = parsed.content || '';
        updatedAt = stat.mtimeMs || Date.now();
      } catch {}
    }

    const episodes: any[] = [];
    try {
      const entries = fs.readdirSync(showPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === '_index.md' || entry.name === 'index.md') continue;

        if (entry.isDirectory()) {
          const seasonFolder = entry.name;
          const seasonPath = path.join(showPath, seasonFolder);
          const epFiles = fs.readdirSync(seasonPath).filter((f) => /\.(md|markdown)$/i.test(f));

          for (const epFile of epFiles) {
            const epFullPath = path.join(seasonPath, epFile);
            try {
              const raw = fs.readFileSync(epFullPath, 'utf8');
              const epStat = fs.statSync(epFullPath);
              const { data, content } = matter(raw);
              episodes.push({
                showSlug: showDir,
                seasonFolder,
                filename: epFile,
                slug: epFile.replace(/\.(md|markdown)$/i, ''),
                relativePath: `tv/${showDir}/${seasonFolder}/${epFile}`,
                frontmatter: data,
                content: content || '',
                displayTitle: data.title || epFile.replace(/\.(md|markdown)$/i, ''),
                posterUrl: data.image_url ? getImageUrl(data.image_url, 'w500') : null,
                updatedAt: epStat.mtimeMs || Date.now(),
              });
            } catch {}
          }
        } else if (/\.(md|markdown)$/i.test(entry.name)) {
          const epFullPath = path.join(showPath, entry.name);
          try {
            const raw = fs.readFileSync(epFullPath, 'utf8');
            const epStat = fs.statSync(epFullPath);
            const { data, content } = matter(raw);
            episodes.push({
              showSlug: showDir,
              seasonFolder: null,
              filename: entry.name,
              slug: entry.name.replace(/\.(md|markdown)$/i, ''),
              relativePath: `tv/${showDir}/${entry.name}`,
              frontmatter: data,
              content: content || '',
              displayTitle: data.title || entry.name.replace(/\.(md|markdown)$/i, ''),
              posterUrl: data.image_url ? getImageUrl(data.image_url, 'w500') : null,
              updatedAt: epStat.mtimeMs || Date.now(),
            });
          } catch {}
        }
      }
    } catch {}

    localTvShowsMap.set(showDir, {
      showSlug: showDir,
      relativePath: `tv/${showDir}/_index.md`,
      indexFrontmatter,
      indexContent,
      updatedAt,
      episodes,
    });
  }

  // Fallback to static registry for Cloudflare Workers / Edge
  if (localMoviesMap.size === 0 && typeof STATIC_MOVIE_FILES === 'object') {
    for (const [key, raw] of Object.entries(STATIC_MOVIE_FILES)) {
      const normKey = key.replace(/\\/g, '/');
      const file = path.basename(normKey);
      const slug = file.replace(/\.(md|markdown)$/i, '');
      const rel = `video/${file}`;
      if (!localMoviesMap.has(rel)) {
        try {
          const { data, content } = matter(raw);
          localMoviesMap.set(rel, {
            filename: file,
            slug,
            relativePath: rel,
            frontmatter: data || {},
            content: content || '',
            updatedAt: Date.now(),
          });
        } catch {}
      }
    }
  }

  if (localTvShowsMap.size === 0 && typeof STATIC_TV_FILES === 'object') {
    for (const [key, raw] of Object.entries(STATIC_TV_FILES)) {
      const normKey = key.replace(/\\/g, '/');
      const parts = normKey.split('/');
      if (parts[0] !== 'tv' || parts.length < 2) continue;
      const showSlug = parts[1];
      if (!localTvShowsMap.has(showSlug)) {
        localTvShowsMap.set(showSlug, {
          showSlug,
          relativePath: `tv/${showSlug}/_index.md`,
          indexFrontmatter: {},
          indexContent: '',
          updatedAt: Date.now(),
          episodes: [],
        });
      }
      const show = localTvShowsMap.get(showSlug);
      const lastPart = parts[parts.length - 1];
      if (lastPart === '_index.md' || lastPart === 'index.md') {
        try {
          const { data, content } = matter(raw);
          show.indexFrontmatter = data || {};
          show.indexContent = content || '';
        } catch {}
      } else if (/\.(md|markdown)$/i.test(lastPart)) {
        try {
          const { data, content } = matter(raw);
          const seasonFolder = parts.length > 3 ? parts[2] : 's1';
          const epSlug = lastPart.replace(/\.(md|markdown)$/i, '');
          if (!show.episodes.some((e: any) => e.slug === epSlug && e.seasonFolder === seasonFolder)) {
            show.episodes.push({
              showSlug,
              seasonFolder,
              filename: lastPart,
              slug: epSlug,
              relativePath: `tv/${showSlug}/${seasonFolder}/${lastPart}`,
              frontmatter: data || {},
              content: content || '',
              displayTitle: data?.title || epSlug,
              posterUrl: data?.image_url ? getImageUrl(data.image_url, 'w500') : null,
              updatedAt: Date.now(),
            });
          }
        } catch {}
      }
    }
  }

  const rawMovies = Array.from(localMoviesMap.values());
  const rawTvShowsMap = localTvShowsMap;

  // Enrich Movies with TMDB metadata & STRICT PRECEDENCE for custom frontmatter image
  const movies = await Promise.all(
    rawMovies.map(async (m) => {
      let displayTitle = m.frontmatter.title || m.slug;
      let year: number | null = null;
      let rating = m.frontmatter.rating ? Number(m.frontmatter.rating) : null;
      let tmdbPoster: string | null = null;

      if (m.frontmatter.tmdb_id) {
        try {
          const tmdb = await getMovieDetails(Number(m.frontmatter.tmdb_id)).catch(() => null);
          if (tmdb) {
            if (tmdb.poster_path) {
              tmdbPoster = getImageUrl(tmdb.poster_path, 'w500');
            }
            if (!m.frontmatter.title && tmdb.title) {
              displayTitle = tmdb.title;
            }
            if (tmdb.release_date) {
              year = new Date(tmdb.release_date).getFullYear();
            }
            if (!rating && tmdb.vote_average) {
              rating = Math.round(tmdb.vote_average * 10) / 10;
            }
          }
        } catch {}
      }

      const customImg = m.frontmatter.image_url || null;
      let posterUrl: string | null = null;
      if (tmdbPoster) {
        posterUrl = tmdbPoster;
      } else if (m.frontmatter.poster_path) {
        posterUrl = getImageUrl(String(m.frontmatter.poster_path).trim(), 'w500');
      } else if (customImg && String(customImg).trim()) {
        posterUrl = getImageUrl(String(customImg).trim(), 'w500');
      }

      return {
        ...m,
        posterUrl,
        customImageUrl: customImg || null,
        displayTitle,
        year,
        rating,
      };
    })
  );

  movies.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Enrich TV Shows with TMDB metadata & separate poster from custom player image
  const rawTvShows = Array.from(rawTvShowsMap.values());
  const tvShows = await Promise.all(
    rawTvShows.map(async (s) => {
      let displayTitle = s.indexFrontmatter.title || s.showSlug;
      let year: number | null = null;
      let rating = s.indexFrontmatter.rating ? Number(s.indexFrontmatter.rating) : null;
      let tmdbPoster: string | null = null;

      if (s.indexFrontmatter.tmdb_id) {
        try {
          const tmdb = await getTVShowDetails(Number(s.indexFrontmatter.tmdb_id)).catch(() => null);
          if (tmdb) {
            if (tmdb.poster_path) {
              tmdbPoster = getImageUrl(tmdb.poster_path, 'w500');
            }
            if (!s.indexFrontmatter.title && tmdb.name) {
              displayTitle = tmdb.name;
            }
            if (tmdb.first_air_date) {
              year = new Date(tmdb.first_air_date).getFullYear();
            }
            if (!rating && tmdb.vote_average) {
              rating = Math.round(tmdb.vote_average * 10) / 10;
            }
          }
        } catch {}
      }

      const customImg = s.indexFrontmatter.image_url || null;
      let posterUrl: string | null = null;
      if (tmdbPoster) {
        posterUrl = tmdbPoster;
      } else if (s.indexFrontmatter.poster_path) {
        posterUrl = getImageUrl(String(s.indexFrontmatter.poster_path).trim(), 'w500');
      } else if (customImg && String(customImg).trim()) {
        posterUrl = getImageUrl(String(customImg).trim(), 'w500');
      }

      return {
        showSlug: s.showSlug,
        relativePath: s.relativePath,
        frontmatter: s.indexFrontmatter,
        content: s.indexContent,
        updatedAt: s.updatedAt,
        episodes: s.episodes,
        posterUrl,
        customImageUrl: customImg || null,
        displayTitle,
        year,
        rating,
      };
    })
  );

  tvShows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return {
      movies,
      tvShows,
      isLocal,
      defaultOwner: process.env.GITHUB_OWNER || 'genstava789',
      defaultRepo: process.env.GITHUB_REPO || 'filmes',
      defaultBranch: process.env.GITHUB_BRANCH || 'main',
    };
  },
  300_000, // 5 min TTL
  30_000   // 30s SWR
  );
}

/**
 * Create a new movie, TV series (with multi-season episodes), or single episode
 */
export async function createAdminContent(body: any, ghConfig: GitHubOptions) {
  ensureDirectories();
  const { contentType = 'movie' } = body;
  const { token } = ghConfig;
  const isProductionOrCloud = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

  let relativePath = '';
  let fileContent = '';
  let isUpdate = false;
  let hasChanges = true;
  const changedFields: string[] = [];

  if (contentType === 'movie') {
    let { tmdb_id, videourl, title, desc, poster, rating, featured, subtitles, content = '', slug } = body;

    const extracted = extractTmdbIdAndType(String(tmdb_id || ''));
    const parsedId = extracted.id ? Number(extracted.id) : Number(tmdb_id);

    if (!parsedId || isNaN(parsedId)) {
      throw new Error('tmdb_id is required and must be a valid numeric ID or TMDB URL');
    }

    const cleanVideo = cleanVideoUrl(videourl);
    if (!cleanVideo || !isValidVideoUrl(cleanVideo)) {
      throw new Error('URL Video tidak valid. Masukkan format URL yang benar (contoh: https://domain.com/video.mp4 atau https://embed.provider.com/watch/...)');
    }

    const tmdbIdNum = parsedId;

    // ─── Duplicate Content Detection for Movie ───
    const existingMongo = await getMongoMovieBySlug(tmdbIdNum).catch(() => null);
    if (existingMongo) {
      throw new Error(
        `Film dengan TMDB ID "${tmdbIdNum}" sudah ada di database: "${existingMongo.title || existingMongo.slug}". Silakan edit konten yang sudah ada atau gunakan TMDB ID berbeda.`
      );
    }

    if (fs.existsSync(VIDEO_DIR)) {
      const files = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
      for (const f of files) {
        try {
          const raw = fs.readFileSync(path.join(VIDEO_DIR, f), 'utf8');
          const parsed = matter(raw);
          if (Number(parsed.data.tmdb_id) === tmdbIdNum) {
            throw new Error(
              `Film dengan TMDB ID "${tmdbIdNum}" sudah ada di database: "${parsed.data.title || f}". Silakan edit konten yang sudah ada atau gunakan TMDB ID berbeda.`
            );
          }
        } catch (e: any) {
          if (e.message?.includes('sudah ada di database')) throw e;
        }
      }
    }

    if (!title || !desc || !poster) {
      try {
        const tmdb = await getMovieDetails(tmdbIdNum).catch(() => null);
        if (tmdb) {
          if (!title && tmdb.title) title = tmdb.title;
          if (!desc && tmdb.overview) desc = tmdb.overview;
          if (!poster && tmdb.poster_path) poster = getImageUrl(tmdb.poster_path, 'w500');
          if (rating === undefined && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
        }
      } catch {}
    }

    // Generate safe, non-empty filename (handles non-Latin titles like "我是哪吒")
    const fileSlug = generateSafeContentSlug(title, tmdbIdNum, 'movie', slug);
    const filename = `${fileSlug}.md`;
    relativePath = `video/${filename}`;

    const frontmatterData: Record<string, any> = {
      tmdb_id: tmdbIdNum,
      videourl: cleanVideo,
    };

    if (title && title.trim()) frontmatterData.title = title.trim();
    if (desc && desc.trim()) frontmatterData.deskripsi = desc.trim();
    if (poster && poster.trim()) frontmatterData.image_url = poster.trim();
    if (rating !== undefined && rating !== null && rating !== '') frontmatterData.rating = Number(rating);
    if (featured !== undefined) frontmatterData.featured = Boolean(featured);
    if (body.trending !== undefined) frontmatterData.trending = Boolean(body.trending);
    if (body.language && String(body.language).trim()) frontmatterData.language = normalizeLangCode(String(body.language));
    if (body.weight !== undefined && body.weight !== null && body.weight !== '') frontmatterData.weight = Number(body.weight);
    if (subtitles && subtitles.trim()) frontmatterData.subtitles = subtitles.trim();

    fileContent = serializeTinaMovie(frontmatterData, content || '');

    // 1. Update in-memory static registry for immediate reflection
    if (typeof STATIC_MOVIE_FILES === 'object') {
      STATIC_MOVIE_FILES[relativePath] = fileContent;
      STATIC_MOVIE_FILES[relativePath.replace(/\//g, '\\')] = fileContent;
      STATIC_MOVIE_FILES[relativePath.replace(/\\/g, '/')] = fileContent;
    }

    // 2. Write file locally if local disk is available
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, fileContent, 'utf8');
    } catch (err: any) {
      console.warn(`[createAdminContent] Error writing file ${relativePath}:`, err);
    }

    // 3. Persist to MongoDB (Vercel & Local)
    if (isMongoConfigured()) {
      try {
        await saveMongoMovie({
          slug: fileSlug,
          tmdb_id: tmdbIdNum,
          title: frontmatterData.title || fileSlug,
          videourl: frontmatterData.videourl || '',
          image_url: frontmatterData.image_url || '',
          deskripsi: frontmatterData.deskripsi || '',
          rating: frontmatterData.rating || 0,
          featured: frontmatterData.featured || false,
          trending: frontmatterData.trending || false,
          language: frontmatterData.language || 'ID',
          weight: frontmatterData.weight,
          subtitles: frontmatterData.subtitles || '',
          duration: frontmatterData.duration || '',
          content: content || '',
        });
      } catch (mErr) {
        console.warn('[createAdminContent] MongoDB movie save notice:', mErr);
      }
    }

    // 4. Auto-commit to GitHub repository if token is available
    if (token) {
      try {
        await saveGitHubFile(relativePath, fileContent, `cms: create ${relativePath}`, ghConfig);
      } catch (ghErr) {
        console.warn('[createAdminContent] GitHub auto-commit notice:', ghErr);
      }
    }

    // 5. Auto-delete any pending requests for this fulfilled movie
    deleteRequestsByContent({
      tmdbId: tmdbIdNum,
      title: frontmatterData.title || title,
      mediaType: 'movie',
    }).catch((err) => console.warn('[CMS auto-delete request] Error:', err));

    selectiveRevalidateAll(fileSlug, tmdbIdNum, 'movie');
  } else if (contentType === 'tv_show') {
    let { tmdb_id, title, desc, poster, rating, featured, showSlug, content = '', seasons = [] } = body;

    const extracted = extractTmdbIdAndType(String(tmdb_id || ''));
    const parsedId = extracted.id ? Number(extracted.id) : Number(tmdb_id);

    if (!parsedId || isNaN(parsedId)) {
      throw new Error('tmdb_id is required and must be a valid numeric ID or TMDB URL');
    }

    const tmdbIdNum = parsedId;

    // ─── Duplicate Content Detection for TV Show ───
    const existingMongo = await getMongoTVShowBySlug(tmdbIdNum).catch(() => null);
    if (existingMongo) {
      throw new Error(
        `Serial TV dengan TMDB ID "${tmdbIdNum}" sudah ada di database: "${existingMongo.title || existingMongo.showSlug}". Silakan edit serial yang sudah ada atau gunakan TMDB ID berbeda.`
      );
    }

    if (fs.existsSync(TV_DIR)) {
      const shows = fs.readdirSync(TV_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const s of shows) {
        const indexPath = path.join(TV_DIR, s.name, '_index.md');
        if (fs.existsSync(indexPath)) {
          try {
            const raw = fs.readFileSync(indexPath, 'utf8');
            const parsed = matter(raw);
            if (Number(parsed.data.tmdb_id) === tmdbIdNum) {
              throw new Error(
                `Serial TV dengan TMDB ID "${tmdbIdNum}" sudah ada di database: "${parsed.data.title || s.name}". Silakan edit serial yang sudah ada atau gunakan TMDB ID berbeda.`
              );
            }
          } catch (e: any) {
            if (e.message?.includes('sudah ada di database')) throw e;
          }
        }
      }
    }

    if (!title || !desc || !poster) {
      try {
        const tmdb = await getTVShowDetails(tmdbIdNum).catch(() => null);
        if (tmdb) {
          if (!title && tmdb.name) title = tmdb.name;
          if (!desc && tmdb.overview) desc = tmdb.overview;
          if (!poster && tmdb.poster_path) poster = getImageUrl(tmdb.poster_path, 'w500');
          if (rating === undefined && tmdb.vote_average) rating = Math.round(tmdb.vote_average * 10) / 10;
        }
      } catch {}
    }

    // Generate safe show slug
    const cleanShowSlug = generateSafeContentSlug(title, tmdbIdNum, 'tv', showSlug);
    relativePath = `tv/${cleanShowSlug}/_index.md`;

    const frontmatterData: Record<string, any> = {
      tmdb_id: tmdbIdNum,
    };

    if (title && title.trim()) frontmatterData.title = title.trim();
    if (desc && desc.trim()) frontmatterData.deskripsi = desc.trim();
    if (poster && poster.trim()) frontmatterData.image_url = poster.trim();
    if (rating !== undefined && rating !== null && rating !== '') frontmatterData.rating = Number(rating);
    if (featured !== undefined) frontmatterData.featured = Boolean(featured);
    if (body.trending !== undefined) frontmatterData.trending = Boolean(body.trending);
    if (body.language && String(body.language).trim()) frontmatterData.language = normalizeLangCode(String(body.language));
    if (body.weight !== undefined && body.weight !== null && body.weight !== '') frontmatterData.weight = Number(body.weight);

    fileContent = serializeTinaTVShow(frontmatterData, content || '');

    // 1. Update in-memory static registry for show index
    if (typeof STATIC_TV_FILES === 'object') {
      STATIC_TV_FILES[relativePath] = fileContent;
      STATIC_TV_FILES[relativePath.replace(/\//g, '\\')] = fileContent;
      STATIC_TV_FILES[relativePath.replace(/\\/g, '/')] = fileContent;
    }

    // Write TV Show _index.md to local filesystem
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, fileContent, 'utf8');
    } catch (err: any) {
      console.warn(`[createAdminContent] Error writing TV show file ${relativePath}:`, err);
    }

    if (token) {
      try {
        await saveGitHubFile(relativePath, fileContent, `cms: create ${relativePath}`, ghConfig);
      } catch (ghErr) {
        console.warn('[createAdminContent] GitHub auto-commit TV show notice:', ghErr);
      }
    }

    // Save multi-season batch episodes
    let savedEpisodesCount = 0;
    const mongoEpisodesList: any[] = [];

    if (Array.isArray(seasons) && seasons.length > 0) {
      for (const s of seasons) {
        const rawSeason = String(s.season || s.name || 's1').trim();
        const cleanSeason = rawSeason.toLowerCase().startsWith('s')
          ? rawSeason.toLowerCase()
          : `s${rawSeason.replace(/\D/g, '') || '1'}`;
        const episodesList = Array.isArray(s.episodes) ? s.episodes : [];

        for (const ep of episodesList) {
          const rawEp = String(ep.episode || ep.slug || 'e1').trim();
          const epNum = rawEp.replace(/\D/g, '') || '1';
          const cleanEp = `e${epNum}`;
          const epCleanVideo = cleanVideoUrl(ep.videourl || ep.video_url || '');

          if (epCleanVideo) {
            if (!isValidVideoUrl(epCleanVideo)) {
              throw new Error(`URL Video untuk Episode ${cleanEp} tidak valid.`);
            }

            const epRelPath = `tv/${cleanShowSlug}/${cleanSeason}/${cleanEp}.md`;
            const epFrontmatter: Record<string, any> = {
              videourl: epCleanVideo,
            };
            if (ep.title && ep.title.trim()) epFrontmatter.title = ep.title.trim();
            if (ep.desc && ep.desc.trim()) epFrontmatter.deskripsi = ep.desc.trim();
            if (ep.poster || ep.image_url) epFrontmatter.image_url = (ep.poster || ep.image_url).trim();
            if (ep.rating !== undefined && ep.rating !== null && ep.rating !== '')
              epFrontmatter.rating = Number(ep.rating);
            if (ep.duration && ep.duration.trim()) epFrontmatter.duration = ep.duration.trim();
            if (ep.subtitles && ep.subtitles.trim()) epFrontmatter.subtitles = ep.subtitles.trim();

            const epContentStr = serializeTinaTVEpisode(epFrontmatter, ep.content || '');

            if (typeof STATIC_TV_FILES === 'object') {
              STATIC_TV_FILES[epRelPath] = epContentStr;
              STATIC_TV_FILES[epRelPath.replace(/\//g, '\\')] = epContentStr;
              STATIC_TV_FILES[epRelPath.replace(/\\/g, '/')] = epContentStr;
            }

            try {
              const fullEpPath = path.join(process.cwd(), epRelPath);
              const epDir = path.dirname(fullEpPath);
              if (!fs.existsSync(epDir)) fs.mkdirSync(epDir, { recursive: true });
              fs.writeFileSync(fullEpPath, epContentStr, 'utf8');
            } catch (err: any) {
              console.warn(`[createAdminContent] Error writing episode file ${epRelPath}:`, err);
            }

            if (token) {
              try {
                await saveGitHubFile(epRelPath, epContentStr, `cms: create episode ${epRelPath}`, ghConfig);
              } catch (ghErr) {
                console.warn(`[createAdminContent] GitHub auto-commit episode notice:`, ghErr);
              }
            }

            mongoEpisodesList.push({
              showSlug: cleanShowSlug,
              seasonFolder: cleanSeason,
              episode: cleanEp,
              slug: cleanEp,
              title: epFrontmatter.title || `Episode ${epNum}`,
              videourl: epCleanVideo,
              image_url: epFrontmatter.image_url || frontmatterData.image_url || '',
              deskripsi: epFrontmatter.deskripsi || '',
              rating: epFrontmatter.rating || 0,
              duration: epFrontmatter.duration || '',
              subtitles: epFrontmatter.subtitles || '',
              content: ep.content || '',
            });

            savedEpisodesCount++;
          }
        }
      }
    }

    // Persist TV Show & Episodes to MongoDB (Vercel & Local)
    if (isMongoConfigured()) {
      try {
        await saveMongoTVShow(
          {
            showSlug: cleanShowSlug,
            tmdb_id: tmdbIdNum,
            title: frontmatterData.title || cleanShowSlug,
            image_url: frontmatterData.image_url || '',
            deskripsi: frontmatterData.deskripsi || '',
            rating: frontmatterData.rating || 0,
            featured: frontmatterData.featured || false,
            trending: frontmatterData.trending || false,
            language: frontmatterData.language || 'ID',
            weight: frontmatterData.weight,
            content: content || '',
          },
          mongoEpisodesList
        );
      } catch (mErr) {
        console.warn('[createAdminContent] MongoDB TV show save notice:', mErr);
      }
    }

    // 5. Auto-delete any pending requests for this fulfilled TV show
    deleteRequestsByContent({
      tmdbId: tmdbIdNum,
      title: frontmatterData.title || title || showSlug,
      mediaType: 'tv',
    }).catch((err) => console.warn('[CMS auto-delete request] Error:', err));

    selectiveRevalidateAll(cleanShowSlug, tmdbIdNum, 'tv');
    return {
      success: true,
      relativePath,
      isUpdate: false,
      hasChanges: true,
      changedFields: [],
      savedEpisodesCount,
    };
  } else if (contentType === 'tv_episode') {
    const {
      showSlug,
      season = 's1',
      episode = 'e1',
      videourl,
      title,
      desc,
      poster,
      image_url,
      rating,
      subtitles,
      duration,
      content = '',
    } = body;

    if (!showSlug) throw new Error('showSlug is required for TV episode');
    const cleanVideo = cleanVideoUrl(videourl);
    if (!cleanVideo || !isValidVideoUrl(cleanVideo)) {
      throw new Error('URL Video tidak valid. Masukkan format URL yang benar (contoh: https://domain.com/video.mp4 atau https://embed.provider.com/watch/...)');
    }

    const cleanShowSlug = slugify(showSlug);
    const cleanSeason = season ? slugify(season) : 's1';
    const cleanEp = episode
      ? episode.startsWith('e') || episode.startsWith('ep')
        ? `e${episode.replace(/\D/g, '') || '1'}`
        : slugify(episode)
      : 'e1';

    relativePath = `tv/${cleanShowSlug}/${cleanSeason}/${cleanEp}.md`;

    let foundExistingEp = false;
    let existingFrontmatter: Record<string, any> = {};
    try {
      const fullEpPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(fullEpPath)) {
        const raw = fs.readFileSync(fullEpPath, 'utf8');
        existingFrontmatter = matter(raw).data;
        foundExistingEp = true;
      }
    } catch {}

    const frontmatterData: Record<string, any> = {
      videourl: cleanVideo,
    };

    if (title && title.trim()) frontmatterData.title = title.trim();
    else if (existingFrontmatter.title) frontmatterData.title = existingFrontmatter.title;

    if (desc && desc.trim()) frontmatterData.deskripsi = desc.trim();
    else if (existingFrontmatter.deskripsi) frontmatterData.deskripsi = existingFrontmatter.deskripsi;

    if (poster && poster.trim()) frontmatterData.image_url = poster.trim();
    else if (existingFrontmatter.image_url) frontmatterData.image_url = existingFrontmatter.image_url;

    if (rating !== undefined && rating !== null && rating !== '') frontmatterData.rating = Number(rating);
    else if (existingFrontmatter.rating !== undefined) frontmatterData.rating = Number(existingFrontmatter.rating);

    if (duration && duration.trim()) frontmatterData.duration = duration.trim();
    else if (existingFrontmatter.duration) frontmatterData.duration = existingFrontmatter.duration;

    if (subtitles && subtitles.trim()) frontmatterData.subtitles = subtitles.trim();
    else if (existingFrontmatter.subtitles) frontmatterData.subtitles = existingFrontmatter.subtitles;

    if (foundExistingEp) {
      isUpdate = true;
      if (frontmatterData.videourl !== existingFrontmatter.videourl) changedFields.push('URL Video');
      if (frontmatterData.image_url !== existingFrontmatter.image_url) changedFields.push('Image Poster');
      if (frontmatterData.rating !== existingFrontmatter.rating) changedFields.push('Rating');
      if (frontmatterData.duration !== existingFrontmatter.duration) changedFields.push('Durasi');
      if (frontmatterData.subtitles !== existingFrontmatter.subtitles) changedFields.push('Subtitles');
      if (frontmatterData.title && frontmatterData.title !== existingFrontmatter.title) changedFields.push('Judul');
      if (frontmatterData.deskripsi && frontmatterData.deskripsi !== existingFrontmatter.deskripsi)
        changedFields.push('Deskripsi');
      hasChanges = changedFields.length > 0;
    }

    fileContent = serializeTinaTVEpisode(frontmatterData, content || '');

    // 1. In-memory static registry update
    if (typeof STATIC_TV_FILES === 'object') {
      STATIC_TV_FILES[relativePath] = fileContent;
      STATIC_TV_FILES[relativePath.replace(/\//g, '\\')] = fileContent;
      STATIC_TV_FILES[relativePath.replace(/\\/g, '/')] = fileContent;
    }

    // 2. Persist single episode to MongoDB (Vercel & Local)
    if (isMongoConfigured()) {
      try {
        await saveMongoTVShow(
          { showSlug: cleanShowSlug },
          [
            {
              showSlug: cleanShowSlug,
              seasonFolder: cleanSeason,
              episode: cleanEp,
              slug: cleanEp,
              title: frontmatterData.title || `Episode ${cleanEp.replace(/\D/g, '') || '1'}`,
              videourl: cleanVideo,
              image_url: frontmatterData.image_url || '',
              deskripsi: frontmatterData.deskripsi || '',
              rating: frontmatterData.rating || 0,
              duration: frontmatterData.duration || '',
              subtitles: frontmatterData.subtitles || '',
              content: content || '',
            },
          ]
        );
      } catch (mErr) {
        console.warn('[createAdminContent] MongoDB episode save notice:', mErr);
      }
    }

    // 3. Local disk
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, fileContent, 'utf8');
    } catch (err: any) {
      console.warn(`[createAdminContent] Error writing file ${relativePath}:`, err);
    }

    // 4. GitHub auto-commit
    if (token) {
      try {
        await saveGitHubFile(relativePath, fileContent, `cms: create ${relativePath}`, ghConfig);
      } catch (ghErr) {
        console.warn('[createAdminContent] GitHub auto-commit notice:', ghErr);
      }
    }
  } else {
    throw new Error('Invalid contentType');
  }

  selectiveRevalidateAll();
  return {
    success: true,
    relativePath,
    isUpdate,
    hasChanges,
    changedFields,
  };
}

/**
 * Update an existing markdown file and sync to MongoDB
 */
export async function updateAdminContent(body: any, ghConfig: GitHubOptions) {
  const { token } = ghConfig;
  const { relativePath, frontmatter: newFrontmatter, content = '' } = body;

  if (!relativePath) throw new Error('relativePath is required');

  const isMovie = relativePath.startsWith('video/');
  const isTV = relativePath.startsWith('tv/');

  if (!isMovie && !isTV) {
    throw new Error('Access denied outside content directories');
  }

  const cleanFrontmatter: Record<string, any> = {};
  for (const [key, val] of Object.entries(newFrontmatter || {})) {
    if (val !== undefined && val !== null && val !== '') {
      if (key === 'tmdb_id') {
        const ext = extractTmdbIdAndType(String(val));
        cleanFrontmatter[key] = ext.id ? Number(ext.id) : (isNaN(Number(val)) ? val : Number(val));
      } else if (key === 'videourl' || key === 'video_url') {
        cleanFrontmatter[key] = cleanVideoUrl(String(val)) || String(val).trim();
      } else if (key === 'rating' || key === 'episode_number' || key === 'season_number') {
        cleanFrontmatter[key] = isNaN(Number(val)) ? val : Number(val);
      } else if (key === 'featured') {
        cleanFrontmatter[key] = Boolean(val);
      } else if (key === 'trending') {
        cleanFrontmatter[key] = Boolean(val);
      } else if (key === 'language') {
        cleanFrontmatter[key] = normalizeLangCode(String(val));
      } else if (key === 'weight') {
        cleanFrontmatter[key] = isNaN(Number(val)) ? undefined : Number(val);
      } else {
        cleanFrontmatter[key] = val;
      }
    } else if (key === 'featured') {
      cleanFrontmatter[key] = false;
    } else if (key === 'trending') {
      cleanFrontmatter[key] = false;
    }
  }
  cleanFrontmatter.updatedAt = Date.now();

  let fileContent = '';
  const now = Date.now();
  if (isMovie) {
    if (cleanFrontmatter.videourl && !isValidVideoUrl(cleanFrontmatter.videourl)) {
      throw new Error('URL Video tidak valid. Masukkan format URL yang benar (contoh: https://domain.com/video.mp4 atau https://embed.provider.com/watch/...)');
    }

    cleanFrontmatter.updatedAt = now;
    fileContent = serializeTinaMovie(cleanFrontmatter, content || '');
    const slug = path.basename(relativePath).replace(/\.(md|markdown)$/i, '');
    try {
      await saveMongoMovie({
        slug,
        tmdb_id: cleanFrontmatter.tmdb_id,
        title: cleanFrontmatter.title,
        videourl: cleanFrontmatter.videourl || cleanFrontmatter.video_url,
        image_url: cleanFrontmatter.image_url || cleanFrontmatter.poster_path,
        deskripsi: cleanFrontmatter.deskripsi || cleanFrontmatter.description,
        rating: cleanFrontmatter.rating,
        featured: cleanFrontmatter.featured,
        trending: cleanFrontmatter.trending,
        language: cleanFrontmatter.language || 'ID',
        weight: cleanFrontmatter.weight,
        subtitles: cleanFrontmatter.subtitles,
        duration: cleanFrontmatter.duration,
        content: content || '',
        updatedAt: now,
      });
    } catch (mErr) {
      console.warn('[updateAdminContent] MongoDB movie update notice:', mErr);
    }
  } else if (relativePath.endsWith('_index.md') || relativePath.endsWith('index.md')) {
    cleanFrontmatter.updatedAt = now;
    fileContent = serializeTinaTVShow(cleanFrontmatter, content || '');
    const showSlug = relativePath.split('/')[1];
    const mongoEps = Array.isArray(body.episodes)
      ? body.episodes.map((ep: any) => {
          const epVideo = cleanVideoUrl(ep.videourl || (ep.frontmatter && (ep.frontmatter.videourl || ep.frontmatter.video_url)) || '');
          if (epVideo && !isValidVideoUrl(epVideo)) {
            throw new Error(`URL Video untuk Episode ${ep.episode || ep.slug || ep.title} tidak valid.`);
          }
          return {
            showSlug,
            seasonFolder: (ep.season || ep.seasonFolder || 's1').toLowerCase(),
            episode: ep.episode || ep.slug || 'e1',
            slug: ep.episode || ep.slug || 'e1',
            title: ep.title,
            videourl: epVideo || '',
            image_url: ep.image_url || (ep.frontmatter && ep.frontmatter.image_url),
            subtitles: ep.subtitles || (ep.frontmatter && ep.frontmatter.subtitles),
            duration: ep.duration || (ep.frontmatter && ep.frontmatter.duration),
            deleted: ep.deleted,
          };
        })
      : [];
    try {
      await saveMongoTVShow(
        {
          showSlug,
          tmdb_id: cleanFrontmatter.tmdb_id,
          title: cleanFrontmatter.title,
          image_url: cleanFrontmatter.image_url,
          deskripsi: cleanFrontmatter.deskripsi || cleanFrontmatter.description,
          rating: cleanFrontmatter.rating,
          featured: cleanFrontmatter.featured,
          trending: cleanFrontmatter.trending,
          language: cleanFrontmatter.language || 'ID',
          weight: cleanFrontmatter.weight,
          content: content || '',
        },
        mongoEps
      );
    } catch (mErr) {
      console.warn('[updateAdminContent] MongoDB TV show update notice:', mErr);
    }
  } else {
    // Single TV episode update: tv/[showSlug]/[season]/[episode].md
    if (cleanFrontmatter.videourl && !isValidVideoUrl(cleanFrontmatter.videourl)) {
      throw new Error('URL Video tidak valid. Masukkan format URL yang benar (contoh: https://domain.com/video.mp4 atau https://embed.provider.com/watch/...)');
    }

    fileContent = serializeTinaTVEpisode(cleanFrontmatter, content || '');
    const parts = relativePath.split('/');
    if (parts.length >= 4) {
      const showSlug = parts[1];
      const seasonFolder = (parts[2] || 's1').toLowerCase();
      const episode = (parts[3] || 'e1.md').replace(/\.(md|markdown)$/i, '');

      try {
        await saveMongoTVShow(
          { showSlug },
          [
            {
              showSlug,
              seasonFolder,
              episode,
              slug: episode,
              title: cleanFrontmatter.title || `Episode ${episode.replace(/\D/g, '') || '1'}`,
              videourl: cleanVideoUrl(cleanFrontmatter.videourl || cleanFrontmatter.video_url || '') || '',
              image_url: cleanFrontmatter.image_url || cleanFrontmatter.poster_path || '',
              deskripsi: cleanFrontmatter.deskripsi || cleanFrontmatter.description || '',
              rating:
                cleanFrontmatter.rating !== undefined && cleanFrontmatter.rating !== null
                  ? Number(cleanFrontmatter.rating)
                  : 0,
              duration: cleanFrontmatter.duration || '',
              subtitles: cleanFrontmatter.subtitles || '',
              content: content || '',
            },
          ]
        );
      } catch (mErr) {
        console.warn('[updateAdminContent] MongoDB single episode update notice:', mErr);
      }
    }
  }

  // Update in-memory static registry
  if (isMovie && typeof STATIC_MOVIE_FILES === 'object') {
    STATIC_MOVIE_FILES[relativePath] = fileContent;
    STATIC_MOVIE_FILES[relativePath.replace(/\//g, '\\')] = fileContent;
    STATIC_MOVIE_FILES[relativePath.replace(/\\/g, '/')] = fileContent;
  } else if (isTV && typeof STATIC_TV_FILES === 'object') {
    STATIC_TV_FILES[relativePath] = fileContent;
    STATIC_TV_FILES[relativePath.replace(/\//g, '\\')] = fileContent;
    STATIC_TV_FILES[relativePath.replace(/\\/g, '/')] = fileContent;
  }

  // Save main file to local filesystem
  try {
    const fullPath = path.join(process.cwd(), relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, fileContent, 'utf8');
  } catch (err: any) {
    console.warn(`[updateAdminContent] Error writing file ${relativePath}:`, err);
  }

  if (token) {
    try {
      await saveGitHubFile(relativePath, fileContent, `cms: update ${relativePath}`, ghConfig);
    } catch (ghErr) {
      console.warn('[updateAdminContent] GitHub auto-commit notice:', ghErr);
    }
  }

  // If this is a TV show and episodes array was supplied, update all episodes locally
  if (Array.isArray(body.episodes) && (relativePath.endsWith('_index.md') || relativePath.endsWith('index.md'))) {
    const showSlug = relativePath.split('/')[1];

    for (const ep of body.episodes) {
      if (ep.deleted && ep.relativePath) {
        if (typeof STATIC_TV_FILES === 'object') {
          delete STATIC_TV_FILES[ep.relativePath];
          delete STATIC_TV_FILES[ep.relativePath.replace(/\//g, '\\')];
          delete STATIC_TV_FILES[ep.relativePath.replace(/\\/g, '/')];
        }
        try {
          const epPath = path.join(process.cwd(), ep.relativePath);
          if (fs.existsSync(epPath)) fs.unlinkSync(epPath);
        } catch (e) {
          console.warn(`[updateAdminContent] Error deleting episode ${ep.relativePath}:`, e);
        }
        if (token) {
          try {
            await deleteGitHubFile(ep.relativePath, `cms: delete episode ${ep.relativePath}`, ghConfig);
          } catch {}
        }
        continue;
      }

      const epSeason = ep.season || ep.seasonFolder || 's1';
      const epNum = ep.episode || ep.slug || 'e1';
      const epRelativePath = ep.relativePath || `tv/${showSlug}/${epSeason}/${epNum}.md`;

      const epFrontmatter: Record<string, any> = {
        title: ep.title || (ep.frontmatter && ep.frontmatter.title) || `Episode ${epNum.replace(/\D/g, '') || '1'}`,
        videourl: cleanVideoUrl(ep.videourl || (ep.frontmatter && (ep.frontmatter.videourl || ep.frontmatter.video_url)) || '') || '',
      };

      const img = ep.image_url || (ep.frontmatter && ep.frontmatter.image_url);
      if (img) epFrontmatter.image_url = img;

      const sub = ep.subtitles || (ep.frontmatter && ep.frontmatter.subtitles);
      if (sub) epFrontmatter.subtitles = sub;

      const dur = ep.duration || (ep.frontmatter && ep.frontmatter.duration);
      if (dur) epFrontmatter.duration = dur;

      const epFileContent = serializeTinaTVEpisode(epFrontmatter, ep.content || '');

      if (typeof STATIC_TV_FILES === 'object') {
        STATIC_TV_FILES[epRelativePath] = epFileContent;
        STATIC_TV_FILES[epRelativePath.replace(/\//g, '\\')] = epFileContent;
        STATIC_TV_FILES[epRelativePath.replace(/\\/g, '/')] = epFileContent;
      }

      try {
        const fullEpPath = path.join(process.cwd(), epRelativePath);
        const dir = path.dirname(fullEpPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullEpPath, epFileContent, 'utf8');
      } catch (err: any) {
        console.warn(`[updateAdminContent] Error writing episode ${epRelativePath}:`, err);
      }

      if (token) {
        try {
          await saveGitHubFile(epRelativePath, epFileContent, `cms: update episode ${epRelativePath}`, ghConfig);
        } catch {}
      }
    }
  }

    const targetSlug = isMovie
      ? path.basename(relativePath).replace(/\.(md|markdown)$/i, '')
      : relativePath.split('/')[1] || '';
    selectiveRevalidateAll(targetSlug, cleanFrontmatter?.tmdb_id, isMovie ? 'movie' : 'tv');
    return { success: true, relativePath };
  }

/**
 * Delete content from MongoDB and local filesystem
 */
export async function deleteAdminContent(pathsToDelete: string[], ghConfig: GitHubOptions) {
  const { token } = ghConfig;
  for (const relativePath of pathsToDelete) {
    const isMovie = relativePath.startsWith('video/');
    const isTV = relativePath.startsWith('tv/');

    if (!isMovie && !isTV) continue;

    const isTvShowIndex = isTV && (relativePath.endsWith('/_index.md') || relativePath.endsWith('/index.md'));
    const isTvDirectory = isTV && !relativePath.endsWith('.md') && !relativePath.endsWith('.markdown');
    const isTvEpisode = isTV && !isTvShowIndex && (relativePath.endsWith('.md') || relativePath.endsWith('.markdown'));

    const folderToDelete = isTvShowIndex
      ? relativePath.replace(/\/_?index\.md$/i, '')
      : isTvDirectory
      ? relativePath
      : null;

    let targetSlug = '';
    let targetTmdbId: number | string | undefined = undefined;
    const contentType: 'movie' | 'tv' = isMovie ? 'movie' : 'tv';

    // Remove from in-memory static registry
    if (isMovie && typeof STATIC_MOVIE_FILES === 'object') {
      delete STATIC_MOVIE_FILES[relativePath];
      delete STATIC_MOVIE_FILES[relativePath.replace(/\//g, '\\')];
      delete STATIC_MOVIE_FILES[relativePath.replace(/\\/g, '/')];
      const mSlug = path.basename(relativePath).replace(/\.(md|markdown)$/i, '');
      delete STATIC_MOVIE_FILES[`video/${mSlug}.md`];
      delete STATIC_MOVIE_FILES[`video\\${mSlug}.md`];
      delete STATIC_MOVIE_FILES[`video/${mSlug}`];
    } else if (isTV && typeof STATIC_TV_FILES === 'object') {
      if (folderToDelete) {
        for (const k of Object.keys(STATIC_TV_FILES)) {
          if (k.startsWith(folderToDelete) || k.startsWith(folderToDelete.replace(/\//g, '\\'))) {
            delete STATIC_TV_FILES[k];
          }
        }
      } else {
        delete STATIC_TV_FILES[relativePath];
        delete STATIC_TV_FILES[relativePath.replace(/\//g, '\\')];
        delete STATIC_TV_FILES[relativePath.replace(/\\/g, '/')];
      }
    }

    // Read file on disk first if it exists to extract tmdb_id if possible
    try {
      const fullPath = path.join(process.cwd(), folderToDelete || relativePath);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = matter(raw);
        if (parsed.data?.tmdb_id) targetTmdbId = parsed.data.tmdb_id;
      }
    } catch {}

    // Delete from MongoDB with exact granular multi-key scope
    if (isMongoConfigured()) {
      try {
        if (isMovie) {
          const slug = path.basename(relativePath).replace(/\.(md|markdown)$/i, '');
          targetSlug = slug;
          const mDelRes = await deleteMongoMovie(slug, targetTmdbId);
          if (mDelRes.tmdb_id) targetTmdbId = mDelRes.tmdb_id;
        } else if (isTvShowIndex || isTvDirectory) {
          const showSlug = (folderToDelete || relativePath).replace(/^tv\//, '').split('/')[0];
          targetSlug = showSlug;
          const tDelRes = await deleteMongoTVShow(showSlug, targetTmdbId);
          if (tDelRes.tmdb_id) targetTmdbId = tDelRes.tmdb_id;
        } else if (isTvEpisode) {
          const cleanRel = relativePath.replace(/^tv\//, '');
          const parts = cleanRel.split('/');
          const showSlug = parts[0];
          targetSlug = showSlug;
          const seasonFolder = parts[1] || 's1';
          const episode = path.basename(parts[2] || parts[parts.length - 1] || '').replace(/\.(md|markdown)$/i, '');
          if (showSlug && seasonFolder && episode) {
            await deleteMongoEpisode(showSlug, seasonFolder, episode);
          }
        }
      } catch (mErr) {
        console.warn('[deleteAdminContent] MongoDB delete notice:', mErr);
      }
    }

    // Delete from local filesystem
    try {
      const fullPath = path.join(process.cwd(), folderToDelete || relativePath);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      }
      if (!folderToDelete) {
        const altPath = fullPath.endsWith('.md')
          ? fullPath.replace(/\.md$/i, '.markdown')
          : fullPath.replace(/\.markdown$/i, '.md');
        if (fs.existsSync(altPath)) fs.unlinkSync(altPath);
      }
    } catch (err: any) {
      console.warn(`[deleteAdminContent] Error removing ${relativePath}:`, err);
    }

    if (token) {
      try {
        if (folderToDelete) {
          await deleteGitHubFolder(folderToDelete, `cms: delete folder ${folderToDelete}`, ghConfig);
        } else {
          await deleteGitHubFile(relativePath, `cms: delete ${relativePath}`, ghConfig);
        }
      } catch (ghErr) {
        console.warn(`[deleteAdminContent] Error deleting on GitHub:`, ghErr);
      }
    }

    selectiveRevalidateAll(targetSlug, targetTmdbId, contentType);
  }

  return { success: true, count: pathsToDelete.length };
}

/**
 * Synchronize all MongoDB & local content to GitHub repository in a single batch push.
 */
export async function syncAllToGitHub(ghConfig: GitHubOptions) {
  const { token } = ghConfig;
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk melakukan sinkronisasi ke repository.');
  }

  const res = await syncMongoDBToGitHub(ghConfig);
  selectiveRevalidateAll();
  return { success: true, syncedCount: res.syncedCount, commitSha: res.commitSha, repo: res.repo, deletedCount: 0 };
}

/**
 * Imports all Markdown content from the configured GitHub repository into MongoDB.
 */
export async function importAllFromGitHub(ghConfig: GitHubOptions) {
  const { token } = ghConfig;
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk mengimpor dari repository.');
  }

  const res = await syncGitHubToMongoDB(ghConfig);
  selectiveRevalidateAll();
  return res;
}
