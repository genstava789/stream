/** @type {import('next').NextConfig} */
const nextConfig = {
  // Direct CDN loading to eliminate Vercel transformation usage and buffering latency
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Kompresi Brotli/Gzip & SWC Minification
  compress: true,
  swcMinify: true,

  // Optimasi tree-shaking untuk modul berat dan eliminasi stale router cache
  experimental: {
    optimizePackageImports: ['lucide-react', 'tinacms'],
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },

  // Optimasi webpack bundler untuk client/server separation
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
      };
    }
    return config;
  },

  // Header security untuk production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  // Redirect /video/:slug to /movie/:slug for convenience
  async redirects() {
    return [
      {
        source: '/video/toy-story5',
        destination: '/movie/toy-story-5',
        permanent: false,
      },
      {
        source: '/video/Transformers',
        destination: '/movie/transformers',
        permanent: false,
      },
      {
        source: '/video/:slug',
        destination: '/movie/:slug',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
