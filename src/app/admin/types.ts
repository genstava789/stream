export interface MovieItem {
  filename: string;
  slug: string;
  relativePath: string;
  frontmatter: Record<string, any>;
  content: string;
  posterUrl: string | null;
  customImageUrl?: string | null;
  displayTitle?: string;
  year?: number | null;
  rating?: number | null;
  updatedAt?: number;
}

export interface TVEpisodeItem {
  showSlug: string;
  seasonFolder: string | null;
  filename: string;
  slug: string;
  relativePath: string;
  frontmatter: Record<string, any>;
  content: string;
  displayTitle?: string;
  posterUrl: string | null;
  updatedAt?: number;
}

export interface TVShowItem {
  showSlug: string;
  relativePath: string;
  frontmatter: Record<string, any>;
  content: string;
  updatedAt: number;
  episodes: TVEpisodeItem[];
  posterUrl: string | null;
  customImageUrl?: string | null;
  displayTitle?: string;
  year?: number | null;
  rating?: number | null;
}

export interface TMDBBackdropImage {
  filePath: string;
  url: string;
  thumbUrl: string;
  originalUrl: string;
  language: string;
  voteAverage: number;
}

export interface TMDBPreviewData {
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  rating: number | null;
  genres: string[];
  originalLanguage?: string;
  backdrops?: TMDBBackdropImage[];
}

export interface DraftEpisode {
  id: string;
  episode: string;
  videourl: string;
  title: string;
  image_url: string;
  desc?: string;
  rating?: number | string;
  duration?: string;
  subtitles?: string;
}

export interface DraftSeason {
  id: string;
  season: string;
  episodes: DraftEpisode[];
}

export interface EditingItemState {
  type: 'movie' | 'tv_show' | 'tv_episode';
  relativePath: string;
  frontmatter: Record<string, any>;
  content: string;
}

export interface ToastNotification {
  id: number;
  message: string;
  type?: 'success' | 'error';
}
