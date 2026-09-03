import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Default Hugging Face S3 configuration
const DEFAULT_S3_CONFIG = {
  endpoint: process.env.S3_ENDPOINT || 'https://s3.hf.co/nexus33rd',
  accessKeyId: process.env.S3_ACCESS_KEY_ID || 'HFAKThDrTafBd4HlgGJ7h9Taeaxn19Q',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'a8296883688497e29a30b8f04d01f93526aad73a854455f27cbbeec657ba5ef4',
  region: process.env.S3_REGION || 'us-east-1',
  defaultBucket: process.env.S3_BUCKET || 'cloud',
  namespace: 'nexus33rd',
};

let cachedClient: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: DEFAULT_S3_CONFIG.region,
      endpoint: DEFAULT_S3_CONFIG.endpoint,
      credentials: {
        accessKeyId: DEFAULT_S3_CONFIG.accessKeyId,
        secretAccessKey: DEFAULT_S3_CONFIG.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }
  return cachedClient;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function buildPublicStreamUrl(bucket: string, key: string): string {
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  // Encode each path segment so spaces and special characters are preserved properly
  const encodedSegments = cleanKey
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `https://huggingface.co/buckets/${DEFAULT_S3_CONFIG.namespace}/${bucket}/resolve/${encodedSegments}`;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.ts', '.m3u8'];
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.sub'];

export function isVideoFile(key: string): boolean {
  const lower = key.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isSubtitleFile(key: string): boolean {
  const lower = key.toLowerCase();
  return SUBTITLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface S3ItemFile {
  key: string;
  name: string;
  size: number;
  sizeFormatted: string;
  lastModified?: string;
  isVideo: boolean;
  isSubtitle: boolean;
  streamUrl: string;
}

export interface S3BrowseResult {
  buckets: string[];
  currentBucket: string;
  prefix: string;
  folders: string[];
  files: S3ItemFile[];
}

export async function listS3Buckets(): Promise<string[]> {
  try {
    const client = getS3Client();
    const res = await client.send(new ListBucketsCommand({}));
    const names = (res.Buckets || []).map((b) => b.Name).filter(Boolean) as string[];
    if (names.length === 0) return [DEFAULT_S3_CONFIG.defaultBucket];
    return names;
  } catch (err) {
    console.warn('[s3] listS3Buckets error, falling back to default:', err);
    return [DEFAULT_S3_CONFIG.defaultBucket, 'my'];
  }
}

export async function listS3Objects(
  bucketName?: string,
  prefix: string = '',
  delimiter: string = '/'
): Promise<S3BrowseResult> {
  const client = getS3Client();
  const bucket = bucketName || DEFAULT_S3_CONFIG.defaultBucket;
  const cleanPrefix = prefix ? (prefix.startsWith('/') ? prefix.slice(1) : prefix) : '';

  const [buckets, objectsRes] = await Promise.all([
    listS3Buckets(),
    client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: cleanPrefix,
        Delimiter: delimiter,
        MaxKeys: 1000,
      })
    ),
  ]);

  const folders = (objectsRes.CommonPrefixes || [])
    .map((cp) => cp.Prefix)
    .filter(Boolean) as string[];

  const files: S3ItemFile[] = (objectsRes.Contents || [])
    .filter((obj) => obj.Key && !obj.Key.endsWith('/')) // exclude folder marker objects
    .map((obj) => {
      const key = obj.Key!;
      // Get filename from key
      const name = key.split('/').filter(Boolean).pop() || key;
      const size = obj.Size || 0;
      return {
        key,
        name,
        size,
        sizeFormatted: formatBytes(size),
        lastModified: obj.LastModified ? obj.LastModified.toISOString() : undefined,
        isVideo: isVideoFile(key),
        isSubtitle: isSubtitleFile(key),
        streamUrl: buildPublicStreamUrl(bucket, key),
      };
    });

  return {
    buckets,
    currentBucket: bucket,
    prefix: cleanPrefix,
    folders,
    files,
  };
}
