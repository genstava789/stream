import React from 'react';
import { MovieCardSkeleton } from '@/components/MovieCard';

export default function TVLoading() {
  return (
    <div className="min-h-screen" style={{ background: '#050816' }}>
      {/* Hero Skeleton Banner */}
      <div className="w-full aspect-[21/9] min-h-[360px] max-h-[600px] bg-black/80 relative flex items-end pb-12 px-6 sm:px-12 animate-pulse border-b border-white/5">
        <div className="space-y-4 max-w-2xl">
          <div className="h-6 w-32 rounded-md bg-cyan-500/20 border border-cyan-500/30" />
          <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-white/10" />
          <div className="h-4 w-full rounded-md bg-white/5" />
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-32 rounded-xl bg-cyan-500/30" />
            <div className="h-10 w-28 rounded-xl bg-white/10" />
          </div>
        </div>
      </div>

      {/* Sections Skeleton */}
      <div className="space-y-10 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 py-8">
        <div className="space-y-4">
          <div className="h-6 w-48 rounded-lg bg-white/10 animate-pulse" />
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
