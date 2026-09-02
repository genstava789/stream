import React from 'react';
import { MovieCardSkeleton } from '@/components/MovieCard';

export default function TVDetailLoading() {
  return (
    <div className="min-h-screen pb-12" style={{ background: '#050816' }}>
      {/* ── 1. Top Player Skeleton (Identical to Movie Player Skeleton) ── */}
      <div className="w-full bg-black/90 aspect-video max-h-[72vh] mb-4 relative flex items-center justify-center border-b border-white/5 overflow-hidden animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent opacity-80" />
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-cyan-400/40 animate-ping" />
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 pt-2 space-y-4">
        {/* ── 2. Episode Navigation Quick Bar Skeleton ── */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.08]">
          <div className="h-8 w-28 rounded-xl bg-white/[0.06] border border-white/5 animate-pulse" />
          <div className="h-5 w-24 rounded-md bg-white/[0.06] animate-pulse" />
          <div className="h-8 w-28 rounded-xl bg-white/[0.06] border border-white/5 animate-pulse" />
        </div>

        {/* ── 3. Episode Title Skeleton ── */}
        <div className="h-8 sm:h-10 w-3/5 sm:w-1/2 rounded-xl bg-white/[0.08] animate-pulse mb-3" />

        {/* ── 4. Badges (HD, Rating, Duration) ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 py-1 mb-4">
          <div className="h-6 w-10 rounded-md bg-cyan-400/15 border border-cyan-400/30 animate-pulse" />
          <div className="h-6 w-14 rounded-md bg-amber-400/20 border border-amber-400/30 animate-pulse" />
          <div className="h-5 w-16 rounded-md bg-white/[0.06] animate-pulse" />
          <div className="h-5 w-24 rounded-md bg-white/[0.06] animate-pulse" />
        </div>

        {/* ── 5. Overview Lines Skeleton ── */}
        <div className="space-y-2 max-w-4xl pt-1 mb-6">
          <div className="h-3.5 w-full rounded-md bg-white/[0.06] animate-pulse" />
          <div className="h-3.5 w-5/6 rounded-md bg-white/[0.06] animate-pulse" />
          <div className="h-3.5 w-2/3 rounded-md bg-white/[0.05] animate-pulse" />
        </div>

        {/* ── 6. Season Selector & Episode Grid Skeleton ── */}
        <div className="space-y-3 pt-4 border-t border-white/[0.08]">
          <div className="flex items-center gap-2 pb-2">
            <div className="h-8 w-28 rounded-xl bg-cyan-500/20 border border-cyan-500/30 animate-pulse" />
            <div className="h-8 w-24 rounded-xl bg-white/[0.06] animate-pulse" />
          </div>
          {/* Episode Pills / Grid */}
          <div className="flex items-center gap-2 overflow-x-hidden py-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 w-14 flex-shrink-0 rounded-xl bg-white/[0.06] border border-white/5 animate-pulse" />
            ))}
          </div>
        </div>

        {/* ── 7. Recommended TV Shows Skeleton ── */}
        <div className="pt-10 border-t border-white/10 space-y-4">
          <div className="h-6 w-44 rounded-lg bg-white/[0.08] animate-pulse" />
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
