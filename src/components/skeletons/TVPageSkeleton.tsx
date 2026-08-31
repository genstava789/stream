import React from 'react';
import HeroSkeleton from './HeroSkeleton';
import GenreFilterSkeleton from './GenreFilterSkeleton';
import MovieRowSkeleton from './MovieRowSkeleton';

export default function TVPageSkeleton() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip overflow-x-hidden" style={{ background: '#050816' }}>
      {/* Hero Carousel Skeleton */}
      <HeroSkeleton type="tv" />

      {/* Content sections Skeleton */}
      <div className="relative z-10 space-y-10 pb-6 sm:pb-8 pt-2 sm:pt-4">
        {/* Browse TV Series by Genre Filter */}
        <section className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
          <GenreFilterSkeleton title="Browse Series by Genre" />
        </section>

        {/* Trending TV Series Skeleton */}
        <MovieRowSkeleton title="Trending This Week" />

        {/* Recently Added Series Skeleton */}
        <MovieRowSkeleton title="Recently Added Series" hasSeeAll={true} />

        {/* Popular Series Skeleton */}
        <MovieRowSkeleton title="Popular Series" hasSeeAll={true} />

        {/* Top Rated Series Skeleton */}
        <MovieRowSkeleton title="Top Rated Series" hasSeeAll={true} />
      </div>
    </div>
  );
}
