import React from 'react';
import { MovieCardSkeleton } from '@/components/MovieCard';

interface MovieRowSkeletonProps {
  title?: string;
  hasSeeAll?: boolean;
}

export default function MovieRowSkeleton({ title, hasSeeAll = false }: MovieRowSkeletonProps) {
  return (
    <section className="relative w-full max-w-full overflow-hidden select-none">
      {/* Header matching MovieRow.tsx */}
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-pink-500 opacity-60" />
          <div className="h-6 w-36 sm:w-48 rounded-lg skeleton" />
        </div>
        {hasSeeAll && (
          <div className="h-4 w-16 rounded-md skeleton" />
        )}
      </div>

      {/* Cards Row matching MovieRow.tsx grid/scroll */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 lg:gap-5 overflow-hidden">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className={idx >= 2 ? 'hidden sm:block' : ''}>
              <div className={idx >= 3 ? 'hidden md:block' : ''}>
                <div className={idx >= 4 ? 'hidden lg:block' : ''}>
                  <div className={idx >= 5 ? 'hidden xl:block' : ''}>
                    <div className={idx >= 6 ? 'hidden 2xl:block' : ''}>
                      <MovieCardSkeleton />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
