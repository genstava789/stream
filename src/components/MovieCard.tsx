'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Tv, Film } from 'lucide-react';
import { Movie, TVShow } from '@/types/tmdb';
import { getImageUrl } from '@/lib/tmdb';
import { getMovieUrl, getTVUrl } from '@/lib/urls';

interface MovieCardProps {
  item: Movie | TVShow;
  type?: 'movie' | 'tv';
  priority?: boolean;
}

function getItemMediaType(item: Movie | TVShow, propType?: 'movie' | 'tv'): 'movie' | 'tv' {
  if ((item as any).media_type === 'tv' || (item as any).isCustomTV) return 'tv';
  if ((item as any).media_type === 'movie' || (item as any).isCustomMarkdown) return 'movie';
  if (propType) return propType;
  if ('first_air_date' in item || ('name' in item && !('release_date' in item))) return 'tv';
  return 'movie';
}

export default function MovieCard({ item, type, priority = false }: MovieCardProps) {
  const [imgError, setImgError] = useState(false);

  const resolvedType = getItemMediaType(item, type);
  const title = resolvedType === 'tv' ? (item as any).name || (item as any).title : (item as any).title || (item as any).name;
  const date = resolvedType === 'tv' ? (item as any).first_air_date : (item as any).release_date;
  const year = date ? new Date(date).getFullYear() : null;
  const rating = Math.round((item.vote_average || 0) * 10) / 10;
  const href = resolvedType === 'tv' ? getTVUrl(item) : getMovieUrl(item);

  const imagePath = item.poster_path || item.backdrop_path;
  // Use w342 for optimal bandwidth & instant rendering in 2-6 col grids
  const posterUrl = getImageUrl(imagePath, 'w342');

  return (
    <Link
      href={href}
      className="group/card block w-full select-none"
    >
      {/* ── Poster Wrapper ── */}
      <div className="relative aspect-[2/3] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c1224] border border-white/10 shadow-md group-hover/card:shadow-xl transition-all duration-300 transform group-hover/card:-translate-y-1.5">
        {/* Background placeholder */}
        <div className="absolute inset-0 bg-white/[0.04]" />

        {/* Poster Image - Direct from TMDB Cloudflare CDN */}
        {imagePath && !imgError ? (
          <img
            key={posterUrl}
            src={posterUrl}
            alt={title || 'Movie Poster'}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#0f1a2e] to-[#1a2540] text-slate-500">
            {resolvedType === 'tv' ? <Tv size={32} /> : <Film size={32} />}
            <span className="text-xs text-center line-clamp-2 text-slate-400 font-medium">{title}</span>
          </div>
        )}

        {/* ── IMDb-Style Yellow Rating Badge (Top-Right) ── */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md bg-[#f5c518] text-black font-black text-[10px] sm:text-[11.5px] shadow-lg shadow-black/50 tracking-tight">
          <Star size={11} fill="currentColor" stroke="none" className="text-black" />
          <span>{rating > 0 ? rating.toFixed(1) : 'NR'}</span>
        </div>

        {/* ── Media Type Badge (Top-Left: Series / Movie) ── */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-slate-200 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider shadow-md">
          {resolvedType === 'tv' ? (
            <>
              <Tv size={10} className="text-cyan-400" />
              <span>Series</span>
            </>
          ) : (
            <>
              <Film size={10} className="text-cyan-400" />
              <span>Movie</span>
            </>
          )}
        </div>
      </div>

      {/* ── Info Outside Below Poster ── */}
      <div className="pt-2 sm:pt-2.5 px-0.5 space-y-1">
        <h3
          title={title}
          className="font-bold text-white text-xs sm:text-[13.5px] leading-snug line-clamp-2 group-hover/card:text-cyan-400 transition-colors"
        >
          {title}
        </h3>
        <div className="flex items-center text-[11px] sm:text-xs text-slate-400 font-medium">
          <span>{year || '2025'}</span>
        </div>
      </div>
    </Link>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="w-full space-y-2 select-none animate-pulse">
      <div className="aspect-[2/3] w-full rounded-xl sm:rounded-2xl overflow-hidden skeleton bg-white/[0.08] border border-white/5 relative">
        <div className="absolute top-2 left-2 w-12 h-4 rounded-md bg-white/[0.06] skeleton" />
        <div className="absolute top-2 right-2 w-8 h-4 rounded-md bg-white/[0.06] skeleton" />
      </div>
      <div className="space-y-1.5 px-0.5 pt-1">
        <div className="h-3.5 w-3/4 rounded-md bg-white/[0.08] skeleton" />
        <div className="h-2.5 w-1/3 rounded-md bg-white/[0.05] skeleton" />
      </div>
    </div>
  );
}
