import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import MoviePageClient from './MoviePageClient';
import { getAllCustomMoviesForList } from '@/lib/markdownMovies';
import { getGenres } from '@/lib/tmdb';
import siteConfig from '@/config';

export const revalidate = 15;

export const metadata: Metadata = {
  title: `Browse Movies - ${siteConfig.name}`,
  description: `Discover and browse movies on ${siteConfig.name}. Search and filter by genre and popularity.`,
};

import { MovieCardSkeleton } from '@/components/MovieCard';

function MoviePageSkeleton() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-4 sm:pb-6" style={{ background: '#050816' }}>
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="h-8 w-48 bg-white/5 rounded-xl animate-pulse mb-2" />
            <div className="h-4 w-32 bg-white/5 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-9 w-24 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-9 w-28 bg-white/5 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
          {Array.from({ length: 18 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function MoviePage() {
  const [customMovies, genres] = await Promise.all([
    getAllCustomMoviesForList().catch(() => []),
    getGenres().catch(() => []),
  ]);

  return (
    <Suspense fallback={<MoviePageSkeleton />}>
      <MoviePageClient
        initialMovies={customMovies}
        totalResults={customMovies.length}
        totalPages={Math.max(1, Math.ceil(customMovies.length / 20))}
        allGenres={genres}
      />
    </Suspense>
  );
}
