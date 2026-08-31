import { ObjectId } from 'mongodb';
import { getDatabase } from './client';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { memoryCache } from '@/lib/cache';
import siteConfig from '@/config';

export type UserRole = 'owner' | 'admin' | 'member';

export interface MongoWatchlistItem {
  contentId: string | number;
  type: 'movie' | 'tv';
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  rating?: number;
  releaseDate?: string;
  urlPath: string;
  addedAt: number;
}

export interface MongoHistoryItem {
  contentId: string | number;
  type: 'movie' | 'tv';
  title: string;
  episodeTitle?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  rating?: number;
  urlPath: string;
  viewedAt: number;
}

export interface MongoUser {
  _id?: ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role?: UserRole;
  avatar?: string;
  watchlist: MongoWatchlistItem[];
  history: MongoHistoryItem[];
  createdAt: number;
  updatedAt: number;
}

const USERS_COLLECTION = 'users';

async function getUsersCollection() {
  const db = await getDatabase();
  return db.collection<MongoUser>(USERS_COLLECTION);
}

function ensureUserIndexesBackground() {
  const globalScope = globalThis as any;
  if (globalScope._userIndexesInitialized) return;
  globalScope._userIndexesInitialized = true;
  (async () => {
    try {
      const col = await getUsersCollection();
      await Promise.allSettled([
        col.createIndex({ username: 1 }, { unique: true }),
        col.createIndex({ email: 1 }, { unique: true }),
      ]);
    } catch (err) {
      console.warn('[MongoDB] ensureUserIndexesBackground notice:', err);
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
      console.warn('[MongoDB] Transient connection notice, retrying operation once:', msg);
      return await operation();
    }
    throw err;
  }
}

/**
 * Normalizes username (lowercase, trimmed).
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Normalizes email (lowercase, trimmed).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolves the effective role of a user.
 * If user email or username matches siteConfig.owner, role is always 'owner'.
 */
export function resolveUserRole(user?: { email?: string; username?: string; role?: UserRole } | null): UserRole {
  if (!user) return 'member';
  const cleanEmail = user.email ? normalizeEmail(user.email) : '';
  const cleanUsername = user.username ? normalizeUsername(user.username) : '';
  const ownerEmail = normalizeEmail(siteConfig.owner?.email || 'kazumiteku6@gmail.com');
  const ownerUsername = normalizeUsername(siteConfig.owner?.username || 'Levi');

  if (cleanEmail === ownerEmail || cleanUsername === ownerUsername || user.role === 'owner') {
    return 'owner';
  }
  if (user.role === 'admin') {
    return 'admin';
  }
  return 'member';
}

/**
 * Finds user by ObjectId string with short-lived RAM caching (reduces repeated DB roundtrips).
 */
export async function getUserById(userId: string): Promise<MongoUser | null> {
  if (!ObjectId.isValid(userId)) return null;

  return memoryCache.getOrFetch<MongoUser | null>(
    `user_id_${userId}`,
    async () => {
      return withMongoRetry(async () => {
        const col = await getUsersCollection();
        const user = await col.findOne({ _id: new ObjectId(userId) });
        if (user) {
          user.role = resolveUserRole(user);
          const ownerEmail = normalizeEmail(siteConfig.owner?.email || 'kazumiteku6@gmail.com');
          const ownerUsername = normalizeUsername(siteConfig.owner?.username || 'Levi');
          if (normalizeEmail(user.email) === ownerEmail && user.username !== ownerUsername) {
            user.username = ownerUsername;
            user.role = 'owner';
            col.updateOne(
              { _id: user._id },
              {
                $set: {
                  username: ownerUsername,
                  role: 'owner',
                  avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(ownerUsername)}`,
                  updatedAt: Date.now(),
                },
              }
            ).catch(() => {});
          }
        }
        return user;
      });
    },
    20_000, // 20s TTL
    10_000  // 10s SWR
  );
}

/**
 * Finds user by username or email.
 */
export async function getUserByUsernameOrEmail(identifier: string): Promise<MongoUser | null> {
  ensureUserIndexesBackground();
  const clean = identifier.trim().toLowerCase();

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await col.findOne({
      $or: [{ username: clean }, { email: clean }],
    });
    if (user) {
      user.role = resolveUserRole(user);
      const ownerEmail = normalizeEmail(siteConfig.owner?.email || 'kazumiteku6@gmail.com');
      const ownerUsername = normalizeUsername(siteConfig.owner?.username || 'Levi');
      if (normalizeEmail(user.email) === ownerEmail && user.username !== ownerUsername) {
        user.username = ownerUsername;
        user.role = 'owner';
        col.updateOne(
          { _id: user._id },
          {
            $set: {
              username: ownerUsername,
              role: 'owner',
              avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(ownerUsername)}`,
              updatedAt: Date.now(),
            },
          }
        ).catch(() => {});
      }
    }
    return user;
  });
}

/**
 * Creates a new user in MongoDB.
 */
export async function createUser(data: {
  username: string;
  email: string;
  password: string;
}): Promise<MongoUser> {
  ensureUserIndexesBackground();
  const cleanUsername = normalizeUsername(data.username);
  const cleanEmail = normalizeEmail(data.email);

  return withMongoRetry(async () => {
    const col = await getUsersCollection();

    // Check uniqueness
    const existing = await col.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existing) {
      if (existing.username === cleanUsername) {
        throw new Error('Username sudah digunakan oleh akun lain');
      }
      if (existing.email === cleanEmail) {
        throw new Error('Email sudah terdaftar. Silakan login atau gunakan email lain');
      }
    }

    const { salt, hash } = hashPassword(data.password);
    const now = Date.now();
    const role = resolveUserRole({ email: cleanEmail, username: cleanUsername });

    const newUser: MongoUser = {
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanUsername)}`,
      watchlist: [],
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(newUser);
    newUser._id = result.insertedId;
    return newUser;
  });
}

/**
 * Authenticates user credentials with support for Owner credentials.
 */
export async function authenticateUser(
  identifier: string,
  password: string
): Promise<MongoUser | null> {
  const cleanIdentifier = identifier.trim().toLowerCase();
  const ownerEmail = normalizeEmail(siteConfig.owner?.email || 'kazumiteku6@gmail.com');
  const ownerUsername = normalizeUsername(siteConfig.owner?.username || 'Levi');
  const ownerPassword = siteConfig.owner?.password || 'admin';

  const isOwnerIdentifier =
    cleanIdentifier === ownerEmail ||
    cleanIdentifier === ownerUsername.toLowerCase() ||
    cleanIdentifier === 'owner';

  // 1. Check direct owner credentials
  if (isOwnerIdentifier && password === ownerPassword) {
    let ownerUser = await getUserByUsernameOrEmail(ownerEmail);
    if (!ownerUser) {
      ownerUser = await getUserByUsernameOrEmail(ownerUsername);
    }
    if (!ownerUser) {
      // Auto-provision owner user in MongoDB with username 'Levi'
      try {
        ownerUser = await createUser({
          username: ownerUsername,
          email: ownerEmail,
          password: ownerPassword,
        });
      } catch {
        ownerUser = await getUserByUsernameOrEmail(ownerEmail);
      }
    }

    if (ownerUser) {
      if (ownerUser.username !== ownerUsername || ownerUser.role !== 'owner') {
        ownerUser.username = ownerUsername;
        ownerUser.role = 'owner';
        const col = await getUsersCollection();
        await col.updateOne(
          { _id: ownerUser._id },
          {
            $set: {
              username: ownerUsername,
              role: 'owner',
              avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(ownerUsername)}`,
              updatedAt: Date.now(),
            },
          }
        );
      }
      ownerUser.role = 'owner';
      return ownerUser;
    }
  }

  // 2. Standard user lookup & password verification
  let user = await getUserByUsernameOrEmail(cleanIdentifier);
  if (!user && isOwnerIdentifier) {
    user = await getUserByUsernameOrEmail(ownerEmail);
  }
  if (!user || !user.passwordHash || !user.salt) return null;

  const isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid) {
    // If user is owner email and matched config owner password
    if ((normalizeEmail(user.email) === ownerEmail || normalizeUsername(user.username) === ownerUsername) && password === ownerPassword) {
      user.role = 'owner';
      user.username = ownerUsername;
      return user;
    }
    return null;
  }

  user.role = resolveUserRole(user);
  if (normalizeEmail(user.email) === ownerEmail && user.username !== ownerUsername) {
    user.username = ownerUsername;
    user.role = 'owner';
    const col = await getUsersCollection();
    await col.updateOne(
      { _id: user._id },
      {
        $set: {
          username: ownerUsername,
          role: 'owner',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(ownerUsername)}`,
          updatedAt: Date.now(),
        },
      }
    );
  }
  return user;
}

/**
 * Fetches all registered users for Admin/Owner management.
 */
export async function getAllUsers(operatorUserId: string): Promise<
  Array<{
    id: string;
    username: string;
    email: string;
    role: UserRole;
    avatar?: string;
    createdAt: number;
  }>
> {
  const operator = await getUserById(operatorUserId);
  if (!operator) {
    throw new Error('Akses ditolak');
  }

  const operatorRole = resolveUserRole(operator);
  if (operatorRole !== 'owner' && operatorRole !== 'admin') {
    throw new Error('Hanya Administrator atau Owner yang dapat melihat daftar pengguna');
  }

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const rawUsers = await col
      .find({})
      .sort({ createdAt: -1 })
      .project({ passwordHash: 0, salt: 0, watchlist: 0, history: 0 })
      .toArray();

    const mapped = rawUsers.map((u) => {
      const role = resolveUserRole({ email: u.email, role: u.role, username: u.username });
      return {
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        role,
        avatar: u.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.username)}`,
        createdAt: u.createdAt,
      };
    });

    const rolePriority: Record<UserRole, number> = {
      owner: 0,
      admin: 1,
      member: 2,
    };

    return mapped.sort((a, b) => {
      const diff = (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
      if (diff !== 0) return diff;
      return b.createdAt - a.createdAt;
    });
  });
}

