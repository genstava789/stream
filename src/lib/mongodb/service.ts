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
  deleteGitHubFile,
  GitHubOptions,
} from '@/lib/githubStorage';
import { memoryCache } from '@/lib/cache';

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

        const [total, items] = await Promise.all([
          movies.countDocuments(filter),
          movies
            .find(filter)
            .sort({ updatedAt: -1, createdAt: -1 })
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
    300_000, // 5 min TTL
    30_000   // 30s SWR
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

  const existing = await movies.findOne({ slug });
  const doc: MongoMovie = {
    slug,
    tmdb_id: data.tmdb_id !== undefined ? Number(data.tmdb_id) : (existing?.tmdb_id || 0),
    title: (data.title !== undefined ? data.title : (existing?.title || slug)).trim(),
    videourl: (data.videourl !== undefined ? cleanVideoUrl(data.videourl) : (existing?.videourl || '')).trim(),
    image_url: (data.image_url !== undefined ? data.image_url : (existing?.image_url || '')).trim(),
    deskripsi: (data.deskripsi !== undefined ? data.deskripsi : (existing?.deskripsi || '')).trim(),
    rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : (existing?.rating || 0),
    featured: data.featured !== undefined ? Boolean(data.featured) : Boolean(existing?.featured),
    trending: data.trending !== undefined ? Boolean(data.trending) : Boolean(existing?.trending),
    language: data.language !== undefined ? String(data.language).trim().toUpperCase() : (existing?.language || 'ID'),
    weight: data.weight !== undefined && data.weight !== null ? Number(data.weight) : existing?.weight,
    subtitles: (data.subtitles !== undefined ? data.subtitles : (existing?.subtitles || '')).trim(),
    duration: (data.duration !== undefined ? data.duration : (existing?.duration || '')).trim(),
    content: data.content !== undefined ? data.content : (existing?.content || ''),
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: now,
  };

  await movies.updateOne({ slug }, { $set: doc }, { upsert: true });
  invalidateAllMongoCaches();
  return doc;
}

export async function deleteMongoMovie(slug: string): Promise<boolean> {
  const { movies } = await getCollectionsRaw();
  const res = await movies.deleteOne({ slug });
  invalidateAllMongoCaches();
  return res.deletedCount > 0;
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

        const [total, shows] = await Promise.all([
          tvShows.countDocuments(filter),
          tvShows
            .find(filter)
            .sort({ updatedAt: -1, createdAt: -1 })
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
    300_000, // 5 min TTL
    30_000   // 30s SWR
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

  const existing = await tvShows.findOne({ showSlug });
  const showDoc: MongoTVShow = {
    showSlug,
    tmdb_id: data.tmdb_id !== undefined ? Number(data.tmdb_id) : (existing?.tmdb_id || 0),
    title: (data.title !== undefined ? data.title : (existing?.title || showSlug)).trim(),
    image_url: (data.image_url !== undefined ? data.image_url : (existing?.image_url || '')).trim(),
    deskripsi: (data.deskripsi !== undefined ? data.deskripsi : (existing?.deskripsi || '')).trim(),
    rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : (existing?.rating || 0),
    featured: data.featured !== undefined ? Boolean(data.featured) : Boolean(existing?.featured),
    trending: data.trending !== undefined ? Boolean(data.trending) : Boolean(existing?.trending),
    language: data.language !== undefined ? String(data.language).trim().toUpperCase() : (existing?.language || 'ID'),
    weight: data.weight !== undefined && data.weight !== null ? Number(data.weight) : existing?.weight,
    content: data.content !== undefined ? data.content : (existing?.content || ''),
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: now,
  };

  await tvShows.updateOne({ showSlug }, { $set: showDoc }, { upsert: true });

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

export async function deleteMongoTVShow(showSlug: string): Promise<boolean> {
  const { tvShows, episodes } = await getCollectionsRaw();
  await episodes.deleteMany({ showSlug });
  const res = await tvShows.deleteOne({ showSlug });
  invalidateAllMongoCaches();
  return res.deletedCount > 0;
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
  const { token } = ghConfig;
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
    if (m.subtitles) frontmatter.subtitles = m.subtitles;
    if (m.duration) frontmatter.duration = m.duration;

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

    const epContent = serializeTinaTVEpisode(epFrontmatter, ep.content || '');
    filesMap.set(epPath, epContent);
  }

  const filesArray = Array.from(filesMap.entries()).map(([filePath, content]) => ({
    path: filePath,
    content,
  }));

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

    for (const item of contentBlobsOnGitHub) {
      if (!targetFilesSet.has(item.path)) {
        try {
          console.log(`[syncMongoDBToGitHub] Deleting orphan file from GitHub: ${item.path}`);
          await deleteGitHubFile(item.path, `cms: delete ${item.path}`, ghConfig);
        } catch (delErr) {
          console.warn(`[syncMongoDBToGitHub] Warning deleting orphan ${item.path}:`, delErr);
        }
      }
    }
  } catch (treeErr) {
    console.warn('[syncMongoDBToGitHub] GitHub tree prune notice:', treeErr);
  }

  // 5. Commit all active files in a single atomic Git Tree commit (< 1 second)
  const res = await commitMultipleGitHubFiles(
    filesArray,
    `cms: sync ${filesArray.length} content files from CMS`,
    ghConfig
  );

  invalidateAllMongoCaches();

  return { success: true, syncedCount: res.syncedCount };
}
