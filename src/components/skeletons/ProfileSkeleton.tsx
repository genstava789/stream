import React from 'react';

export default function ProfileSkeleton() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-20 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 select-none" style={{ background: '#050816' }}>
      <div className="max-w-6xl mx-auto space-y-8 animate-pulse">

        {/* ── 1. PROFILE HEADER SKELETON ── */}
        <div
          className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
          style={{
            background: 'rgba(11, 16, 32, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            {/* Left: Avatar + User info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
              {/* Avatar Box */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/[0.08] skeleton flex-shrink-0" />

              {/* Text lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <div className="h-7 w-40 sm:w-52 rounded-xl bg-white/[0.08] skeleton" />
                  <div className="h-5 w-20 rounded-full bg-white/[0.06] skeleton" />
                </div>
                <div className="h-4 w-48 sm:w-64 rounded-lg bg-white/[0.05] skeleton" />
                <div className="h-3.5 w-36 rounded-lg bg-white/[0.04] skeleton pt-1" />
              </div>
            </div>

            {/* Right: Stats pills & action button */}
            <div className="flex flex-col items-center sm:items-end gap-3.5 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="h-16 w-24 rounded-2xl bg-white/[0.06] skeleton" />
                <div className="h-16 w-24 rounded-2xl bg-white/[0.06] skeleton" />
              </div>
              <div className="h-10 w-28 rounded-xl bg-white/[0.06] skeleton" />
            </div>
          </div>
        </div>

        {/* ── 2. TAB SWITCHER SKELETON ── */}
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 rounded-2xl bg-white/[0.08] skeleton" />
            <div className="h-10 w-36 rounded-2xl bg-white/[0.05] skeleton" />
          </div>
        </div>

        {/* ── 3. CONTENT GRID SKELETON ── */}
        <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-2xl overflow-hidden bg-[#0c1226] border border-white/[0.08] p-0"
            >
              <div className="aspect-[2/3] w-full bg-white/[0.06] skeleton" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-white/[0.08] skeleton" />
                <div className="h-2.5 w-1/2 rounded bg-white/[0.04] skeleton" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
