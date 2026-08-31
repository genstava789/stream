import React from 'react';

interface HeroSkeletonProps {
  type?: 'movie' | 'tv';
}

export default function HeroSkeleton({ type = 'movie' }: HeroSkeletonProps) {
  return (
    <section className="relative w-full h-[520px] sm:h-[600px] lg:h-[680px] overflow-hidden bg-[#050816] select-none">
      {/* Background Shimmer Backdrop */}
      <div className="absolute inset-0 skeleton-dark opacity-80" />

      {/* Ambient Gradient Overlays matching Hero.tsx */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/70 to-transparent" />

      {/* Decorative Glow Blob */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Content Skeleton */}
      <div className="relative z-10 h-full flex items-end pb-12 sm:pb-16 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        <div className="w-full max-w-2xl space-y-4 sm:space-y-5">
          {/* Badge Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-6 w-32 rounded-full skeleton-glow" />
            <div className="h-6 w-20 rounded-md skeleton" />
          </div>

          {/* Title Skeleton (2 lines) */}
          <div className="space-y-2.5">
            <div className="h-9 sm:h-12 w-4/5 rounded-2xl skeleton" />
            <div className="h-8 sm:h-11 w-3/5 rounded-2xl skeleton" />
          </div>

          {/* Meta & Genres Skeleton */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-5 w-12 rounded-md skeleton" />
            <div className="h-5 w-16 rounded-md skeleton" />
            <div className="h-6 w-20 rounded-full skeleton" />
            <div className="h-6 w-24 rounded-full skeleton" />
          </div>

          {/* Description / Overview Skeleton (3 lines) */}
          <div className="space-y-2 pt-1 max-w-xl">
            <div className="h-3.5 w-full rounded-md skeleton" />
            <div className="h-3.5 w-11/12 rounded-md skeleton" />
            <div className="h-3.5 w-3/4 rounded-md skeleton" />
          </div>

          {/* Action Buttons Skeleton */}
          <div className="flex items-center gap-3 pt-3">
            <div className="h-11 sm:h-12 w-36 sm:w-44 rounded-xl skeleton-glow shadow-lg" />
            <div className="h-11 sm:h-12 w-28 sm:w-32 rounded-xl skeleton" />
          </div>
        </div>
      </div>

      {/* Bottom Carousel Indicator Dots Skeleton */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className="h-2 w-8 rounded-full skeleton-glow" />
        <div className="h-2 w-2 rounded-full skeleton" />
        <div className="h-2 w-2 rounded-full skeleton" />
        <div className="h-2 w-2 rounded-full skeleton" />
        <div className="h-2 w-2 rounded-full skeleton" />
      </div>
    </section>
  );
}
