import React from 'react';

interface GenreFilterSkeletonProps {
  title?: string;
}

export default function GenreFilterSkeleton({ title = 'Browse by Genre' }: GenreFilterSkeletonProps) {
  return (
    <section className="w-full select-none">
      {/* Header with accent bar */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-pink-500 opacity-60" />
        <div className="h-5 w-36 sm:w-44 rounded-md skeleton" />
      </div>

      {/* Pill Row */}
      <div className="flex items-center gap-2 overflow-x-hidden py-1">
        <div className="h-9 w-20 rounded-full skeleton-glow flex-shrink-0" />
        <div className="h-9 w-24 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-28 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-24 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-32 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-24 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-28 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-20 rounded-full skeleton flex-shrink-0" />
        <div className="h-9 w-28 rounded-full skeleton flex-shrink-0" />
      </div>
    </section>
  );
}
