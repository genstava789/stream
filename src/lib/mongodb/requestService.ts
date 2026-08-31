import { ObjectId } from 'mongodb';
import { getDatabase, isMongoConfigured } from './client';
import { memoryCache } from '@/lib/cache';

export interface MongoMediaRequest {
  _id?: ObjectId | string;
  id?: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: 'owner' | 'admin' | 'member';
  mediaType: 'movie' | 'tv';
  tmdbId?: number | null;
  title: string;
  year?: string | number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres?: string[];
  season?: string;
  message?: string;
  votes: number;
  votedBy: string[];
  hasVoted?: boolean;
  status: 'pending' | 'available' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

const REQUESTS_COLLECTION = 'requests';

async function getRequestsCol() {
  const db = await getDatabase();
  return db.collection<MongoMediaRequest>(REQUESTS_COLLECTION);
}

function ensureRequestIndexesBackground() {
  const globalScope = globalThis as any;
  if (globalScope._requestIndexesInitialized) return;
  globalScope._requestIndexesInitialized = true;
  (async () => {
    try {
      const col = await getRequestsCol();
      await Promise.allSettled([
        col.createIndex({ tmdbId: 1, mediaType: 1 }),
        col.createIndex({ title: 'text', authorName: 'text', message: 'text' }),
        col.createIndex({ votes: -1, createdAt: -1 }),
        col.createIndex({ createdAt: -1 }),
        col.createIndex({ userId: 1 }),
      ]);
    } catch (err) {
      console.warn('[MongoDB] ensureRequestIndexesBackground notice:', err);
    }
  })();
}

/**
 * Executes a MongoDB operation with 1 automatic retry on transient errors
 */
async function withMongoRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes('SSL') ||
      msg.includes('tlsv1') ||
      msg.includes('closed') ||
      msg.includes('topology') ||
      msg.includes('connection') ||
      msg.includes('ECONNRESET') ||
      msg.includes('pool')
    ) {
      console.warn('[MongoDB] Transient connection notice in requests, retrying once:', msg);
      return await operation();
    }
    throw err;
  }
}

/**
 * Checks if a pending request for the given TMDB ID or normalized title already exists.
 */
export async function findDuplicateRequest(params: {
  tmdbId?: number | null;
  title: string;
  mediaType: 'movie' | 'tv';
}): Promise<MongoMediaRequest | null> {
  ensureRequestIndexesBackground();
  return withMongoRetry(async () => {
    const col = await getRequestsCol();
    const cleanMediaType = params.mediaType === 'tv' ? 'tv' : 'movie';

    // 1. Check by TMDB ID if available
    if (params.tmdbId && typeof params.tmdbId === 'number') {
      const existing = await col.findOne({
        tmdbId: params.tmdbId,
        mediaType: cleanMediaType,
        status: { $ne: 'rejected' },
      });
      if (existing) {
        return {
          ...existing,
          id: existing._id?.toString(),
          _id: existing._id?.toString(),
        };
      }
    }

    // 2. Check by exact title match (case-insensitive)
    const cleanTitle = params.title.trim().toLowerCase();
    const existingByTitle = await col.findOne({
      mediaType: cleanMediaType,
      title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: { $ne: 'rejected' },
    });

    if (existingByTitle) {
      return {
        ...existingByTitle,
        id: existingByTitle._id?.toString(),
        _id: existingByTitle._id?.toString(),
      };
    }

    return null;
  });
}

/**
 * Creates a new media request in MongoDB.
 */
