import { defineConfig } from 'tinacms';

// TinaCMS configuration for LeviStream / Filmanesia
// Manages local and git-backed markdown files in video/ and tv/
const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  'main';

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID || '',
  token: process.env.TINA_TOKEN || '',
  build: {
    outputFolder: 'admin/tina',
    publicFolder: 'public',
  },
  media: {
    tina: {
      mediaRoot: 'uploads',
      publicFolder: 'public',
    },
  },
  schema: {
    collections: [
      {
        name: 'movie',
        label: 'Movies',
        path: 'video',
        format: 'md',
        ui: {
          router: ({ document }) => {
            return `/movie/${document._sys.filename}`;
          },
        },
        fields: [
          {
            type: 'number',
            name: 'tmdb_id',
            label: 'TMDB ID',
            required: true,
            description: 'The numeric TMDB ID for metadata fetching',
          },
          {
            type: 'string',
            name: 'videourl',
            label: 'Video Stream URL',
            required: true,
            description: 'Direct MP4, MKV, or HLS (.m3u8) video stream URL',
          },
          {
            type: 'string',
            name: 'title',
            label: 'Custom Title',
            description: 'Overrides default TMDB movie title',
          },
          {
            type: 'string',
            name: 'deskripsi',
            label: 'Deskripsi / Synopsis',
            ui: {
              component: 'textarea',
            },
          },
          {
            type: 'image',
            name: 'image_url',
            label: 'Poster / Backdrop Image URL',
            description: 'Custom poster or backdrop image URL',
          },
          {
            type: 'number',
            name: 'rating',
            label: 'Rating (0 - 10)',
          },
          {
            type: 'boolean',
            name: 'featured',
            label: 'Featured Hero Banner',
            description: 'Display in homepage hero carousel',
          },
          {
            type: 'string',
            name: 'subtitles',
            label: 'Subtitles URL / VTT',
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Content Body (Markdown)',
            isBody: true,
          },
        ],
      },
      {
        name: 'tvShow',
        label: 'TV Shows',
        path: 'tv',
        format: 'md',
        match: {
          include: '**/_index',
        },
        ui: {
          router: ({ document }) => {
            const parts = document._sys.relativePath.split('/');
            return `/tv/${parts[0]}`;
          },
        },
        fields: [
          {
            type: 'number',
            name: 'tmdb_id',
            label: 'TMDB ID',
            required: true,
            description: 'The numeric TMDB TV Show ID',
          },
          {
            type: 'string',
            name: 'title',
            label: 'Custom Series Title',
            description: 'Overrides TMDB default series title',
          },
          {
            type: 'string',
            name: 'deskripsi',
            label: 'Deskripsi / Synopsis',
            ui: {
              component: 'textarea',
            },
          },
          {
            type: 'image',
            name: 'image_url',
            label: 'Poster / Backdrop Image URL',
            description: 'Custom poster or backdrop image URL for the series',
          },
          {
            type: 'number',
            name: 'rating',
            label: 'Rating (0 - 10)',
          },
          {
            type: 'boolean',
            name: 'featured',
            label: 'Featured Hero Banner',
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Content Body (Markdown)',
            isBody: true,
          },
        ],
      },
      {
        name: 'tvEpisode',
        label: 'TV Episodes',
        path: 'tv',
        format: 'md',
        match: {
          exclude: '**/_index',
        },
        ui: {
          router: ({ document }) => {
            const rel = document._sys.relativePath.replace(/\.md$/, '');
            return `/tv/${rel}`;
          },
        },
        fields: [
          {
            type: 'string',
            name: 'videourl',
            label: 'Video Stream URL',
            required: true,
          },
          {
            type: 'string',
            name: 'title',
            label: 'Episode Title',
          },
          {
            type: 'string',
            name: 'deskripsi',
            label: 'Episode Overview',
            ui: {
              component: 'textarea',
            },
          },
          {
            type: 'image',
            name: 'image_url',
            label: 'Episode Thumbnail / Backdrop Image',
          },
          {
            type: 'number',
            name: 'rating',
            label: 'Episode Rating',
          },
          {
            type: 'string',
            name: 'duration',
            label: 'Duration (e.g. 45m)',
          },
          {
            type: 'string',
            name: 'subtitles',
            label: 'Subtitles URL',
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Episode Notes (Markdown)',
            isBody: true,
          },
        ],
      },
    ],
  },
});
