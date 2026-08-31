import React from 'react';

export default function CollectionsLoading() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 animate-fadeIn" style={{ background: '#050816' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        
        {/* ── Banner Skeleton ── */}
        <div className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-10 mb-8 sm:mb-10 overflow-hidden border border-white/10 bg-[#090e21]/60">
          <div className="w-36 h-6 rounded-full skeleton mb-4" />
          <div className="w-2/3 max-w-lg h-9 sm:h-12 rounded-xl skeleton mb-3" />
          <div className="w-4/5 max-w-md h-4 rounded skeleton mb-6" />
          <div className="w-48 h-11 rounded-xl skeleton" />
        </div>

        {/* ── Filter Bar Skeleton ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-20 h-9 rounded-xl skeleton" />
            <div className="w-20 h-9 rounded-xl skeleton" />
            <div className="w-20 h-9 rounded-xl skeleton" />
          </div>
          <div className="w-full sm:w-64 h-10 rounded-xl skeleton" />
        </div>

        {/* ── Collections Cards Grid Skeleton ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden p-4 space-y-4"
            >
              <div className="aspect-[16/9] w-full rounded-xl skeleton" />
              <div className="space-y-2">
                <div className="w-3/4 h-5 rounded skeleton" />
                <div className="w-full h-3.5 rounded skeleton opacity-70" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full skeleton" />
                  <div className="w-20 h-3 rounded skeleton" />
                </div>
                <div className="w-12 h-3 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
