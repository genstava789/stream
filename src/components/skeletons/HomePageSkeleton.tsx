import React from 'react';
import HeroSkeleton from './HeroSkeleton';
import GenreFilterSkeleton from './GenreFilterSkeleton';
import MovieRowSkeleton from './MovieRowSkeleton';

export default function HomePageSkeleton() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip overflow-x-hidden" style={{ background: '#050816' }}>
      {/* Hero Carousel Skeleton */}
      <HeroSkeleton type="movie" />

      {/* Content sections Skeleton */}
      <div className="relative z-10 space-y-10 pb-6 sm:pb-8 pt-2 sm:pt-4">
        {/* Genre Filter Skeleton */}
        <section className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
          <GenreFilterSkeleton />
        </section>

        {/* Trending Movies Skeleton */}
        <MovieRowSkeleton title="Trending This Week" />

        {/* Recently Added Movies Skeleton */}
        <MovieRowSkeleton title="Recently Added Movies" hasSeeAll={true} />

        {/* Popular Movies Skeleton */}
        <MovieRowSkeleton title="Popular Movies" hasSeeAll={true} />

        {/* Top Rated Movies Skeleton */}
        <MovieRowSkeleton title="Top Rated Movies" hasSeeAll={true} />

        {/* Trending TV Skeleton */}
        <MovieRowSkeleton title="Trending TV Shows" hasSeeAll={true} />
      </div>
    </div>
  );
}
