import React from 'react';
import { MovieCardSkeleton } from '@/components/MovieCard';

export default function RootLoading() {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden" style={{ background: '#050816' }}>
      {/* ── 1. Hero Banner Skeleton ── */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] min-h-[460px] sm:min-h-[540px] max-h-[80vh] bg-black/50 border-b border-white/[0.06] overflow-hidden">
        {/* Shimmer Ambient Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/60 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/80 to-transparent z-10 pointer-events-none" />
        
        {/* Ambient Pulsing Glow in Background */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 right-10 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl animate-pulse" />

        {/* Hero Content Positioned Bottom-Left */}
        <div className="absolute bottom-0 left-0 z-20 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 pb-8 sm:pb-12 md:pb-16 max-w-3xl space-y-4">
          {/* Category / Featured Pill */}
          <div className="h-6 w-28 rounded-full bg-cyan-500/20 border border-cyan-500/30 animate-pulse" />

          {/* Large Title Placeholder */}
          <div className="space-y-2">
            <div className="h-10 sm:h-14 w-4/5 sm:w-3/4 rounded-2xl bg-white/10 animate-pulse" />
            <div className="h-7 sm:h-9 w-2/5 rounded-xl bg-white/[0.07] animate-pulse" />
          </div>

          {/* Badges Row (Rating, HD, Year, Genre) */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="h-6 w-14 rounded-md bg-amber-400/20 border border-amber-400/30 animate-pulse" />
            <div className="h-6 w-10 rounded-md bg-cyan-400/15 border border-cyan-400/30 animate-pulse" />
            <div className="h-6 w-16 rounded-md bg-white/[0.08] animate-pulse" />
            <div className="h-6 w-20 rounded-md bg-purple-500/15 border border-purple-500/30 animate-pulse" />
          </div>

          {/* Overview Lines */}
          <div className="space-y-2 pt-1 max-w-xl">
            <div className="h-3.5 w-full rounded-md bg-white/[0.07] animate-pulse" />
            <div className="h-3.5 w-4/5 rounded-md bg-white/[0.06] animate-pulse" />
            <div className="h-3.5 w-3/5 rounded-md bg-white/[0.05] animate-pulse hidden sm:block" />
          </div>

          {/* Action Buttons (Watch Now & Detail) */}
          <div className="flex items-center gap-3 pt-3">
            <div className="h-11 sm:h-12 w-36 sm:w-40 rounded-xl bg-cyan-500/25 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 animate-pulse" />
            <div className="h-11 sm:h-12 w-32 sm:w-36 rounded-xl bg-white/[0.08] border border-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── 2. Content Sections Skeleton (Movie Rows) ── */}
      <div className="relative z-10 space-y-10 sm:space-y-12 md:space-y-14 pb-16 pt-8 sm:pt-12 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        {/* Section 1: Film Terbaru */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 animate-pulse" />
              <div className="h-7 w-44 rounded-xl bg-white/10 animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded-lg bg-white/[0.05] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Section 2: Serial TV Populer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 animate-pulse" />
              <div className="h-7 w-48 rounded-xl bg-white/10 animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded-lg bg-white/[0.05] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Section 3: Trending Minggu Ini */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/30 animate-pulse" />
              <div className="h-7 w-40 rounded-xl bg-white/10 animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded-lg bg-white/[0.05] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
