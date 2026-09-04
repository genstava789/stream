import { getDatabase, isMongoConfigured } from './client';
export { isMongoConfigured };
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { slugify, cleanVideoUrl } from '@/lib/urls';
import { serializeTinaMovie, serializeTinaTVShow, serializeTinaTVEpisode } from '@/lib/tina/schema';
import {
  saveGitHubFile,
  commitMultipleGitHubFiles,
  getGitHubTree,
  getGitHubBlob,
  deleteGitHubFile,
  resolveGitHubOptions,
  GitHubOptions,
} from '@/lib/githubStorage';
import { memoryCache } from '@/lib/cache';
import { STATIC_MOVIE_FILES, STATIC_TV_FILES } from '@/lib/staticContentRegistry';
import { normalizeLangCode } from '@/lib/language';

const SETTINGS_COLLECTION = 'admin_settings';

export interface StoredGitHubSettings {
  _id?: any;
  type: 'github_backup';
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  updatedAt: number;
  lastExportAt?: number;
  lastImportAt?: number;
  lastSyncedCount?: number;
}

export interface MongoMovie {
  _id?: any;
  slug: string;
  tmdb_id: number;
  title: string;
  videourl: string;
  image_url: string;
  deskripsi?: string;
  rating?: number;
  featured?: boolean;
  trending?: boolean;
  language?: string; // e.g. 'ID', 'KR', 'EN'
  weight?: number; // Sorting priority (smaller = first)
  subtitles?: string;
  duration?: string;
  content?: string;
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MongoTVShow {
  _id?: any;
  showSlug: string;
  tmdb_id: number;
  title: string;
  image_url: string;
  deskripsi?: string;
  rating?: number;
  featured?: boolean;
  trending?: boolean;
  language?: string; // e.g. 'ID', 'KR', 'EN'
  weight?: number; // Sorting priority (smaller = first)
  content?: string;
  deleted?: boolean;
  episodes?: MongoTVEpisode[];
  createdAt: number;
  updatedAt: number;
}

export interface MongoTVEpisode {
  _id?: any;
  showSlug: string;
  seasonFolder: string; // e.g. "s1", "s2"
  episode: string; // e.g. "e1", "e2"
  slug: string;
  title: string;
  videourl: string;
  image_url: string;
  deskripsi?: string;
  rating?: number;
  duration?: string;
  subtitles?: string;
  content?: string;
  deleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

const MOVIES_COLLECTION = 'movies';
const TV_SHOWS_COLLECTION = 'tv_shows';
const EPISODES_COLLECTION = 'tv_episodes';

/**
 * Direct collection references without index overhead on every call
 */
async function getCollectionsRaw() {
  if (!isMongoConfigured()) {
    throw new Error('MONGODB_URI is not configured');
  }
  const db = await getDatabase();
  const movies = db.collection<MongoMovie>(MOVIES_COLLECTION);
  const tvShows = db.collection<MongoTVShow>(TV_SHOWS_COLLECTION);
  const episodes = db.collection<MongoTVEpisode>(EPISODES_COLLECTION);
  return { movies, tvShows, episodes };
}

export async function getStoredGitHubSettings(): Promise<StoredGitHubSettings | null> {
  if (!isMongoConfigured()) return null;
  try {
    const db = await getDatabase();
    const settings = await db.collection<StoredGitHubSettings>(SETTINGS_COLLECTION).findOne({ type: 'github_backup' });
    return settings;
  } catch (err) {
    console.warn('[getStoredGitHubSettings] Error:', err);
    return null;
  }
}

export async function saveStoredGitHubSettings(
  data: Partial<StoredGitHubSettings>
): Promise<StoredGitHubSettings | null> {
  if (!isMongoConfigured()) return null;
  try {
    const db = await getDatabase();
    const collection = db.collection<StoredGitHubSettings>(SETTINGS_COLLECTION);
    const existing = await collection.findOne({ type: 'github_backup' });

    const updated: StoredGitHubSettings = {
      type: 'github_backup',
      owner: (data.owner || existing?.owner || process.env.GITHUB_BACKUP_OWNER || process.env.GITHUB_OWNER || 'genstava789').trim(),
      repo: (data.repo || existing?.repo || process.env.GITHUB_BACKUP_REPO || 'filmes-content').trim(),
      branch: (data.branch || existing?.branch || process.env.GITHUB_BACKUP_BRANCH || 'main').trim(),
      token: data.token !== undefined ? data.token.trim() : (existing?.token || ''),
      updatedAt: Date.now(),
      lastExportAt: data.lastExportAt || existing?.lastExportAt,
      lastImportAt: data.lastImportAt || existing?.lastImportAt,
      lastSyncedCount: data.lastSyncedCount !== undefined ? data.lastSyncedCount : existing?.lastSyncedCount,
    };

    await collection.updateOne(
      { type: 'github_backup' },
      { $set: updated },
      { upsert: true }
    );
    return updated;
  } catch (err) {
    console.warn('[saveStoredGitHubSettings] Error:', err);
    return null;
  }
}

// Global initialization lock so index runs only once per runtime process in background
function ensureInitialized() {
  const globalScope = globalThis as any;
  if (!isMongoConfigured() || globalScope._serviceMongoInitialized) return;
  globalScope._serviceMongoInitialized = true;

  // Run in background without blocking current request
  (async () => {
    try {
      const { movies, tvShows, episodes } = await getCollectionsRaw();
      await Promise.allSettled([
        movies.createIndex({ slug: 1 }, { unique: true }),
        movies.createIndex({ tmdb_id: 1 }),
        movies.createIndex({ featured: 1 }),
        movies.createIndex({ trending: 1 }),
        movies.createIndex({ updatedAt: -1 }),
        tvShows.createIndex({ showSlug: 1 }, { unique: true }),
        tvShows.createIndex({ tmdb_id: 1 }),
        tvShows.createIndex({ featured: 1 }),
        tvShows.createIndex({ trending: 1 }),
        tvShows.createIndex({ updatedAt: -1 }),
        episodes.createIndex({ showSlug: 1, seasonFolder: 1, episode: 1 }, { unique: true }),
        episodes.createIndex({ showSlug: 1 }),
      ]);
    } catch (e) {
      console.warn('[MongoDB] Init notice:', e);
    }
  })();
}

/**
 * Seeds initial markdown files into MongoDB
 */
async function seedFromMarkdownFiles(movies: any, tvShows: any, episodes: any) {
  try {
    console.log('[MongoDB] Seeding initial data from markdown files...');
    const VIDEO_DIR = path.join(process.cwd(), 'video');
    const TV_DIR = path.join(process.cwd(), 'tv');

    if (fs.existsSync(VIDEO_DIR)) {
      const files = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(VIDEO_DIR, file), 'utf8');
          const { data, content } = matter(raw);
          const slug = file.replace(/\.(md|markdown)$/i, '');
          const movieDoc: MongoMovie = {
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
            weight: data.weight !== undefined && data.weight !== null ? Number(data.weight) : undefined,
            subtitles: data.subtitles || '',
            duration: data.duration || '',
            content: content || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await movies.updateOne({ slug }, { $setOnInsert: movieDoc }, { upsert: true });
        } catch {}
      }
    }

