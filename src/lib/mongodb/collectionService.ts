import { ObjectId } from 'mongodb';
import { getDatabase } from './client';
import { memoryCache } from '@/lib/cache';

export interface CollectionItem {
  id: number | string;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  rating?: number;
  overview?: string;
  urlPath?: string;
}

export interface MongoCollection {
  _id?: ObjectId | string;
  slug: string;
  title: string;
  description?: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: 'owner' | 'admin' | 'member';
  items: CollectionItem[];
  itemCount: number;
  yearStart?: number | null;
  yearEnd?: number | null;
  featuredPoster?: string | null;
  featuredBackdrop?: string | null;
  isPublic: boolean;
  views: number;
  likes: number;
  dislikes: number;
  likedBy?: string[];
  dislikedBy?: string[];
  userVote?: 'like' | 'dislike' | null;
  createdAt: number;
  updatedAt: number;
}

const COLLECTIONS_COLLECTION = 'collections';

async function getCollectionsCol() {
  const db = await getDatabase();
  return db.collection<MongoCollection>(COLLECTIONS_COLLECTION);
}

function ensureCollectionIndexesBackground() {
  const globalScope = globalThis as any;
  if (globalScope._collectionIndexesInitialized) return;
  globalScope._collectionIndexesInitialized = true;
  (async () => {
    try {
      const col = await getCollectionsCol();
      await Promise.allSettled([
        col.createIndex({ slug: 1 }, { unique: true }),
        col.createIndex({ userId: 1 }),
        col.createIndex({ title: 'text', description: 'text', authorName: 'text' }),
        col.createIndex({ likes: -1, createdAt: -1 }),
        col.createIndex({ createdAt: -1 }),
      ]);
    } catch (err) {
      console.warn('[MongoDB] ensureCollectionIndexesBackground notice:', err);
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
      console.warn('[MongoDB] Transient connection notice in collections, retrying once:', msg);
      return await operation();
    }
    throw err;
  }
}

/**
 * Sanitize and compact collection items to minimize MongoDB storage on Free Tier
 * Strips huge overview descriptions and redundant URL schemas to keep each item ~100 bytes.
 */
export function sanitizeCollectionItems(rawItems: any[]): CollectionItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item) => {
    const isTV = item.mediaType === 'tv';
    return {
      id: typeof item.id === 'string' ? (parseInt(item.id, 10) || item.id) : item.id,
      mediaType: isTV ? 'tv' : 'movie',
      title: String(item.title || item.name || '').trim().slice(0, 120),
      posterPath: item.posterPath ? String(item.posterPath).trim().slice(0, 80) : null,
      backdropPath: item.backdropPath ? String(item.backdropPath).trim().slice(0, 80) : null,
      releaseDate: item.releaseDate ? String(item.releaseDate).slice(0, 10) : '',
      rating: typeof item.rating === 'number' ? Math.round(item.rating * 10) / 10 : undefined,
    };
  });
}

/**
 * Generate unique slug from title
 */