/**
 * Updates a user's role (Owner only).
 */
export async function updateUserRole(
  operatorUserId: string,
  targetUserId: string,
  newRole: 'admin' | 'member'
): Promise<{ success: boolean; user: { id: string; username: string; role: UserRole } }> {
  const operator = await getUserById(operatorUserId);
  if (!operator) {
    throw new Error('Akses ditolak');
  }

  const operatorRole = resolveUserRole(operator);
  if (operatorRole !== 'owner') {
    throw new Error('Hanya Owner yang memiliki izin untuk mengubah Role pengguna');
  }

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const currentRole = resolveUserRole(target);
  if (currentRole === 'owner') {
    throw new Error('Role Owner tidak dapat diubah');
  }

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    await col.updateOne(
      { _id: new ObjectId(targetUserId) },
      { $set: { role: newRole, updatedAt: Date.now() } }
    );

    memoryCache.invalidate(`user_id_${targetUserId}`);

    return {
      success: true,
      user: {
        id: targetUserId,
        username: target.username,
        role: newRole,
      },
    };
  });
}

/**
 * Permanently deletes a user and all their associated data (watchlist, history, created collections) (Owner only).
 */
export async function deleteUserAccount(
  operatorUserId: string,
  targetUserId: string
): Promise<{ success: boolean; deletedUsername: string }> {
  const operator = await getUserById(operatorUserId);
  if (!operator) {
    throw new Error('Akses ditolak');
  }

  const operatorRole = resolveUserRole(operator);
  if (operatorRole !== 'owner') {
    throw new Error('Hanya Owner yang memiliki izin untuk menghapus akun pengguna');
  }

  if (operatorUserId === targetUserId) {
    throw new Error('Tidak dapat menghapus akun Owner yang sedang aktif');
  }

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error('Pengguna tidak ditemukan');
  }

  const targetRole = resolveUserRole(target);
  if (targetRole === 'owner') {
    throw new Error('Akun dengan role Owner tidak dapat dihapus');
  }

  return withMongoRetry(async () => {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Koneksi database tidak tersedia');
    }

    // 1. Delete all collections created by this user
    try {
      await db.collection('collections').deleteMany({ userId: targetUserId });
    } catch (e) {
      console.warn('[deleteUserAccount] Error deleting user collections:', e);
    }

    // 2. Delete the user document completely (clearing watchlist, history, credentials)
    const usersCol = await getUsersCollection();
    await usersCol.deleteOne({ _id: new ObjectId(targetUserId) });

    memoryCache.invalidate(`user_id_${targetUserId}`);

    return {
      success: true,
      deletedUsername: target.username,
    };
  });
}