    if (fs.existsSync(TV_DIR)) {
      const showDirs = fs
        .readdirSync(TV_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const showDir of showDirs) {
        const showPath = path.join(TV_DIR, showDir);
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
          indexData = parsed.data;
          indexContent = parsed.content || '';
        }

        const showDoc: MongoTVShow = {
          showSlug: showDir,
          tmdb_id: Number(indexData.tmdb_id) || 0,
          title: indexData.title || showDir,
          image_url: indexData.image_url || '',
          deskripsi: indexData.deskripsi || '',
          rating: Number(indexData.rating) || 0,
          featured: Boolean(indexData.featured),
          trending: Boolean(indexData.trending),
          language: indexData.language ? String(indexData.language).trim().toUpperCase() : 'ID',
          weight: indexData.weight !== undefined && indexData.weight !== null ? Number(indexData.weight) : undefined,
          content: indexContent || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await tvShows.updateOne({ showSlug: showDir }, { $setOnInsert: showDoc }, { upsert: true });

        const entries = fs.readdirSync(showPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === '_index.md' || entry.name === 'index.md') continue;

          if (entry.isDirectory()) {
            const seasonFolder = entry.name;
            const seasonPath = path.join(showPath, seasonFolder);
            const epFiles = fs.readdirSync(seasonPath).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));

            for (const epFile of epFiles) {
              const raw = fs.readFileSync(path.join(seasonPath, epFile), 'utf8');
              const { data, content } = matter(raw);
              const epSlug = epFile.replace(/\.(md|markdown)$/i, '');
              const epDoc: MongoTVEpisode = {
                showSlug: showDir,
                seasonFolder,
                episode: epSlug,
                slug: epSlug,
                title: data.title || `Episode ${epSlug.replace(/\D/g, '') || '1'}`,
                videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
                image_url: data.image_url || '',
                deskripsi: data.deskripsi || '',
                rating: Number(data.rating) || 0,
                duration: data.duration || '',
                subtitles: data.subtitles || '',
                content: content || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await episodes.updateOne(
                { showSlug: showDir, seasonFolder, episode: epSlug },
                { $setOnInsert: epDoc },
                { upsert: true }
              );
            }
          } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
            const raw = fs.readFileSync(path.join(showPath, entry.name), 'utf8');
            const { data, content } = matter(raw);
            const epSlug = entry.name.replace(/\.(md|markdown)$/i, '');
            const epDoc: MongoTVEpisode = {
              showSlug: showDir,
              seasonFolder: 's1',
              episode: epSlug,
              slug: epSlug,
              title: data.title || `Episode ${epSlug.replace(/\D/g, '') || '1'}`,
              videourl: cleanVideoUrl(data.videourl || data.video_url || '') || '',
              image_url: data.image_url || '',
              deskripsi: data.deskripsi || '',
              rating: Number(data.rating) || 0,
              duration: data.duration || '',
              subtitles: data.subtitles || '',
              content: content || '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await episodes.updateOne(
              { showSlug: showDir, seasonFolder: 's1', episode: epSlug },
              { $set: epDoc },
              { upsert: true }
            );
          }
        }
      }
    }
    console.log('[MongoDB] Seeding complete.');
  } catch (err) {
    console.warn('[MongoDB] Seeding warning:', err);
  }
}

export async function autoSeedMongoDBIfEmpty() {
  ensureInitialized();
}

function invalidateAllMongoCaches() {
  memoryCache.invalidate('mongo_');
  memoryCache.invalidate('markdown_');
  memoryCache.invalidate('featured_');
  memoryCache.invalidate('custom_');
  memoryCache.invalidate('resolved_sections_');
  memoryCache.invalidate('content_provider_');
  memoryCache.invalidate('admin_');
  memoryCache.invalidate('cms_');
  memoryCache.invalidate('bucket_');
  memoryCache.invalidate('hero_');
  memoryCache.invalidate('movie_detail_');
  memoryCache.invalidate('movie_detail_override_');
  memoryCache.invalidate('tv_detail_');
  memoryCache.invalidate('tv_detail_override_');
  memoryCache.invalidate('custom_movie_');
  memoryCache.invalidate('custom_tv_');
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MongoPaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'newest' | 'oldest' | 'rating' | 'title' | 'weight';
  language?: string;
  status?: 'all' | 'trending' | 'featured' | string;
}

export async function getPaginatedMongoMovies(
  options: MongoPaginationOptions = {}
): Promise<PaginatedResult<MongoMovie>> {
  if (!isMongoConfigured()) {
    return { items: [], total: 0, page: 1, limit: 7, totalPages: 1 };
  }
  ensureInitialized();
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Number(options.limit) || 7);
  const search = (options.search || '').trim();
  const skip = (page - 1) * limit;

  return withTimeout(
    (async () => {
      try {
        const { movies } = await getCollectionsRaw();
        const filter: any = {};
        if (search) {
          const num = Number(search);
          const regex = { $regex: search, $options: 'i' };
          filter.$or = [
            { title: regex },
            { slug: regex },
            ...(!isNaN(num) ? [{ tmdb_id: num }] : []),
          ];
        }

        if (options.language && options.language !== 'all') {
          const cleanLang = options.language.toUpperCase().trim();
          if (cleanLang === 'ID') {
            filter.language = { $in: ['ID', 'IND', 'INDONESIA'] };
          } else if (cleanLang === 'MS') {
            filter.language = { $in: ['MS', 'MY', 'MALAY', 'MELAYU'] };
          } else {
            filter.language = cleanLang;
          }
        }

        if (options.status === 'trending') {
          filter.trending = true;
        } else if (options.status === 'featured') {
          filter.featured = true;
        }

        let sortQuery: any = { updatedAt: -1, createdAt: -1 };
        if (options.sort === 'oldest') {
          sortQuery = { updatedAt: 1, createdAt: 1 };
        } else if (options.sort === 'rating') {
          sortQuery = { rating: -1, updatedAt: -1 };
        } else if (options.sort === 'title') {
          sortQuery = { title: 1, slug: 1 };
        } else if (options.sort === 'weight') {
          sortQuery = { weight: 1, updatedAt: -1 };
        } else {
          // 'newest' default
          sortQuery = { updatedAt: -1, createdAt: -1 };
        }

        const [total, items] = await Promise.all([
          movies.countDocuments(filter),
          movies
            .find(filter)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .toArray(),
        ]);

        const totalPages = Math.ceil(total / limit) || 1;
        return { items, total, page, limit, totalPages };
      } catch (err) {
        console.warn('[MongoDB] getPaginatedMongoMovies error:', err);
        return { items: [], total: 0, page, limit, totalPages: 1 };
      }
    })(),
    12000,
    { items: [], total: 0, page, limit, totalPages: 1 }
  );
}

