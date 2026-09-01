import React from 'react';

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050816' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        </div>
        <div className="h-4 w-28 rounded-md bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
