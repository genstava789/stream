'use client';

import React, { useState } from 'react';
import { AlertTriangle, Globe } from 'lucide-react';
import siteConfig from '@/config';

interface NonLocalWarningProps {
  type: 'movie' | 'tv';
  className?: string;
}

export default function NonLocalWarning({ type, className = '' }: NonLocalWarningProps) {
  const [lang, setLang] = useState<'id' | 'en'>('id');

  const warningConfig = siteConfig?.nonLocalWarning?.[type]?.[lang] || {
    title: type === 'tv' ? 'Series ini belum ditambahkan ke database' : 'Film ini belum di tambahkan ke database',
    description: type === 'tv'
      ? 'Konten episode dan video lokal untuk serial TV ini belum tersedia. Halaman ini hanya menampilkan informasi baseline dari TMDB.'
      : 'Konten video lokal untuk film ini belum tersedia. Halaman ini hanya menampilkan informasi baseline dari TMDB.',
  };

  return (
    <div
      className={`relative p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md shadow-lg shadow-amber-950/20 text-left ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* Amber Icon Badge */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5 shadow-sm">
          <AlertTriangle size={19} className="sm:w-[21px] sm:h-[21px]" />
        </div>

        {/* Content & Language Switcher */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-tight leading-snug">
              {warningConfig.title}
            </h4>

            {/* Language Switch Tabs (ID | EN) */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-amber-500/30 text-[10px] sm:text-[11px] font-bold flex-shrink-0">
              <button
                type="button"
                onClick={() => setLang('id')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  lang === 'id'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-extrabold'
                    : 'text-amber-300/70 hover:text-amber-200'
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  lang === 'en'
                    ? 'bg-amber-400 text-slate-950 shadow-sm font-extrabold'
                    : 'text-amber-300/70 hover:text-amber-200'
                }`}
                title="English"
              >
                EN
              </button>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs text-amber-200/80 leading-relaxed">
            {warningConfig.description}
          </p>
        </div>
      </div>
    </div>
  );
}