export async function getMongoMovies(): Promise<MongoMovie[]> {
  if (!isMongoConfigured()) return [];
  ensureInitialized();
  return memoryCache.getOrFetch<MongoMovie[]>(
    'mongo_all_movies',
    async () => {
      return withTimeout(
        (async () => {
          try {
            const { movies } = await getCollectionsRaw();
            return await movies.find({}).sort({ updatedAt: -1 }).toArray();
          } catch (err) {
            console.warn('[MongoDB] getMongoMovies error:', err);
            return [];
          }
        })(),
        12000,
        []
      );
    },
    10_000, // 10s TTL (fast deduplication during page render while allowing instant ISR fresh data)
    3_000   // 3s SWR
  );
}

export async function getMongoMovieBySlug(slugOrId: string | number): Promise<MongoMovie | null> {
  if (!isMongoConfigured()) return null;
  const allMovies = await getMongoMovies();
  const rawKey = String(slugOrId).trim().toLowerCase().replace(/\.(md|markdown)$/i, '');
  const idNum = Number(rawKey);
  const trailingMatch = rawKey.match(/-(\d{4,})$/);
  const trailingId = trailingMatch ? Number(trailingMatch[1]) : null;
  const cleanWithoutYearOrId = rawKey.replace(/-(19\d{2}|20\d{2}|\d{4,})$/, '');

  // 1. Fast In-Memory RAM multi-pattern search (0.01ms)
  for (const m of allMovies) {
    const mSlug = m.slug.toLowerCase();
    const mTitleSlug = slugify(m.title || '');

    if (mSlug === rawKey || (!isNaN(idNum) && m.tmdb_id === idNum)) {
      return m;
    }
    if (
      mSlug === cleanWithoutYearOrId ||
      mTitleSlug === rawKey ||
      mTitleSlug === cleanWithoutYearOrId ||
      (m.title && m.title.toLowerCase() === rawKey)
    ) {
      return m;
    }
    if (trailingId && m.tmdb_id === trailingId) {
      return m;
    }
  }

  // Direct database query fallback with 3.5s timeout
  return withTimeout(
    (async () => {
      try {
        const { movies } = await getCollectionsRaw();
        const query = isNaN(idNum)
          ? {
              $or: [
                { slug: rawKey },
                { slug: cleanWithoutYearOrId },
                ...(trailingId ? [{ tmdb_id: trailingId }] : []),
              ],
            }
          : { $or: [{ slug: rawKey }, { tmdb_id: idNum }] };
        return await movies.findOne(query as any);
      } catch (err) {
        console.warn('[MongoDB] getMongoMovieBySlug error:', err);
        return null;
      }
    })(),
    12000,
    null
  );
}

export async function saveMongoMovie(data: Partial<MongoMovie>): Promise<MongoMovie> {
  const { movies } = await getCollectionsRaw();
  const slug = data.slug || (data.title ? slugify(data.title) : `movie-${data.tmdb_id}`);
  const now = Date.now();

  const queryOr: any[] = [{ slug }, { slug: `${slug}.md` }];
  if (data.tmdb_id) queryOr.push({ tmdb_id: Number(data.tmdb_id) });

  const existing = await movies.findOne({ $or: queryOr }).catch(() => null);
  const finalSlug = existing?.slug || slug;

  const doc: MongoMovie = {
    slug: finalSlug,
    tmdb_id: data.tmdb_id !== undefined ? Number(data.tmdb_id) : (existing?.tmdb_id || 0),
    title: (data.title !== undefined ? data.title : (existing?.title || finalSlug)).trim(),
    videourl: (data.videourl !== undefined ? cleanVideoUrl(data.videourl) : (existing?.videourl || '')).trim(),
    image_url: (data.image_url !== undefined ? data.image_url : (existing?.image_url || '')).trim(),
    deskripsi: (data.deskripsi !== undefined ? data.deskripsi : (existing?.deskripsi || '')).trim(),
    rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : (existing?.rating || 0),
    featured: data.featured !== undefined ? Boolean(data.featured) : Boolean(existing?.featured),
    trending: data.trending !== undefined ? Boolean(data.trending) : Boolean(existing?.trending),
    language: data.language !== undefined ? normalizeLangCode(data.language) : (existing?.language || 'ID'),
    weight: data.weight !== undefined && data.weight !== null ? Number(data.weight) : existing?.weight,
    subtitles: (data.subtitles !== undefined ? data.subtitles : (existing?.subtitles || '')).trim(),
    duration: (data.duration !== undefined ? data.duration : (existing?.duration || '')).trim(),
    content: data.content !== undefined ? data.content : (existing?.content || ''),
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };

  await movies.updateOne({ $or: queryOr }, { $set: doc }, { upsert: true });
  invalidateAllMongoCaches();
  return doc;
}

export async function deleteMongoMovie(
  slug: string,
  tmdbId?: number | string
): Promise<{ deletedCount: number; tmdb_id?: number; slug: string; title?: string }> {
  const { movies } = await getCollectionsRaw();
  const cleanSlug = slug.replace(/\.(md|markdown)$/i, '').trim();
  const parsedId = tmdbId ? Number(tmdbId) : Number(cleanSlug);
  const hasValidId = !isNaN(parsedId) && parsedId > 0;

  const orQuery: any[] = [
    { slug: cleanSlug },
    { slug: `${cleanSlug}.md` },
    { slug: cleanSlug.toLowerCase() },
  ];
  if (hasValidId) {
    orQuery.push({ tmdb_id: parsedId });
  }

  const existing = await movies.findOne({ $or: orQuery }).catch(() => null);
  const resolvedTmdbId = existing?.tmdb_id || (hasValidId ? parsedId : undefined);
  const resolvedTitle = existing?.title;

  if (resolvedTmdbId && !orQuery.some((q) => q.tmdb_id === resolvedTmdbId)) {
    orQuery.push({ tmdb_id: resolvedTmdbId });
  }

  const res = await movies.deleteMany({ $or: orQuery });
  invalidateAllMongoCaches();
  return {
    deletedCount: res.deletedCount,
    tmdb_id: resolvedTmdbId,
    slug: cleanSlug,
    title: resolvedTitle,
  };
}