/**
 * Permanently deletes multiple users and all their associated data in batch (Owner only).
 */
export async function batchDeleteUserAccounts(
  operatorUserId: string,
  targetUserIds: string[]
): Promise<{ success: boolean; deletedCount: number }> {
  const operator = await getUserById(operatorUserId);
  if (!operator) {
    throw new Error('Akses ditolak');
  }

  const operatorRole = resolveUserRole(operator);
  if (operatorRole !== 'owner') {
    throw new Error('Hanya Owner yang memiliki izin untuk menghapus akun pengguna');
  }

  const cleanTargetIds = targetUserIds.filter(
    (id) => ObjectId.isValid(id) && id !== operatorUserId
  );

  if (cleanTargetIds.length === 0) {
    throw new Error('Tidak ada akun valid yang dapat dihapus');
  }

  return withMongoRetry(async () => {
    const db = await getDatabase();
    if (!db) {
      throw new Error('Koneksi database tidak tersedia');
    }

    const usersCol = await getUsersCollection();

    // Filter out owner users
    const validUsers = await usersCol
      .find({ _id: { $in: cleanTargetIds.map((id) => new ObjectId(id)) } })
      .toArray();

    const nonOwnerUserIds = validUsers
      .filter((u) => resolveUserRole(u) !== 'owner')
      .map((u) => u._id.toString());

    if (nonOwnerUserIds.length === 0) {
      throw new Error('Tidak ada pengguna non-Owner yang dapat dihapus');
    }

    const objectIds = nonOwnerUserIds.map((id) => new ObjectId(id));

    // 1. Delete all collections created by these users
    try {
      await db.collection('collections').deleteMany({ userId: { $in: nonOwnerUserIds } });
    } catch (e) {
      console.warn('[batchDeleteUserAccounts] Error deleting collections:', e);
    }

    // 2. Delete user documents
    const deleteResult = await usersCol.deleteMany({ _id: { $in: objectIds } });

    cleanTargetIds.forEach((id) => memoryCache.invalidate(`user_id_${id}`));

    return {
      success: true,
      deletedCount: deleteResult.deletedCount || 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the user's watchlist.
 */
export async function getUserWatchlist(userId: string): Promise<MongoWatchlistItem[]> {
  const user = await getUserById(userId);
  return user?.watchlist || [];
}

/**
 * Toggles an item in the user's watchlist.
 * Returns { added, watchlist }.
 */
export async function toggleUserWatchlist(
  userId: string,
  item: {
    contentId: string | number;
    type: 'movie' | 'tv';
    title: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    rating?: number;
    releaseDate?: string;
    urlPath: string;
  }
): Promise<{ added: boolean; watchlist: MongoWatchlistItem[] }> {
  ensureUserIndexesBackground();
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID');

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error('User not found');

    const watchlist = user.watchlist || [];
    const exists = watchlist.some((w) => String(w.contentId) === String(item.contentId));

    if (exists) {
      const updated = watchlist.filter((w) => String(w.contentId) !== String(item.contentId));
      await col.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: { watchlist: updated, updatedAt: Date.now() },
        }
      );
      memoryCache.invalidate(`user_id_${userId}`);
      return { added: false, watchlist: updated };
    } else {
      const newItem: MongoWatchlistItem = {
        contentId: item.contentId,
        type: item.type,
        title: item.title,
        posterPath: item.posterPath ?? null,
        backdropPath: item.backdropPath ?? null,
        rating: item.rating,
        releaseDate: item.releaseDate,
        urlPath: item.urlPath,
        addedAt: Date.now(),
      };
      const updated = [newItem, ...watchlist];
      await col.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: { watchlist: updated, updatedAt: Date.now() },
        }
      );
      memoryCache.invalidate(`user_id_${userId}`);
      return { added: true, watchlist: updated };
    }
  });
}