export async function createMediaRequest(params: {
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: 'owner' | 'admin' | 'member';
  mediaType: 'movie' | 'tv';
  tmdbId?: number | null;
  title: string;
  year?: string | number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres?: string[];
  season?: string;
  message?: string;
}): Promise<MongoMediaRequest> {
  ensureRequestIndexesBackground();

  // Check for duplicate first
  const duplicate = await findDuplicateRequest({
    tmdbId: params.tmdbId,
    title: params.title,
    mediaType: params.mediaType,
  });

  if (duplicate) {
    const error: any = new Error(
      `"${params.title}" sudah pernah direquest sebelumnya! Silakan berikan Vote pada permintaan yang sudah ada agar lebih cepat diproses.`
    );
    error.isDuplicate = true;
    error.existingRequest = duplicate;
    throw error;
  }

  const now = Date.now();
  const newRequest: MongoMediaRequest = {
    userId: params.userId,
    authorName: params.authorName,
    authorAvatar: params.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(params.authorName)}`,
    authorRole: params.authorRole || 'member',
    mediaType: params.mediaType === 'tv' ? 'tv' : 'movie',
    tmdbId: params.tmdbId || null,
    title: params.title.trim(),
    year: params.year || null,
    posterUrl: params.posterUrl || null,
    backdropUrl: params.backdropUrl || null,
    genres: Array.isArray(params.genres) ? params.genres : [],
    season: params.season || undefined,
    message: params.message ? params.message.trim() : undefined,
    votes: 1,
    votedBy: [params.userId],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  return withMongoRetry(async () => {
    const col = await getRequestsCol();
    const result = await col.insertOne(newRequest as any);
    memoryCache.invalidate('requests_feed_');
    return {
      ...newRequest,
      _id: result.insertedId.toString(),
      id: result.insertedId.toString(),
      hasVoted: true,
    };
  });
}

/**
 * Retrieves media requests with sorting ('latest' or 'popular'), search filtering, and pagination.
 */
export async function getMediaRequests(options: {
  tab?: 'latest' | 'popular';
  q?: string;
  page?: number;
  limit?: number;
  currentUserId?: string;
}): Promise<{ requests: MongoMediaRequest[]; total: number; page: number; totalPages: number }> {
  ensureRequestIndexesBackground();

  const { tab = 'latest', q = '', page = 1, limit = 24, currentUserId } = options;
  const skip = (page - 1) * limit;

  // Use memory cache for search-less feed requests
  const isCacheable = !q || !q.trim();
  const cacheKey = `requests_feed_${tab}_${page}_${limit}`;

  const fetchRawFeed = async () => {
    return withMongoRetry(async () => {
      const col = await getRequestsCol();
      const filter: any = {};

      if (q && q.trim()) {
        const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { title: { $regex: escaped, $options: 'i' } },
          { authorName: { $regex: escaped, $options: 'i' } },
          { message: { $regex: escaped, $options: 'i' } },
          { genres: { $in: [new RegExp(escaped, 'i')] } },
        ];
      }

      let sort: any = { createdAt: -1 };
      if (tab === 'popular') {
        sort = { votes: -1, createdAt: -1 };
      }

      const [rawRequests, total] = await Promise.all([
        col.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
        col.countDocuments(filter),
      ]);

      return { rawRequests, total };
    });
  };

  const { rawRequests, total } = isCacheable
    ? await memoryCache.getOrFetch(cacheKey, fetchRawFeed, 15_000, 5_000)
    : await fetchRawFeed();

  const requests = (rawRequests || []).map((doc: any) => {
    const id = doc._id?.toString() || '';
    const votedBy = Array.isArray(doc.votedBy) ? doc.votedBy : [];
    const hasVoted = Boolean(currentUserId && votedBy.includes(currentUserId));

    return {
      ...doc,
      _id: id,
      id,
      votedBy,
      hasVoted,
      votes: typeof doc.votes === 'number' ? doc.votes : votedBy.length,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    requests,
    total,
    page,
    totalPages,
  };
}

/**
 * Toggles a user's vote on a media request.
 */
export async function voteMediaRequest(
  requestId: string,
  userId: string
): Promise<{ success: boolean; votes: number; hasVoted: boolean }> {
  if (!ObjectId.isValid(requestId)) {
    throw new Error('ID Request tidak valid');
  }

  return withMongoRetry(async () => {
    const col = await getRequestsCol();
    const objId = new ObjectId(requestId);
    const existing = await col.findOne({ _id: objId });

    if (!existing) {
      throw new Error('Request tidak ditemukan');
    }

    const votedBy = Array.isArray(existing.votedBy) ? existing.votedBy : [];
    const alreadyVoted = votedBy.includes(userId);

    let newVotedBy: string[];
    let newVotes: number;
    let hasVoted: boolean;

    if (alreadyVoted) {
      // Remove vote
      newVotedBy = votedBy.filter((id) => id !== userId);
      newVotes = Math.max(0, (existing.votes || 1) - 1);
      hasVoted = false;
    } else {
      // Add vote
      newVotedBy = [...votedBy, userId];
      newVotes = (existing.votes || 0) + 1;
      hasVoted = true;
    }

    await col.updateOne(
      { _id: objId },
      {
        $set: {
          votes: newVotes,
          votedBy: newVotedBy,
          updatedAt: Date.now(),
        },
      }
    );

    memoryCache.invalidate('requests_feed_');

    return {
      success: true,
      votes: newVotes,
      hasVoted,
    };
  });
}

/**
 * Deletes a media request (Owner, Admin, or Author).
 */
export async function deleteMediaRequest(
  requestId: string,
  operatorUserId: string,
  operatorRole?: string
): Promise<{ success: boolean }> {
  if (!ObjectId.isValid(requestId)) {
    throw new Error('ID Request tidak valid');
  }

  return withMongoRetry(async () => {
    const col = await getRequestsCol();
    const objId = new ObjectId(requestId);
    const existing = await col.findOne({ _id: objId });

    if (!existing) {
      throw new Error('Request tidak ditemukan');
    }

    const isAuthor = existing.userId === operatorUserId;
    const isPrivileged = operatorRole === 'owner' || operatorRole === 'admin';

    if (!isAuthor && !isPrivileged) {
      throw new Error('Akses ditolak: Anda tidak memiliki izin untuk menghapus request ini');
    }

    await col.deleteOne({ _id: objId });
    memoryCache.invalidate('requests_feed_');
    return { success: true };
  });
}

/**
 * Automatically deletes requests matching the provided TMDB ID or title when content is created/filled in CMS.
 */
export async function deleteRequestsByContent(params: {
  tmdbId?: number | null;
  title?: string | null;
  mediaType?: 'movie' | 'tv';
}): Promise<number> {
  ensureRequestIndexesBackground();
  return withMongoRetry(async () => {
    const col = await getRequestsCol();
    const targetId = params.tmdbId ? Number(params.tmdbId) : null;
    const cleanTitle = params.title?.trim().toLowerCase() || '';

    const conditions: any[] = [];
    if (targetId) {
      conditions.push({ tmdbId: targetId });
    }
    if (cleanTitle) {
      conditions.push({
        title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
    }

    if (conditions.length === 0) return 0;

    const filter: any = conditions.length === 1 ? conditions[0] : { $or: conditions };
    if (params.mediaType) {
      filter.mediaType = params.mediaType;
    }

    const result = await col.deleteMany(filter);
    if (result.deletedCount && result.deletedCount > 0) {
      memoryCache.invalidate('requests_feed_');
    }
    console.log(`[MongoDB Requests] Deleted ${result.deletedCount} request(s) matching content:`, params);
    return result.deletedCount;
  });
}

export interface CatalogMatch {
  exists: boolean;
  mediaType: 'movie' | 'tv';
  slug: string;
  title: string;
  url: string;
}

/**
 * Checks if the content (Movie / TV Show) already exists in Filmesia catalog (MongoDB or Static Registry).
 */
export async function findCatalogContent(params: {
  tmdbId?: number | null;
  title?: string | null;
  mediaType?: 'movie' | 'tv';
}): Promise<CatalogMatch | null> {
  const targetId = params.tmdbId ? Number(params.tmdbId) : null;
  const cleanTitle = params.title?.trim().toLowerCase() || '';

  if (!targetId && !cleanTitle) return null;

  // 1. Check MongoDB if configured
  if (isMongoConfigured()) {
    try {
      const db = await getDatabase();
      const moviesCol = db.collection('movies');
      const tvCol = db.collection('tv_shows');

      if (!params.mediaType || params.mediaType === 'movie') {
        const movieConditions: any[] = [];
        if (targetId) movieConditions.push({ tmdb_id: targetId });
        if (cleanTitle) {
          movieConditions.push({
            title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          });
        }

        if (movieConditions.length > 0) {
          const movieMatch: any = await moviesCol.findOne({
            deleted: { $ne: true },
            ...(movieConditions.length === 1 ? movieConditions[0] : { $or: movieConditions }),
          });

          if (movieMatch) {
            const slug = movieMatch.slug || movieMatch.tmdb_id || targetId;
            return {
              exists: true,
              mediaType: 'movie',
              slug: String(slug),
              title: movieMatch.title || 'Movie',
              url: `/movie/${slug}`,
            };
          }
        }
      }

      if (!params.mediaType || params.mediaType === 'tv') {
        const tvConditions: any[] = [];
        if (targetId) tvConditions.push({ tmdb_id: targetId });
        if (cleanTitle) {
          tvConditions.push({
            title: { $regex: new RegExp(`^${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          });
        }

        if (tvConditions.length > 0) {
          const tvMatch: any = await tvCol.findOne({
            deleted: { $ne: true },
            ...(tvConditions.length === 1 ? tvConditions[0] : { $or: tvConditions }),
          });

          if (tvMatch) {
            const slug = tvMatch.showSlug || tvMatch.tmdb_id || targetId;
            return {
              exists: true,
              mediaType: 'tv',
              slug: String(slug),
              title: tvMatch.title || 'TV Series',
              url: `/tv/${slug}`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[findCatalogContent] MongoDB check error:', err);
    }
  }

  // 2. Check in-memory Static Content Registry
  try {
    const { STATIC_MOVIE_FILES, STATIC_TV_FILES } = await import('@/lib/staticContentRegistry');
    const matter = (await import('gray-matter')).default;

    if (typeof STATIC_MOVIE_FILES === 'object' && (!params.mediaType || params.mediaType === 'movie')) {
      for (const [key, content] of Object.entries(STATIC_MOVIE_FILES)) {
        if (!key.endsWith('.md')) continue;
        try {
          const parsed = matter(content);
          const fileTmdbId = parsed.data.tmdb_id ? Number(parsed.data.tmdb_id) : null;
          const fileTitle = (parsed.data.title || '').trim().toLowerCase();
          const fileSlug = key.replace(/^video[\\\/]/, '').replace(/\.md$/, '');

          if ((targetId && fileTmdbId === targetId) || (cleanTitle && fileTitle === cleanTitle)) {
            return {
              exists: true,
              mediaType: 'movie',
              slug: fileSlug,
              title: parsed.data.title || fileSlug,
              url: `/movie/${fileSlug}`,
            };
          }
        } catch {}
      }
    }

    if (typeof STATIC_TV_FILES === 'object' && (!params.mediaType || params.mediaType === 'tv')) {
      for (const [key, content] of Object.entries(STATIC_TV_FILES)) {
        if (!key.endsWith('_index.md')) continue;
        try {
          const parsed = matter(content);
          const fileTmdbId = parsed.data.tmdb_id ? Number(parsed.data.tmdb_id) : null;
          const fileTitle = (parsed.data.title || '').trim().toLowerCase();
          const showSlug = key.replace(/^tv[\\\/]/, '').replace(/[\\\/]_index\.md$/, '');

          if ((targetId && fileTmdbId === targetId) || (cleanTitle && fileTitle === cleanTitle)) {
            return {
              exists: true,
              mediaType: 'tv',
              slug: showSlug,
              title: parsed.data.title || showSlug,
              url: `/tv/${showSlug}`,
            };
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[findCatalogContent] Static registry check notice:', err);
  }

  return null;
}

