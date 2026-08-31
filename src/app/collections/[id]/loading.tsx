import React from 'react';

export default function CollectionDetailLoading() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 animate-fadeIn" style={{ background: '#050816' }}>
      
      {/* ── Hero Banner Header Skeleton ── */}
      <div className="relative w-full overflow-hidden border-b border-white/10 bg-[#090e21]/80 mb-8 sm:mb-12">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-12">
          
          {/* Back Button Skeleton */}
          <div className="w-44 h-8 rounded-xl skeleton mb-6" />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl w-full">
              
              {/* Badges Bar Skeleton */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-36 h-6 rounded-full skeleton" />
                <div className="w-24 h-6 rounded-full skeleton" />
              </div>

              {/* Title Skeleton */}
              <div className="w-3/4 max-w-md h-9 sm:h-12 rounded-xl skeleton mb-3" />

              {/* Description Skeleton */}
              <div className="space-y-2 mb-4 max-w-xl">
                <div className="w-full h-4 rounded skeleton" />
                <div className="w-4/5 h-4 rounded skeleton" />
              </div>

              {/* Author Metadata Skeleton */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full skeleton" />
                <div className="w-32 h-4 rounded skeleton" />
              </div>
            </div>

            {/* Action Buttons Skeleton */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-20 h-10 rounded-xl skeleton" />
              <div className="w-20 h-10 rounded-xl skeleton" />
              <div className="w-10 h-10 rounded-xl skeleton" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid of MovieCard Skeletons ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex flex-col space-y-2">
              <div className="aspect-[2/3] w-full rounded-xl skeleton border border-white/5" />
              <div className="w-4/5 h-3.5 rounded skeleton mt-1" />
              <div className="w-1/2 h-3 rounded skeleton opacity-60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