/**
 * Removes an item from the user's watchlist.
 */
export async function removeUserWatchlist(
  userId: string,
  contentId: string | number
): Promise<MongoWatchlistItem[]> {
  ensureUserIndexesBackground();
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID');

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) return [];

    const updated = (user.watchlist || []).filter(
      (w) => String(w.contentId) !== String(contentId)
    );

    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { watchlist: updated, updatedAt: Date.now() },
      }
    );

    memoryCache.invalidate(`user_id_${userId}`);
    return updated;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the user's viewing history.
 */
export async function getUserHistory(userId: string): Promise<MongoHistoryItem[]> {
  const user = await getUserById(userId);
  return user?.history || [];
}

/**
 * Adds an item to the user's history and returns the updated list.
 */
export async function addUserHistory(
  userId: string,
  item: {
    contentId: string | number;
    type: 'movie' | 'tv';
    title: string;
    episodeTitle?: string;
    posterPath?: string | null;
    backdropPath?: string | null;
    rating?: number;
    urlPath: string;
  }
): Promise<MongoHistoryItem[]> {
  ensureUserIndexesBackground();
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID');

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) return [];

    const history = user.history || [];
    const filtered = history.filter((h) => {
      if (item.type === 'tv' && item.episodeTitle) {
        return !(String(h.contentId) === String(item.contentId) && h.episodeTitle === item.episodeTitle);
      }
      return String(h.contentId) !== String(item.contentId);
    });

    const newHistoryItem: MongoHistoryItem = {
      contentId: item.contentId,
      type: item.type,
      title: item.title,
      episodeTitle: item.episodeTitle,
      posterPath: item.posterPath ?? null,
      backdropPath: item.backdropPath ?? null,
      rating: item.rating,
      urlPath: item.urlPath,
      viewedAt: Date.now(),
    };

    const updated = [newHistoryItem, ...filtered].slice(0, 100);

    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          history: updated,
          updatedAt: Date.now(),
        },
      }
    );

    memoryCache.invalidate(`user_id_${userId}`);
    return updated;
  });
}

/**
 * Removes one item or clears all items from the user's viewing history.
 */
export async function removeUserHistory(
  userId: string,
  contentId?: string | number
): Promise<MongoHistoryItem[]> {
  ensureUserIndexesBackground();
  if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID');

  return withMongoRetry(async () => {
    const col = await getUsersCollection();
    if (!contentId) {
      await col.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: { history: [], updatedAt: Date.now() },
        }
      );
      memoryCache.invalidate(`user_id_${userId}`);
      return [];
    }

    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) return [];

    const updated = (user.history || []).filter(
      (h) => String(h.contentId) !== String(contentId)
    );

    await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: { history: updated, updatedAt: Date.now() },
      }
    );

    memoryCache.invalidate(`user_id_${userId}`);
    return updated;
  });
}

/**
 * Clears the user's viewing history.
 */
export async function clearUserHistory(userId: string): Promise<void> {
  await removeUserHistory(userId);
}