export function generateCollectionSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${base || 'koleksi'}-${randomSuffix}`;
}

/**
 * Calculate year range and featured media from items
 */
export function calculateCollectionMeta(items: CollectionItem[]) {
  const years: number[] = [];
  let featuredPoster: string | null = null;
  let featuredBackdrop: string | null = null;

  for (const item of items) {
    if (item.releaseDate) {
      const y = parseInt(item.releaseDate.substring(0, 4), 10);
      if (!isNaN(y) && y > 1800 && y < 2100) {
        years.push(y);
      }
    }
    if (!featuredPoster && item.posterPath) {
      featuredPoster = item.posterPath;
    }
    if (!featuredBackdrop && item.backdropPath) {
      featuredBackdrop = item.backdropPath;
    }
  }

  years.sort((a, b) => a - b);
  const yearStart = years.length > 0 ? years[0] : null;
  const yearEnd = years.length > 0 ? years[years.length - 1] : null;

  return {
    itemCount: items.length,
    yearStart,
    yearEnd,
    featuredPoster: featuredPoster || (items[0]?.posterPath ?? null),
    featuredBackdrop: featuredBackdrop || (items[0]?.backdropPath ?? null),
  };
}

/**
 * Fetch public collections with search, filter, and pagination
 */
export async function getPublicCollections(params: {
  search?: string;
  filter?: 'all' | 'popular' | 'latest' | 'my';
  userId?: string;
  page?: number;
  limit?: number;
}): Promise<{ collections: MongoCollection[]; total: number }> {
  const { search = '', filter = 'latest', userId, page = 1, limit = 24 } = params;

  // Use memory cache for search-less and public filter requests
  const isCacheable = (!search || !search.trim()) && filter !== 'my';
  const cacheKey = `collections_feed_${filter}_${page}_${limit}`;

  const fetchRawCollections = async () => {
    return withMongoRetry(async () => {
      const col = await getCollectionsCol();
      const query: any = { isPublic: true };

      if (filter === 'my' && userId) {
        delete query.isPublic; // User can see all their own collections
        query.userId = userId;
      }

      if (search.trim()) {
        const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { authorName: { $regex: regex } },
        ];
      }

      let sortOption: any = { createdAt: -1 };
      if (filter === 'popular') {
        // Populer now sorts by most likes!
        sortOption = { likes: -1, createdAt: -1 };
      } else if (filter === 'latest') {
        sortOption = { createdAt: -1 };
      }

      const skip = Math.max(0, (page - 1) * limit);

      const [rawCollections, total] = await Promise.all([
        col.find(query).sort(sortOption).skip(skip).limit(limit).toArray(),
        col.countDocuments(query),
      ]);

      return { rawCollections, total };
    });
  };

  const { rawCollections, total } = isCacheable
    ? await memoryCache.getOrFetch(cacheKey, fetchRawCollections, 15_000, 5_000)
    : await fetchRawCollections();

  const collections = (rawCollections || []).map((c: any) => {
    let userVote: 'like' | 'dislike' | null = null;
    if (userId) {
      if (Array.isArray(c.likedBy) && c.likedBy.includes(userId)) {
        userVote = 'like';
      } else if (Array.isArray(c.dislikedBy) && c.dislikedBy.includes(userId)) {
        userVote = 'dislike';
      }
    }

    return {
      ...c,
      _id: c._id ? c._id.toString() : undefined,
      likes: typeof c.likes === 'number' ? c.likes : (c.likedBy?.length || 0),
      dislikes: typeof c.dislikes === 'number' ? c.dislikes : (c.dislikedBy?.length || 0),
      userVote,
      // Do not expose full likedBy/dislikedBy arrays to public listing to save payload
      likedBy: undefined,
      dislikedBy: undefined,
    };
  }) as any[];

  return { collections, total };
}

/**
 * Fetch single collection by ID or slug
 */
export async function getCollectionByIdOrSlug(
  idOrSlug: string,
  currentUserId?: string
): Promise<MongoCollection | null> {
  const cacheKey = `collection_detail_${idOrSlug}`;

  const fetchRawCollection = async () => {
    return withMongoRetry(async () => {
      const col = await getCollectionsCol();
      let query: any = { slug: idOrSlug };

      if (ObjectId.isValid(idOrSlug)) {
        query = {
          $or: [{ _id: new ObjectId(idOrSlug) }, { slug: idOrSlug }],
        };
      }

      const collection = await col.findOne(query);
      if (!collection) return null;

      return {
        ...collection,
        _id: collection._id ? collection._id.toString() : undefined,
      };
    });
  };

  const raw = await memoryCache.getOrFetch(cacheKey, fetchRawCollection, 30_000, 10_000);
  if (!raw) return null;

  let userVote: 'like' | 'dislike' | null = null;
  if (currentUserId) {
    if (Array.isArray(raw.likedBy) && raw.likedBy.includes(currentUserId)) {
      userVote = 'like';
    } else if (Array.isArray(raw.dislikedBy) && raw.dislikedBy.includes(currentUserId)) {
      userVote = 'dislike';
    }
  }

  return {
    ...raw,
    likes: typeof raw.likes === 'number' ? raw.likes : (raw.likedBy?.length || 0),
    dislikes: typeof raw.dislikes === 'number' ? raw.dislikes : (raw.dislikedBy?.length || 0),
    userVote,
    likedBy: undefined,
    dislikedBy: undefined,
  };
}

/**
 * Create a new collection
 */
export async function createCollection(params: {
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: 'owner' | 'admin' | 'member';
  title: string;
  description?: string;
  items: CollectionItem[];
  isPublic?: boolean;
}): Promise<MongoCollection> {
  ensureCollectionIndexesBackground();

  return withMongoRetry(async () => {
    const col = await getCollectionsCol();
    const { userId, authorName, authorAvatar, authorRole = 'member', title, description, items, isPublic = true } = params;

    const trimmedTitle = title.trim().slice(0, 150);
    if (!trimmedTitle) {
      throw new Error('Judul koleksi wajib diisi');
    }

    const cleanItems = sanitizeCollectionItems(items);
    const meta = calculateCollectionMeta(cleanItems);
    const slug = generateCollectionSlug(trimmedTitle);
    const now = Date.now();

    const newDoc: MongoCollection = {
      slug,
      title: trimmedTitle,
      description: description?.trim().slice(0, 500) || '',
      userId,
      authorName,
      authorAvatar,
      authorRole,
      items: cleanItems,
      itemCount: meta.itemCount,
      yearStart: meta.yearStart,
      yearEnd: meta.yearEnd,
      featuredPoster: meta.featuredPoster,
      featuredBackdrop: meta.featuredBackdrop,
      isPublic,
      views: 0,
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    const res = await col.insertOne(newDoc as any);
    memoryCache.invalidate('collections_feed_');
    return { ...newDoc, _id: res.insertedId.toString() as any };
  });
}

/**
 * Update an existing collection (owner only)
 */
export async function updateCollection(
  idOrSlug: string,
  userId: string,
  updates: {
    title?: string;
    description?: string;
    items?: CollectionItem[];
    isPublic?: boolean;
  }
): Promise<MongoCollection | null> {
  return withMongoRetry(async () => {
    const col = await getCollectionsCol();
    let query: any = { slug: idOrSlug, userId };

    if (ObjectId.isValid(idOrSlug)) {
      query = {
        $and: [{ userId }, { $or: [{ _id: new ObjectId(idOrSlug) }, { slug: idOrSlug }] }],
      };
    }

    const existing = await col.findOne(query);
    if (!existing) {
      throw new Error('Koleksi tidak ditemukan atau Anda tidak memiliki izin untuk mengedit');
    }

    const updateFields: any = { updatedAt: Date.now() };

    if (typeof updates.title === 'string' && updates.title.trim()) {
      updateFields.title = updates.title.trim().slice(0, 150);
    }
    if (typeof updates.description === 'string') {
      updateFields.description = updates.description.trim().slice(0, 500);
    }
    if (typeof updates.isPublic === 'boolean') {
      updateFields.isPublic = updates.isPublic;
    }
    if (Array.isArray(updates.items)) {
      const cleanItems = sanitizeCollectionItems(updates.items);
      const meta = calculateCollectionMeta(cleanItems);
      updateFields.items = cleanItems;
      updateFields.itemCount = meta.itemCount;
      updateFields.yearStart = meta.yearStart;
      updateFields.yearEnd = meta.yearEnd;
      updateFields.featuredPoster = meta.featuredPoster;
      updateFields.featuredBackdrop = meta.featuredBackdrop;
    }

    await col.updateOne({ _id: existing._id }, { $set: updateFields });
    memoryCache.invalidate('collections_feed_');
    memoryCache.invalidate('collection_detail_');
    const updated = await col.findOne({ _id: existing._id });
    if (!updated) return null;
    return {
      ...updated,
      _id: updated._id ? (updated._id.toString() as any) : undefined,
    };
  });
}

/**
 * Toggle Like or Dislike for a collection by authenticated user
 */
export async function voteCollection(
  idOrSlug: string,
  userId: string,
  type: 'like' | 'dislike'
): Promise<{ likes: number; dislikes: number; userVote: 'like' | 'dislike' | null }> {
  return withMongoRetry(async () => {
    const col = await getCollectionsCol();
    let query: any = { slug: idOrSlug };

    if (ObjectId.isValid(idOrSlug)) {
      query = {
        $or: [{ _id: new ObjectId(idOrSlug) }, { slug: idOrSlug }],
      };
    }

    const collection = await col.findOne(query);
    if (!collection) {
      throw new Error('Koleksi tidak ditemukan');
    }

    let likedBy = Array.isArray(collection.likedBy) ? [...collection.likedBy] : [];
    let dislikedBy = Array.isArray(collection.dislikedBy) ? [...collection.dislikedBy] : [];

    const isLiked = likedBy.includes(userId);
    const isDisliked = dislikedBy.includes(userId);

    let finalUserVote: 'like' | 'dislike' | null = null;

    if (type === 'like') {
      if (isLiked) {
        // Toggle OFF like
        likedBy = likedBy.filter((id) => id !== userId);
        finalUserVote = null;
      } else {
        // Turn ON like, remove from dislike if exists
        likedBy.push(userId);
        dislikedBy = dislikedBy.filter((id) => id !== userId);
        finalUserVote = 'like';
      }
    } else if (type === 'dislike') {
      if (isDisliked) {
        // Toggle OFF dislike
        dislikedBy = dislikedBy.filter((id) => id !== userId);
        finalUserVote = null;
      } else {
        // Turn ON dislike, remove from like if exists
        dislikedBy.push(userId);
        likedBy = likedBy.filter((id) => id !== userId);
        finalUserVote = 'dislike';
      }
    }

    const likesCount = likedBy.length;
    const dislikesCount = dislikedBy.length;

    await col.updateOne(
      { _id: collection._id },
      {
        $set: {
          likedBy,
          dislikedBy,
          likes: likesCount,
          dislikes: dislikesCount,
        },
      }
    );

    memoryCache.invalidate('collections_feed_');
    memoryCache.invalidate('collection_detail_');

    return {
      likes: likesCount,
      dislikes: dislikesCount,
      userVote: finalUserVote,
    };
  });
}

/**
 * Delete a collection (owner of collection OR system owner/admin with force delete capability)
 */
export async function deleteCollection(
  idOrSlug: string,
  userId: string,
  userRole?: string
): Promise<boolean> {
  return withMongoRetry(async () => {
    const col = await getCollectionsCol();
    let query: any;

    const isPrivileged = userRole === 'owner' || userRole === 'admin';

    if (isPrivileged) {
      // Force delete capability for owner and admin
      if (ObjectId.isValid(idOrSlug)) {
        query = {
          $or: [{ _id: new ObjectId(idOrSlug) }, { slug: idOrSlug }],
        };
      } else {
        query = { slug: idOrSlug };
      }
    } else {
      // Standard user can only delete their own collection
      if (ObjectId.isValid(idOrSlug)) {
        query = {
          $and: [{ userId }, { $or: [{ _id: new ObjectId(idOrSlug) }, { slug: idOrSlug }] }],
        };
      } else {
        query = { slug: idOrSlug, userId };
      }
    }

    const res = await col.deleteOne(query);
    memoryCache.invalidate('collections_feed_');
    memoryCache.invalidate('collection_detail_');
    return (res.deletedCount || 0) > 0;
  });
}
