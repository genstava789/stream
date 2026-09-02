export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  release_date: string;
  genre_ids: number[];
  popularity: number;
  adult: boolean;
  original_language: string;
  original_title: string;
  video: boolean;
}

export interface Genre {
  id: number;
  name: string;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at?: string;
  size?: number;
}

export interface Cast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  cast_id?: number;
  credit_id?: string;
  gender?: number;
  known_for_department?: string;
  original_name?: string;
  popularity?: number;
}

export interface Crew {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
  credit_id?: string;
  gender?: number;
  known_for_department?: string;
  original_name?: string;
  popularity?: number;
}

export interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface SpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface MovieDetail extends Movie {
  runtime: number | null;
  genres: Genre[];
  production_companies: ProductionCompany[];
  tagline: string | null;
  status: string;
  budget: number;
  revenue: number;
  homepage: string | null;
  imdb_id: string | null;
  spoken_languages: SpokenLanguage[];
  images?: {
    backdrops?: any[];
    posters?: any[];
    logos?: {
      file_path: string;
      iso_639_1?: string;
      aspect_ratio?: number;
      width?: number;
      height?: number;
    }[];
  };
  videos: {
    results: Video[];
  };
  credits: {
    cast: Cast[];
    crew: Crew[];
  };
  similar: {
    results: Movie[];
    page: number;
    total_pages: number;
    total_results: number;
  };
  recommendations?: {
    results: Movie[];
    page: number;
    total_pages: number;
    total_results: number;
  };
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TVShow {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  first_air_date: string;
  genre_ids: number[];
  popularity?: number;
  original_language?: string;
  original_name?: string;
  origin_country?: string[];
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date?: string;
}

export interface TVShowDetail extends TVShow {
  genres: Genre[];
  number_of_episodes: number;
  number_of_seasons: number;
  status: string;
  tagline: string | null;
  homepage?: string | null;
  runtime?: number;
  episode_run_time: number[];
  seasons?: TMDBSeason[];
  images?: {
    backdrops?: any[];
    posters?: any[];
    logos?: {
      file_path: string;
      iso_639_1?: string;
      aspect_ratio?: number;
      width?: number;
      height?: number;
    }[];
  };
  videos: {
    results: Video[];
  };
  credits: {
    cast: Cast[];
    crew: Crew[];
  };
  similar: {
    results: TVShow[];
    page: number;
    total_pages: number;
    total_results: number;
  };
  recommendations?: {
    results: TVShow[];
    page: number;
    total_pages: number;
    total_results: number;
  };
}

export interface GenreListResponse {
  genres: Genre[];
}