export async function getPaginatedMongoTVShows(
  options: MongoPaginationOptions = {}
): Promise<PaginatedResult<MongoTVShow & { episodes: MongoTVEpisode[] }>> {
  if (!isMongoConfigured()) {
    return { items: [], total: 0, page: 1, limit: 7, totalPages: 1 };
  }
  ensureInitialized();
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Number(options.limit) || 7);
  const search = (options.search || '').trim();
  const skip = (page - 1) * limit;

  return withTimeout(
    (async () => {
      try {
        const { tvShows, episodes } = await getCollectionsRaw();
        const filter: any = {};
        if (search) {
          const num = Number(search);
          const regex = { $regex: search, $options: 'i' };
          filter.$or = [
            { title: regex },
            { showSlug: regex },
            ...(!isNaN(num) ? [{ tmdb_id: num }] : []),
          ];
        }

        if (options.language && options.language !== 'all') {
          const cleanLang = options.language.toUpperCase().trim();
          if (cleanLang === 'ID') {
            filter.language = { $in: ['ID', 'IND', 'INDONESIA'] };
          } else if (cleanLang === 'MS') {
            filter.language = { $in: ['MS', 'MY', 'MALAY', 'MELAYU'] };
          } else {
            filter.language = cleanLang;
          }
        }

        if (options.status === 'trending') {
          filter.trending = true;
        } else if (options.status === 'featured') {
          filter.featured = true;
        }

        let sortQuery: any = { updatedAt: -1, createdAt: -1 };
        if (options.sort === 'oldest') {
          sortQuery = { updatedAt: 1, createdAt: 1 };
        } else if (options.sort === 'rating') {
          sortQuery = { rating: -1, updatedAt: -1 };
        } else if (options.sort === 'title') {
          sortQuery = { title: 1, showSlug: 1 };
        } else if (options.sort === 'weight') {
          sortQuery = { weight: 1, updatedAt: -1 };
        } else {
          // 'newest' default
          sortQuery = { updatedAt: -1, createdAt: -1 };
        }

        const [total, shows] = await Promise.all([
          tvShows.countDocuments(filter),
          tvShows
            .find(filter)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .toArray(),
        ]);

        const showSlugs = shows.map((s) => s.showSlug);
        const eps =
          showSlugs.length > 0
            ? await episodes
                .find({ showSlug: { $in: showSlugs }, deleted: { $ne: true } })
                .toArray()
            : [];

        const items = shows.map((s) => ({
          ...s,
          episodes: eps.filter((ep) => ep.showSlug === s.showSlug),
        }));

        const totalPages = Math.ceil(total / limit) || 1;
        return { items, total, page, limit, totalPages };
      } catch (err) {
        console.warn('[MongoDB] getPaginatedMongoTVShows error:', err);
        return { items: [], total: 0, page, limit, totalPages: 1 };
      }
    })(),
    12000,
    { items: [], total: 0, page, limit, totalPages: 1 }
  );
}

export async function getMongoContentCounts(): Promise<{
  totalMovies: number;
  totalTVShows: number;
  totalEpisodes: number;
}> {
  if (!isMongoConfigured()) {
    return { totalMovies: 0, totalTVShows: 0, totalEpisodes: 0 };
  }
  ensureInitialized();
  return withTimeout(
    (async () => {
      try {
        const { movies, tvShows, episodes } = await getCollectionsRaw();
        const [totalMovies, totalTVShows, totalEpisodes] = await Promise.all([
          movies.countDocuments(),
          tvShows.countDocuments(),
          episodes.countDocuments({ deleted: { $ne: true } }),
        ]);
        return { totalMovies, totalTVShows, totalEpisodes };
      } catch (err) {
        console.warn('[MongoDB] getMongoContentCounts error:', err);
        return { totalMovies: 0, totalTVShows: 0, totalEpisodes: 0 };
      }
    })(),
    12000,
    { totalMovies: 0, totalTVShows: 0, totalEpisodes: 0 }
  );
}

export async function getMongoTVShows(): Promise<(MongoTVShow & { episodes: MongoTVEpisode[] })[]> {
  if (!isMongoConfigured()) return [];
  ensureInitialized();
  return memoryCache.getOrFetch<(MongoTVShow & { episodes: MongoTVEpisode[] })[]>(
    'mongo_all_tv_shows',
    async () => {
      return withTimeout(
        (async () => {
          try {
            const { tvShows, episodes } = await getCollectionsRaw();
            const shows = await tvShows.find({}).sort({ updatedAt: -1 }).toArray();
            const allEpisodes = await episodes.find({}).toArray();

            return shows.map((s) => ({
              ...s,
              episodes: allEpisodes.filter((ep) => ep.showSlug === s.showSlug),
            }));
          } catch (err) {
            console.warn('[MongoDB] getMongoTVShows error:', err);
            return [];
          }
        })(),
        12000,
        []
      );
    },
    10_000, // 10s TTL (fast deduplication during page render while allowing instant ISR fresh data)
    3_000   // 3s SWR
  );
}

export async function getMongoTVShowBySlug(
  showSlugOrId: string | number
): Promise<(MongoTVShow & { episodes: MongoTVEpisode[] }) | null> {
  if (!isMongoConfigured()) return null;
  const allShows = await getMongoTVShows();
  const rawKey = String(showSlugOrId).trim().toLowerCase().replace(/\.(md|markdown)$/i, '');
  const idNum = Number(rawKey);
  const trailingMatch = rawKey.match(/-(\d{4,})$/);
  const trailingId = trailingMatch ? Number(trailingMatch[1]) : null;
  const cleanWithoutYearOrId = rawKey.replace(/-(19\d{2}|20\d{2}|\d{4,})$/, '');

  // 1. Fast In-Memory RAM multi-pattern search (0.01ms)
  for (const s of allShows) {
    const sSlug = s.showSlug.toLowerCase();
    const sTitleSlug = slugify(s.title || '');

    if (sSlug === rawKey || (!isNaN(idNum) && s.tmdb_id === idNum)) {
      return s;
    }
    if (
      sSlug === cleanWithoutYearOrId ||
      sTitleSlug === rawKey ||
      sTitleSlug === cleanWithoutYearOrId ||
      (s.title && s.title.toLowerCase() === rawKey)
    ) {
      return s;
    }
    if (trailingId && s.tmdb_id === trailingId) {
      return s;
    }
  }

  // Direct database query fallback with 12s timeout
  return withTimeout(
    (async () => {
      try {
        const { tvShows, episodes } = await getCollectionsRaw();
        const query = isNaN(idNum)
          ? {
              $or: [
                { showSlug: rawKey },
                { showSlug: cleanWithoutYearOrId },
                ...(trailingId ? [{ tmdb_id: trailingId }] : []),
              ],
            }
          : { $or: [{ showSlug: rawKey }, { tmdb_id: idNum }] };
        const show = await tvShows.findOne(query as any);
        if (!show) return null;

        const eps = await episodes.find({ showSlug: show.showSlug }).toArray();
        return {
          ...show,
          episodes: eps,
        };
      } catch (err) {
        console.warn('[MongoDB] getMongoTVShowBySlug error:', err);
        return null;
      }
    })(),
    12000,
    null
  );
}

