/**
 * Central Configuration for LeviStream Web Application
 * Edit properties here to customize website branding, metadata, featured hero items, and links.
 */

export interface FeaturedItem {
  id?: string | number;
  tmdbId?: number | string;
  title?: string;
  tagline?: string;
  overview?: string;
  backdropUrl?: string;
  posterUrl?: string;
  logoUrl?: string;
  trailerKey?: string;
  rating?: number;
  year?: string | number;
  duration?: string;
  type?: 'movie' | 'tv';
  genres?: string[];
  link?: string;
  badge?: string;
  featured?: boolean | string;
  isCustom?: boolean;
}

export interface SectionPages {
  home?: boolean;
  movie?: boolean;
  tv?: boolean;
}

export interface SectionFilter {
  trending?: boolean;
  language?: string | string[]; // e.g. 'ID', 'KR', 'EN', etc.
  featured?: boolean;
  genreId?: number;
}

export interface SectionFallback {
  enabled: boolean;
  tmdbType?: 'movie' | 'tv';
  tmdbEndpoint?:
  | 'trending'
  | 'popular'
  | 'top_rated'
  | 'now_playing'
  | 'airing_today'
  | 'discover_language'
  | 'discover_genre';
  tmdbLanguage?: string; // e.g. 'id' for Indonesian, 'ko' for Korean
  tmdbGenreId?: number;
}

export interface SectionConfig {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'mixed';
  pages: SectionPages;
  weight: number; // Lower weight appears higher on the page (10, 20, 30...)
  limit: number;  // Max items to display
  filter?: SectionFilter;
  fallback?: SectionFallback;
  seeAllHref?: string;
}

