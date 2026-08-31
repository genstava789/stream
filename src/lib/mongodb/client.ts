import { MongoClient, MongoClientOptions } from 'mongodb';
import { MONGODB_CONFIG } from './config';

/**
 * Serverless & M0 Free-Tier Optimized Options
 * - maxPoolSize: 1 ensures each serverless lambda/process takes only 1 connection slot (staying well within the 500 limit on M0)
 * - minPoolSize: 0 ensures no unused idle sockets linger
 * - maxIdleTimeMS: 5000 closes idle sockets within 5s so Atlas can reclaim connection slots rapidly
 * - short timeouts prevent stalled requests from hoarding connections
 */
const options: MongoClientOptions = {
  maxPoolSize: 1,
  minPoolSize: 0,
  maxIdleTimeMS: 5000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  waitQueueTimeoutMS: 5000,
  retryReads: true,
  retryWrites: true,
  tls: true,
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientInstance: MongoClient | undefined;
}

function isEdgeOrWorker(): boolean {
  // Standard Node.js serverless platforms (Netlify, Vercel, AWS Lambda) fully support MongoDB TCP sockets
  if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return false;
  }
  // Cloudflare Workers (workerd engine) and Edge isolates do not support raw Node.js TCP sockets
  return (
    process.env.NEXT_RUNTIME === 'edge' ||
    typeof (process.versions as any)?.workerd !== 'undefined'
  );
}

export function isMongoConfigured(): boolean {
  if (isEdgeOrWorker()) {
    return false;
  }
  const currentUri = process.env.MONGODB_URI || MONGODB_CONFIG.uri;
  return Boolean(currentUri && currentUri.trim().startsWith('mongodb'));
}

/**
 * Returns the cached or newly created MongoClient singleton promise
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  if (!isMongoConfigured()) {
    return Promise.reject(new Error('MongoDB is not configured or running in unsupported edge environment'));
  }

  const globalScope = globalThis as any;
  if (!globalScope._mongoClientPromise) {
    const currentUri = process.env.MONGODB_URI || MONGODB_CONFIG.uri;
    const client = new MongoClient(currentUri, options);
    globalScope._mongoClientInstance = client;
    globalScope._mongoClientPromise = client.connect().catch((err) => {
      console.warn('[MongoDB] Connection initialization warning:', err.message);
      globalScope._mongoClientPromise = undefined;
      globalScope._mongoClientInstance = undefined;
      throw err;
    });
  }

  return globalScope._mongoClientPromise;
}

export function resetMongoClient() {
  const globalScope = globalThis as any;
  if (globalScope._mongoClientInstance) {
    try {
      globalScope._mongoClientInstance.close(false).catch(() => {});
    } catch {}
  }
  globalScope._mongoClientPromise = undefined;
  globalScope._mongoClientInstance = undefined;
}

/**
 * Returns active database with automatic reuse of persistent connection
 */
export async function getDatabase() {
  if (!isMongoConfigured()) {
    throw new Error('MONGODB_URI is not configured');
  }

  try {
    const client = await getMongoClientPromise();
    return client.db(MONGODB_CONFIG.dbName);
  } catch (err: any) {
    // If the promise rejected previously, clear it and retry once
    const globalScope = globalThis as any;
    globalScope._mongoClientPromise = undefined;
    globalScope._mongoClientInstance = undefined;

    const freshClient = await getMongoClientPromise();
    return freshClient.db(MONGODB_CONFIG.dbName);
  }
}