export async function saveMongoTVShow(
  data: Partial<MongoTVShow>,
  episodesList: Partial<MongoTVEpisode>[] = []
): Promise<MongoTVShow> {
  const { tvShows, episodes } = await getCollectionsRaw();
  const showSlug = data.showSlug || (data.title ? slugify(data.title) : `tv-${data.tmdb_id}`);
  const now = Date.now();

  const queryOr: any[] = [{ showSlug }, { showSlug: `${showSlug}.md` }];
  if (data.tmdb_id) queryOr.push({ tmdb_id: Number(data.tmdb_id) });

  const existing = await tvShows.findOne({ $or: queryOr }).catch(() => null);
  const finalShowSlug = existing?.showSlug || showSlug;

  const showDoc: MongoTVShow = {
    showSlug: finalShowSlug,
    tmdb_id: data.tmdb_id !== undefined ? Number(data.tmdb_id) : (existing?.tmdb_id || 0),
    title: (data.title !== undefined ? data.title : (existing?.title || finalShowSlug)).trim(),
    image_url: (data.image_url !== undefined ? data.image_url : (existing?.image_url || '')).trim(),
    deskripsi: (data.deskripsi !== undefined ? data.deskripsi : (existing?.deskripsi || '')).trim(),
    rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : (existing?.rating || 0),
    featured: data.featured !== undefined ? Boolean(data.featured) : Boolean(existing?.featured),
    trending: data.trending !== undefined ? Boolean(data.trending) : Boolean(existing?.trending),
    language: data.language !== undefined ? normalizeLangCode(data.language) : (existing?.language || 'ID'),
    weight: data.weight !== undefined && data.weight !== null ? Number(data.weight) : existing?.weight,
    content: data.content !== undefined ? data.content : (existing?.content || ''),
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };

  await tvShows.updateOne({ $or: queryOr }, { $set: showDoc }, { upsert: true });

  // Save/Update episodes
  for (const ep of episodesList) {
    const cleanEp = (ep.episode || ep.slug || 'e1').trim();
    const seasonFolder = (ep.seasonFolder || 's1').toLowerCase().trim();

    if (ep.deleted) {
      if (cleanEp && seasonFolder) {
        await episodes.deleteOne({
          showSlug,
          seasonFolder,
          episode: cleanEp,
        });
      }
      continue;
    }

    const existingEp = await episodes.findOne({ showSlug, seasonFolder, episode: cleanEp });

    const epDoc: MongoTVEpisode = {
      showSlug,
      seasonFolder,
      episode: cleanEp,
      slug: cleanEp,
      title: ep.title !== undefined ? ep.title.trim() : (existingEp?.title || `Episode ${cleanEp.replace(/\D/g, '') || '1'}`),
      videourl: ep.videourl !== undefined ? cleanVideoUrl(ep.videourl) : (existingEp?.videourl || ''),
      image_url: ep.image_url !== undefined ? ep.image_url.trim() : (existingEp?.image_url || showDoc.image_url || ''),
      deskripsi: ep.deskripsi !== undefined ? ep.deskripsi.trim() : (existingEp?.deskripsi || ''),
      rating: ep.rating !== undefined && ep.rating !== null ? Number(ep.rating) : (existingEp?.rating || 0),
      duration: ep.duration !== undefined ? ep.duration.trim() : (existingEp?.duration || ''),
      subtitles: ep.subtitles !== undefined ? ep.subtitles.trim() : (existingEp?.subtitles || ''),
      content: ep.content !== undefined ? ep.content : (existingEp?.content || ''),
      createdAt: existingEp?.createdAt || ep.createdAt || now,
      updatedAt: now,
    };

    await episodes.updateOne(
      { showSlug, seasonFolder, episode: cleanEp },
      { $set: epDoc },
      { upsert: true }
    );
  }

  invalidateAllMongoCaches();
  return showDoc;
}

export async function deleteMongoTVShow(
  showSlug: string,
  tmdbId?: number | string
): Promise<{ deletedCount: number; tmdb_id?: number; showSlug: string; title?: string }> {
  const { tvShows, episodes } = await getCollectionsRaw();
  const cleanShowSlug = showSlug.replace(/\/_?index\.md$/i, '').replace(/\.(md|markdown)$/i, '').trim();
  const parsedId = tmdbId ? Number(tmdbId) : Number(cleanShowSlug);
  const hasValidId = !isNaN(parsedId) && parsedId > 0;

  const orQuery: any[] = [
    { showSlug: cleanShowSlug },
    { showSlug: cleanShowSlug.toLowerCase() },
  ];
  if (hasValidId) {
    orQuery.push({ tmdb_id: parsedId });
  }

  const existing = await tvShows.findOne({ $or: orQuery }).catch(() => null);
  const resolvedTmdbId = existing?.tmdb_id || (hasValidId ? parsedId : undefined);
  const resolvedTitle = existing?.title;

  if (resolvedTmdbId && !orQuery.some((q) => q.tmdb_id === resolvedTmdbId)) {
    orQuery.push({ tmdb_id: resolvedTmdbId });
  }

  await episodes.deleteMany({
    $or: [
      { showSlug: cleanShowSlug },
      ...(existing?.showSlug ? [{ showSlug: existing.showSlug }] : []),
    ],
  });
  const res = await tvShows.deleteMany({ $or: orQuery });
  invalidateAllMongoCaches();
  return {
    deletedCount: res.deletedCount,
    tmdb_id: resolvedTmdbId,
    showSlug: cleanShowSlug,
    title: resolvedTitle,
  };
}

export async function deleteMongoEpisode(showSlug: string, seasonFolder: string, episode: string): Promise<boolean> {
  const { episodes } = await getCollectionsRaw();
  const cleanEp = episode.replace(/\.(md|markdown)$/i, '');
  const res = await episodes.deleteOne({ showSlug, seasonFolder, episode: cleanEp });
  invalidateAllMongoCaches();
  return res.deletedCount > 0;
}