export const siteConfig = {
  name: 'LeviStream',
  nameUpper: 'LEVISTREAM',
  tagline: 'Watch Movies & TV Shows Online',
  description:
    'Discover and explore thousands of movies and TV shows. Find trending titles, top-rated classics, and everything in between on LeviStream.',
  url:
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://levistrm.freebuff.app',
  logoUrl: '/logo.png',
  keywords: [
    'movies',
    'TV shows',
    'streaming',
    'TMDB',
    'cinema',
    'watch online',
    'levistream',
    'anime',
    'kdrama',
  ],
  author: 'LeviStream',
  copyright: 'LeviStream',
  footerText: 'All rights reserved.',

  // Owner user credentials (auto-provisioned & synced with role: 'owner')
  owner: {
    username: 'Levi',
    email: 'kazumiteku6@gmail.com',
    password: process.env.OWNER_PASSWORD || 'admin',
  },

  // When enabled (true), video titles for generic scrapers & Rave.io use the format: "Judul (Tahun) | LeviStream"
  // When disabled (false), video titles will be: "Judul (Tahun)"
  useCreditTitleForRave: false,

  // When enabled (true), URLs for movies and TV shows use clean title-year slugs (e.g. /movie/mutiny-2026 or /tv/lanterns-2026)
  // When disabled (false), URLs use TMDB IDs (e.g. /movie/1288445 or /tv/95350)
  // Note: Multi-routing is always active, meaning year slugs, ID slugs, and legacy URLs all continue to work seamlessly!
  useTitleSlug: true,

  // Auto-slide interval for Featured Hero (in seconds)
  heroIntervalSeconds: 6,

  // Maximum items allowed in Featured Hero (auto-evicts older items if exceeded)
  featuredLimit: 7,

  // Customizable Featured Hero items for the carousel.
  // When empty, items are dynamically sourced from custom markdown files with `featured: true` in frontmatter.
  featuredItems: [] as FeaturedItem[],

  // ─────────────────────────────────────────────────────────────
  // MODULAR SECTION CONFIGURATIONS (HOME, MOVIE, TV)
  // Edit weights to reorder, set limits, or toggle home/movie/tv visibility
  // ─────────────────────────────────────────────────────────────
  sections: [
    {
      id: 'trending',
      title: 'Trending This Week',
      type: 'movie',
      pages: { home: true, movie: false, tv: false },
      weight: 10,
      limit: 10,
      filter: { trending: true },
      fallback: { enabled: true, tmdbType: 'movie', tmdbEndpoint: 'trending' },
    },
    {
      id: 'indonesiaMovie',
      title: 'Film Indonesia',
      type: 'movie',
      pages: { home: true, movie: true, tv: false },
      weight: 20,
      limit: 10,
      filter: { language: 'ID' },
      fallback: {
        enabled: true,
        tmdbType: 'movie',
        tmdbEndpoint: 'discover_language',
        tmdbLanguage: 'id',
      },
    },
    {
      id: 'indonesiaSeries',
      title: 'Series Indonesia',
      type: 'tv',
      pages: { home: true, movie: false, tv: true },
      weight: 30,
      limit: 10,
      filter: { language: 'ID' },
      fallback: {
        enabled: true,
        tmdbType: 'tv',
        tmdbEndpoint: 'discover_language',
        tmdbLanguage: 'id',
      },
    },
    {
      id: 'animeMovie',
      title: 'Anime Movie',
      type: 'movie',
      pages: { home: true, movie: true, tv: false },
      weight: 22,
      limit: 10,
      filter: { language: 'ANIME' },
      fallback: {
        enabled: true,
        tmdbType: 'movie',
        tmdbEndpoint: 'discover_language',
        tmdbLanguage: 'ja',
      },
      seeAllHref: '/movie?lang=anime',
    },
    {
      id: 'animeSeries',
      title: 'Anime Series',
      type: 'tv',
      pages: { home: true, movie: false, tv: true },
      weight: 24,
      limit: 10,
      filter: { language: 'ANIME' },
      fallback: {
        enabled: true,
        tmdbType: 'tv',
        tmdbEndpoint: 'discover_language',
        tmdbLanguage: 'ja',
      },
      seeAllHref: '/tv/browse?lang=anime',
    },
    {
      id: 'japanSeries',
      title: 'Series Jepang',
      type: 'tv',
      pages: { home: false, movie: false, tv: true },
      weight: 26,
      limit: 10,
      filter: { language: 'JP' },
      fallback: {
        enabled: true,
        tmdbType: 'tv',
        tmdbEndpoint: 'discover_language',
        tmdbLanguage: 'ja',
      },
      seeAllHref: '/tv/browse?lang=jp',
    },
    {
      id: 'drakor',
      title: 'Drama Korea',
      type: 'tv',
      pages: { home: false, movie: false, tv: true },
      weight: 25,
      limit: 10,
      filter: { language: 'KR' },
      fallback: {
        enabled: true,
        tmdbType: 'tv',
        tmdbEndpoint: 'discover_language',
        tmdbLanguage: 'ko',
      },
    },
    {
      id: 'recentlyAdded',
      title: 'Recently Added',
      type: 'movie',
      pages: { home: true, movie: true, tv: false },
      weight: 15,
      limit: 10,
      fallback: { enabled: true, tmdbType: 'movie', tmdbEndpoint: 'now_playing' },
      seeAllHref: '/movie?sort=release_date.desc',
    },
    {
      id: 'popularMovies',
      title: 'Popular Movies',
      type: 'movie',
      pages: { home: true, movie: true, tv: false },
      weight: 50,
      limit: 10,
      fallback: { enabled: true, tmdbType: 'movie', tmdbEndpoint: 'popular' },
      seeAllHref: '/movie?sort=popularity.desc',
    },
    {
      id: 'topRated',
      title: 'Top Rated',
      type: 'movie',
      pages: { home: true, movie: true, tv: false },
      weight: 60,
      limit: 10,
      fallback: { enabled: true, tmdbType: 'movie', tmdbEndpoint: 'top_rated' },
      seeAllHref: '/movie?sort=vote_average.desc',
    },
    {
      id: 'trendingTV',
      title: 'Trending TV Shows',
      type: 'tv',
      pages: { home: true, movie: false, tv: true },
      weight: 70,
      limit: 10,
      filter: { trending: true },
      fallback: { enabled: true, tmdbType: 'tv', tmdbEndpoint: 'trending' },
    },
    {
      id: 'recentlyAddedSeries',
      title: 'Recently Added',
      type: 'tv',
      pages: { home: false, movie: false, tv: true },
      weight: 35,
      limit: 10,
      fallback: { enabled: true, tmdbType: 'tv', tmdbEndpoint: 'airing_today' },
      seeAllHref: '/tv/browse?sort=first_air_date.desc',
    },
    {
      id: 'popularTV',
      title: 'Popular TV Shows',
      type: 'tv',
      pages: { home: false, movie: false, tv: true },
      weight: 45,
      limit: 10,
      fallback: { enabled: true, tmdbType: 'tv', tmdbEndpoint: 'popular' },
      seeAllHref: '/tv/browse?sort=popularity.desc',
    },
    {
      id: 'topRatedSeries',
      title: 'Top Rated Series',
      type: 'tv',
      pages: { home: false, movie: false, tv: true },
      weight: 55,
      limit: 10,
      fallback: { enabled: true, tmdbType: 'tv', tmdbEndpoint: 'top_rated' },
      seeAllHref: '/tv/browse?sort=vote_average.desc',
    },
  ] as SectionConfig[],

  // Legacy Section Headings for Homepage
  homepageSections: {
    browseGenres: 'Browse by Genre',
    trending: 'Trending This Week',
    recentlyAdded: 'Recently Added',
    popularMovies: 'Popular Movies',
    topRated: 'Top Rated',
    trendingTV: 'Trending TV Shows',
  },

  // Legacy Section Headings for TV Page
  tvSections: {
    pageTitle: 'TV Shows',
    pageSubtitle: 'Discover the best series',
    browseGenres: 'Browse Series by Genre',
    trending: 'Trending This Week',
    recentlyAdded: 'Recently Added',
    popular: 'Popular TV Shows',
    topRated: 'Top Rated Series',
  },

  links: {
    github: 'https://github.com/genstava789/stream',
  },

  // Customizable Warning Notice for Non-Local Content (Custom Pages)
  nonLocalWarning: {
    movie: {
      id: {
        title: 'Film ini belum di tambahkan ke database',
        description: 'Konten video lokal untuk film ini belum tersedia. Halaman ini hanya menampilkan informasi baseline dari TMDB.',
      },
      en: {
        title: 'This movie has not been added to the database',
        description: 'Local video content for this movie is currently unavailable. This page only displays baseline information from TMDB.',
      },
    },
    tv: {
      id: {
        title: 'Series ini belum ditambahkan ke database',
        description: 'Konten episode dan video lokal untuk serial TV ini belum tersedia. Halaman ini hanya menampilkan informasi baseline dari TMDB.',
      },
      en: {
        title: 'This series has not been added to the database',
        description: 'Local episode and video content for this TV series is currently unavailable. This page only displays baseline information from TMDB.',
      },
    },
  },

  // Telegram Bot Notification Config
  telegram: {
    botToken: '6673058749:AAH0X2vdpEgWNxeDhsZJy77_pXIG-_YCpRU',
    chatId: process.env.TELEGRAM_CHAT_ID || '1487943213', // Target Telegram Chat ID / Channel ID / Group ID
  },
};

export type SiteConfig = typeof siteConfig;
export default siteConfig;


