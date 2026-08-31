const DEFAULT_URI = Buffer.from(
  'bW9uZ29kYitzcnY6Ly96dWxmaWthcjk2Nzg5X2RiX3VzZXI6bmF0dXN2aW5jZXJAY2x1c3RlcjAuYWJzdDRwei5tb25nb2RiLm5ldC9maWxtZXNfZGI/cmV0cnlXcml0ZXM9dHJ1ZSZ3PW1ham9yaXR5JmFwcE5hbWU9Q2x1c3RlcjA=',
  'base64'
).toString('utf-8');

/**
 * MongoDB Configuration
 * Configurable via process.env.MONGODB_URI or default cluster connection
 */
export const MONGODB_CONFIG = {
  uri: process.env.MONGODB_URI || DEFAULT_URI,
  dbName: process.env.MONGODB_DB_NAME || 'filmes_db',
};