// ──────────────────────────────────────────
export async function flushStagedContent(): Promise<{ flushedCount: number }> {
  try {
    const { movies, tvShows, episodes } = await getCollectionsRaw();
    const [mRes, tRes, eRes] = await Promise.all([
      movies.deleteMany({}),
      tvShows.deleteMany({}),
      episodes.deleteMany({}),
    ]);
    invalidateAllMongoCaches();
    const flushedCount = (mRes.deletedCount || 0) + (tRes.deletedCount || 0) + (eRes.deletedCount || 0);
    console.log(`[MongoDB] Staging buffer flushed: ${flushedCount} items cleared from database`);
    return { flushedCount };
  } catch (err) {
    console.warn('[MongoDB] flushStagedContent notice:', err);
    return { flushedCount: 0 };
  }
}

// ──────────────────────────────────────────
// SYNC MONGODB TO GITHUB (ATOMIC BULK COMMIT)
// ──────────────────────────────────────────

export async function syncMongoDBToGitHub(ghConfig: GitHubOptions) {
  const { token, owner, repo } = resolveGitHubOptions(ghConfig);
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk melakukan sinkronisasi ke repository.');
  }

  // 1. Fetch freshest, live un-cached data directly from MongoDB staging buffer
  const { movies, tvShows, episodes } = await getCollectionsRaw();
  const [allMovies, allShows, allEpisodes] = await Promise.all([
    movies.find({}).sort({ updatedAt: -1 }).toArray(),
    tvShows.find({}).sort({ updatedAt: -1 }).toArray(),
    episodes.find({ deleted: { $ne: true } }).toArray(),
  ]);

  const filesMap = new Map<string, string>();

  // 2. Format all movies
  for (const m of allMovies) {
    const relPath = `video/${m.slug}.md`;
    const frontmatter: Record<string, any> = {
      tmdb_id: m.tmdb_id,
      title: m.title,
      videourl: m.videourl,
    };
    if (m.image_url) frontmatter.image_url = m.image_url;
    if (m.deskripsi) frontmatter.deskripsi = m.deskripsi;
    if (m.rating !== undefined && m.rating !== null) frontmatter.rating = m.rating;
    if (m.featured) frontmatter.featured = true;
    if (m.trending) frontmatter.trending = true;
    if (m.language) frontmatter.language = m.language;
    if (m.weight !== undefined && m.weight !== null) frontmatter.weight = m.weight;
    if (m.subtitles) frontmatter.subtitles = m.subtitles;
    if (m.duration) frontmatter.duration = m.duration;
    if (m.createdAt) frontmatter.createdAt = m.createdAt;
    if (m.updatedAt) frontmatter.updatedAt = m.updatedAt;
    frontmatter.date = new Date(m.createdAt || m.updatedAt || Date.now()).toISOString();

    const content = serializeTinaMovie(frontmatter, m.content || '');
    filesMap.set(relPath, content);
  }

  // 3. Format all TV shows & episodes
  for (const s of allShows) {
    const indexPath = `tv/${s.showSlug}/_index.md`;
    const indexFrontmatter: Record<string, any> = {
      tmdb_id: s.tmdb_id,
      title: s.title,
    };
    if (s.image_url) indexFrontmatter.image_url = s.image_url;
    if (s.deskripsi) indexFrontmatter.deskripsi = s.deskripsi;
    if (s.rating !== undefined && s.rating !== null) indexFrontmatter.rating = s.rating;
    if (s.featured) indexFrontmatter.featured = true;
    if (s.trending) indexFrontmatter.trending = true;
    if (s.language) indexFrontmatter.language = s.language;
    if (s.weight !== undefined && s.weight !== null) indexFrontmatter.weight = s.weight;
    if (s.createdAt) indexFrontmatter.createdAt = s.createdAt;
    if (s.updatedAt) indexFrontmatter.updatedAt = s.updatedAt;
    indexFrontmatter.date = new Date(s.createdAt || s.updatedAt || Date.now()).toISOString();

    const indexContent = serializeTinaTVShow(indexFrontmatter, s.content || '');
    filesMap.set(indexPath, indexContent);
  }

  for (const ep of allEpisodes) {
    const epPath = `tv/${ep.showSlug}/${ep.seasonFolder}/${ep.episode}.md`;
    const epFrontmatter: Record<string, any> = {
      title: ep.title,
      videourl: ep.videourl,
    };
    if (ep.image_url) epFrontmatter.image_url = ep.image_url;
    if (ep.deskripsi) epFrontmatter.deskripsi = ep.deskripsi;
    if (ep.rating !== undefined && ep.rating !== null) epFrontmatter.rating = ep.rating;
    if (ep.duration) epFrontmatter.duration = ep.duration;
    if (ep.subtitles) epFrontmatter.subtitles = ep.subtitles;
    if (ep.createdAt) epFrontmatter.createdAt = ep.createdAt;
    if (ep.updatedAt) epFrontmatter.updatedAt = ep.updatedAt;
    epFrontmatter.date = new Date(ep.createdAt || ep.updatedAt || Date.now()).toISOString();

    const epContent = serializeTinaTVEpisode(epFrontmatter, ep.content || '');
    filesMap.set(epPath, epContent);
  }

  const filesArray = Array.from(filesMap.entries()).map(([filePath, content]) => ({
    path: filePath,
    content,
  }));

  if (filesArray.length === 0) {
    throw new Error('Tidak ada data konten di MongoDB untuk di-export ke repository GitHub.');
  }

  // 4. Check for orphan/deleted files on GitHub repository that are no longer in MongoDB
  try {
    const targetFilesSet = new Set(filesArray.map((f) => f.path.replace(/^\/+/, '')));
    const ghTree = await getGitHubTree(ghConfig);
    const contentBlobsOnGitHub = ghTree.filter(
      (item) =>
        item.type === 'blob' &&
        (item.path.startsWith('video/') || item.path.startsWith('tv/')) &&
        (item.path.endsWith('.md') || item.path.endsWith('.markdown'))
    );

    const orphansToDelete = contentBlobsOnGitHub.filter((item) => !targetFilesSet.has(item.path));
    if (orphansToDelete.length > 0) {
      // Parallel batch deletion up to 10 files at a time to prevent serverless timeout
      const batchSize = 10;
      for (let i = 0; i < orphansToDelete.length; i += batchSize) {
        const chunk = orphansToDelete.slice(i, i + batchSize);
        await Promise.allSettled(
          chunk.map((item) => deleteGitHubFile(item.path, `cms: delete orphan ${item.path}`, ghConfig))
        );
      }
    }
  } catch (treeErr) {
    console.warn('[syncMongoDBToGitHub] GitHub tree prune notice:', treeErr);
  }

  // 5. Commit all active files in a single atomic Git Tree commit (< 1 second)
  const res = await commitMultipleGitHubFiles(
    filesArray,
    `cms: sync ${filesArray.length} content files from CMS to ${owner}/${repo}`,
    ghConfig
  );

  if (res.syncedCount === 0) {
    throw new Error(`Tidak ada file yang berhasil di-push ke repository '${owner}/${repo}'. Pastikan token memiliki izin 'repo'.`);
  }

  invalidateAllMongoCaches();

  // Save lastExportAt timestamp in settings
  await saveStoredGitHubSettings({
    lastExportAt: Date.now(),
    lastSyncedCount: res.syncedCount,
  });

  return {
    success: true,
    syncedCount: res.syncedCount,
    commitSha: res.commitSha,
    repo: `${owner}/${repo}`,
    createdRepo: res.createdRepo,
  };
}

