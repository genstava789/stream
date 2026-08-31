import React from 'react';
import { MovieCardSkeleton } from '@/components/MovieCard';
import GenreFilterSkeleton from '@/components/skeletons/GenreFilterSkeleton';

export default function GenreLoading() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-8 sm:pb-12" style={{ background: '#050816' }}>
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        {/* Header Skeleton */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="h-8 sm:h-10 w-48 sm:w-64 rounded-xl skeleton mb-2" />
            <div className="h-4 w-36 rounded-lg skeleton opacity-60" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-40 rounded-xl skeleton" />
            <div className="h-9 w-28 rounded-xl skeleton" />
          </div>
        </div>

        {/* Genre Pills Skeleton */}
        <div className="mb-8">
          <GenreFilterSkeleton title="" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
          {Array.from({ length: 18 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