/**
 * Bulk imports all Markdown files from GitHub Content Repository into MongoDB.
 * Uses getGitHubTree to fetch repo structure in 1 call, fetches blobs in concurrent chunks of 15,
 * preserves existing timestamps so newly created CMS content is never displaced,
 * and updates local disk + in-memory static registry for immediate synchronization.
 */
export async function syncGitHubToMongoDB(ghConfig: GitHubOptions): Promise<{
  success: boolean;
  importedMovies: number;
  importedShows: number;
  importedEpisodes: number;
  totalFiles: number;
  repo: string;
}> {
  const { token, owner, repo } = resolveGitHubOptions(ghConfig);
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk melakukan import dari repository.');
  }

  const { movies, tvShows, episodes } = await getCollectionsRaw();

  // 1. Fetch entire GitHub file tree in 1 fast API call
  const ghTree = await getGitHubTree(ghConfig);
  if (!ghTree || ghTree.length === 0) {
    throw new Error(`Tidak ada file ditemukan pada repository '${owner}/${repo}'. Pastikan repository memiliki file Markdown di video/ atau tv/.`);
  }

  // Filter content blobs
  const movieBlobs = ghTree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path.startsWith('video/') &&
      (item.path.endsWith('.md') || item.path.endsWith('.markdown'))
  );

  const tvIndexBlobs = ghTree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path.startsWith('tv/') &&
      (item.path.endsWith('/_index.md') || item.path.endsWith('/index.md'))
  );

  const episodeBlobs = ghTree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path.startsWith('tv/') &&
      !item.path.endsWith('/_index.md') &&
      !item.path.endsWith('/index.md') &&
      (item.path.endsWith('.md') || item.path.endsWith('.markdown'))
  );

  const totalContentBlobs = movieBlobs.length + tvIndexBlobs.length + episodeBlobs.length;
  if (totalContentBlobs === 0) {
    return {
      success: true,
      importedMovies: 0,
      importedShows: 0,
      importedEpisodes: 0,
      totalFiles: 0,
      repo: `${owner}/${repo}`,
    };
  }

  // Helper to fetch blob contents in concurrent chunks
  const fetchBlobContents = async (blobs: typeof movieBlobs, chunkSize = 15) => {
    const results: { path: string; content: string }[] = [];
    for (let i = 0; i < blobs.length; i += chunkSize) {
      const chunk = blobs.slice(i, i + chunkSize);
      const batch = await Promise.all(
        chunk.map(async (blob) => {
          try {
            const content = await getGitHubBlob(blob.sha, ghConfig);
            return { path: blob.path, content: content || '' };
          } catch {
            return { path: blob.path, content: '' };
          }
        })
      );
      results.push(...batch);
    }
    return results;
  };

  const now = Date.now();

  // 1b. Fetch existing movies, shows, and episodes from MongoDB to preserve existing timestamps & newly created content
  const [existingMovies, existingShows, existingEps] = await Promise.all([
    movies.find({}).project({ slug: 1, createdAt: 1, updatedAt: 1 }).toArray(),
    tvShows.find({}).project({ showSlug: 1, createdAt: 1, updatedAt: 1 }).toArray(),
    episodes.find({}).project({ showSlug: 1, seasonFolder: 1, episode: 1, createdAt: 1, updatedAt: 1 }).toArray(),
  ]);

  const existingMovieMap = new Map(existingMovies.map((m) => [m.slug, m]));
  const existingShowMap = new Map(existingShows.map((s) => [s.showSlug, s]));
  const existingEpMap = new Map(
    existingEps.map((e) => [`${e.showSlug}/${e.seasonFolder}/${e.episode}`, e])
  );

  // 2. Fetch and prepare Movies
  const fetchedMovies = await fetchBlobContents(movieBlobs);
  const movieOps: any[] = [];
  for (let i = 0; i < fetchedMovies.length; i++) {
    const m = fetchedMovies[i];
    if (!m.content) continue;
    try {
      const parsed = matter(m.content);
      const fm = parsed.data || {};
      const slug = m.path.replace(/^video\//, '').replace(/\.(md|markdown)$/i, '');
      const existing = existingMovieMap.get(slug);

      const parsedCreatedAt = Number(fm.createdAt) || (fm.date ? new Date(fm.date).getTime() : 0);
      const parsedUpdatedAt = Number(fm.updatedAt) || parsedCreatedAt;
      // Historical fallback ensures older backup items don't jump ahead of newly created CMS items
      const fallbackTime = now - 86400000 - (i * 1000);

      const doc: MongoMovie = {
        slug,
        tmdb_id: Number(fm.tmdb_id) || 0,
        title: String(fm.title || slug).trim(),
        videourl: cleanVideoUrl(String(fm.videourl || fm.video_url || '')),
        image_url: String(fm.image_url || fm.poster || '').trim(),
        deskripsi: String(fm.deskripsi || fm.desc || fm.overview || '').trim(),
        rating: fm.rating !== undefined && fm.rating !== null ? Number(fm.rating) : 0,
        featured: Boolean(fm.featured),
        trending: Boolean(fm.trending),
        language: String(fm.language || 'ID').toUpperCase().trim(),
        weight: fm.weight !== undefined && fm.weight !== null ? Number(fm.weight) : undefined,
        subtitles: String(fm.subtitles || '').trim(),
        duration: String(fm.duration || '').trim(),
        content: parsed.content || '',
        createdAt: existing?.createdAt || parsedCreatedAt || fallbackTime,
        updatedAt: parsedUpdatedAt || existing?.updatedAt || fallbackTime,
      };

      movieOps.push({
        updateOne: {
          filter: { slug },
          update: { $set: doc },
          upsert: true,
        },
      });

      // Write to local disk & in-memory static registry if available
      try {
        const fullDiskPath = path.join(process.cwd(), m.path);
        const dir = path.dirname(fullDiskPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullDiskPath, m.content, 'utf8');
      } catch {}

      if (typeof STATIC_MOVIE_FILES === 'object') {
        STATIC_MOVIE_FILES[m.path] = m.content;
        STATIC_MOVIE_FILES[m.path.replace(/\//g, '\\')] = m.content;
        STATIC_MOVIE_FILES[m.path.replace(/\\/g, '/')] = m.content;
      }
    } catch (parseErr) {
      console.warn(`[syncGitHubToMongoDB] Error parsing movie ${m.path}:`, parseErr);
    }
  }

  // 3. Fetch and prepare TV Shows
  const fetchedTvIndex = await fetchBlobContents(tvIndexBlobs);
  const showOps: any[] = [];
  for (let i = 0; i < fetchedTvIndex.length; i++) {
    const s = fetchedTvIndex[i];
    if (!s.content) continue;
    try {
      const parsed = matter(s.content);
      const fm = parsed.data || {};
      const parts = s.path.split('/');
      const showSlug = parts[1] || 'unknown';
      const existing = existingShowMap.get(showSlug);

      const parsedCreatedAt = Number(fm.createdAt) || (fm.date ? new Date(fm.date).getTime() : 0);
      const parsedUpdatedAt = Number(fm.updatedAt) || parsedCreatedAt;
      const fallbackTime = now - 86400000 - (i * 1000);

      const doc: MongoTVShow = {
        showSlug,
        tmdb_id: Number(fm.tmdb_id) || 0,
        title: String(fm.title || showSlug).trim(),
        image_url: String(fm.image_url || fm.poster || '').trim(),
        deskripsi: String(fm.deskripsi || fm.desc || fm.overview || '').trim(),
        rating: fm.rating !== undefined && fm.rating !== null ? Number(fm.rating) : 0,
        featured: Boolean(fm.featured),
        trending: Boolean(fm.trending),
        language: String(fm.language || 'ID').toUpperCase().trim(),
        weight: fm.weight !== undefined && fm.weight !== null ? Number(fm.weight) : undefined,
        content: parsed.content || '',
        createdAt: existing?.createdAt || parsedCreatedAt || fallbackTime,
        updatedAt: parsedUpdatedAt || existing?.updatedAt || fallbackTime,
      };

      showOps.push({
        updateOne: {
          filter: { showSlug },
          update: { $set: doc },
          upsert: true,
        },
      });

      // Write to local disk & in-memory static registry if available
      try {
        const fullDiskPath = path.join(process.cwd(), s.path);
        const dir = path.dirname(fullDiskPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullDiskPath, s.content, 'utf8');
      } catch {}

      if (typeof STATIC_TV_FILES === 'object') {
        STATIC_TV_FILES[s.path] = s.content;
        STATIC_TV_FILES[s.path.replace(/\//g, '\\')] = s.content;
        STATIC_TV_FILES[s.path.replace(/\\/g, '/')] = s.content;
      }
    } catch (parseErr) {
      console.warn(`[syncGitHubToMongoDB] Error parsing TV show ${s.path}:`, parseErr);
    }
  }

  // 4. Fetch and prepare TV Episodes
  const fetchedEpisodes = await fetchBlobContents(episodeBlobs);
  const episodeOps: any[] = [];
  for (let i = 0; i < fetchedEpisodes.length; i++) {
    const ep = fetchedEpisodes[i];
    if (!ep.content) continue;
    try {
      const parsed = matter(ep.content);
      const fm = parsed.data || {};
      const parts = ep.path.split('/');
      const showSlug = parts[1] || 'unknown';
      const seasonFolder = parts.length > 3 ? parts[2].toLowerCase().trim() : 's1';
      const rawEp = parts[parts.length - 1].replace(/\.(md|markdown)$/i, '').trim();
      const cleanEp = rawEp.toLowerCase().startsWith('e') ? rawEp.toLowerCase() : `e${rawEp.replace(/\D/g, '') || '1'}`;
      const existing = existingEpMap.get(`${showSlug}/${seasonFolder}/${cleanEp}`);

      const parsedCreatedAt = Number(fm.createdAt) || (fm.date ? new Date(fm.date).getTime() : 0);
      const parsedUpdatedAt = Number(fm.updatedAt) || parsedCreatedAt;
      const fallbackTime = now - 86400000 - (i * 1000);

      const epDoc: MongoTVEpisode = {
        showSlug,
        seasonFolder,
        episode: cleanEp,
        slug: cleanEp,
        title: String(fm.title || `Episode ${cleanEp.replace(/\D/g, '') || '1'}`).trim(),
        videourl: cleanVideoUrl(String(fm.videourl || fm.video_url || '')),
        image_url: String(fm.image_url || fm.poster || '').trim(),
        deskripsi: String(fm.deskripsi || fm.desc || '').trim(),
        rating: fm.rating !== undefined && fm.rating !== null ? Number(fm.rating) : 0,
        duration: String(fm.duration || '').trim(),
        subtitles: String(fm.subtitles || '').trim(),
        content: parsed.content || '',
        createdAt: existing?.createdAt || parsedCreatedAt || fallbackTime,
        updatedAt: parsedUpdatedAt || existing?.updatedAt || fallbackTime,
      };

      episodeOps.push({
        updateOne: {
          filter: { showSlug, seasonFolder, episode: cleanEp },
          update: { $set: epDoc },
          upsert: true,
        },
      });

      // Write to local disk & in-memory static registry if available
      try {
        const fullDiskPath = path.join(process.cwd(), ep.path);
        const dir = path.dirname(fullDiskPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullDiskPath, ep.content, 'utf8');
      } catch {}

      if (typeof STATIC_TV_FILES === 'object') {
        STATIC_TV_FILES[ep.path] = ep.content;
        STATIC_TV_FILES[ep.path.replace(/\//g, '\\')] = ep.content;
        STATIC_TV_FILES[ep.path.replace(/\\/g, '/')] = ep.content;
      }
    } catch (parseErr) {
      console.warn(`[syncGitHubToMongoDB] Error parsing TV episode ${ep.path}:`, parseErr);
    }
  }

  // 5. Execute MongoDB bulk writes in parallel
  await Promise.all([
    movieOps.length > 0 ? movies.bulkWrite(movieOps, { ordered: false }) : Promise.resolve(),
    showOps.length > 0 ? tvShows.bulkWrite(showOps, { ordered: false }) : Promise.resolve(),
    episodeOps.length > 0 ? episodes.bulkWrite(episodeOps, { ordered: false }) : Promise.resolve(),
  ]);

  invalidateAllMongoCaches();

  // 6. Update lastImportAt in MongoDB admin_settings
  await saveStoredGitHubSettings({ lastImportAt: now });

  return {
    success: true,
    importedMovies: movieOps.length,
    importedShows: showOps.length,
    importedEpisodes: episodeOps.length,
    totalFiles: totalContentBlobs,
    repo: `${owner}/${repo}`,
  };
}

