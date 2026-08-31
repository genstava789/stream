'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Play,
  ChevronDown,
  Clock,
  Tv,
  Check,
  Folder,
  Film,
} from 'lucide-react';
import { CustomSeason, CustomEpisode } from '@/lib/markdownTV';

interface TVEpisodeListProps {
  seasons: CustomSeason[];
  hasSeasons: boolean;
  showTitle: string;
  showSlug: string;
  defaultBackdrop?: string;
}

function EpisodeRowItem({
  ep,
  showTitle,
  defaultBackdrop,
}: {
  ep: CustomEpisode;
  showTitle: string;
  defaultBackdrop?: string;
}) {
  const initialSrc = ep.imageUrl || defaultBackdrop || '';
  const [imgSrc, setImgSrc] = useState<string>(initialSrc);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const src = ep.imageUrl || defaultBackdrop || '';
    setImgSrc(src);
    setImgError(false);
  }, [ep.imageUrl, defaultBackdrop]);

  const isValidUrl = Boolean(imgSrc && (imgSrc.startsWith('http://') || imgSrc.startsWith('https://') || imgSrc.startsWith('/')));

  return (
    <Link
      href={ep.urlPath}
      className="group/episode relative rounded-2xl p-2.5 sm:p-3.5 border transition-all duration-200 hover:scale-[1.01] hover:border-cyan-500/40 flex items-center gap-2.5 sm:gap-4 w-full"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.07)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* 1. Episode Index Number */}
      <span className="text-xs sm:text-sm font-black min-w-[18px] sm:min-w-[24px] text-center text-slate-500 group-hover/episode:text-cyan-400 transition-colors flex-shrink-0">
        {String(ep.episodeNumber).padStart(2, '0')}
      </span>

      {/* 2. 16:9 Thumbnail with Play Overlay & Duration */}
      <div
        className="relative rounded-xl overflow-hidden flex-shrink-0 w-24 sm:w-32 md:w-36 h-14 sm:h-18 md:h-20 bg-slate-900 flex items-center justify-center"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {!imgError && isValidUrl ? (
          <Image
            src={imgSrc}
            alt={ep.title}
            fill
            className="object-cover group-hover/episode:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 96px, (max-width: 1024px) 128px, 144px"
            onError={() => {
              if (defaultBackdrop && imgSrc !== defaultBackdrop && (defaultBackdrop.startsWith('http') || defaultBackdrop.startsWith('/'))) {
                setImgSrc(defaultBackdrop);
              } else {
                setImgError(true);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 text-slate-500">
            <Film size={20} className="mb-0.5 text-slate-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Preview</span>
          </div>
        )}

        {/* Duration Badge */}
        {ep.duration && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] sm:text-[10px] font-bold text-slate-200">
            {ep.duration}
          </span>
        )}
      </div>

      {/* 3. Title & Information (Flex-1, auto-wraps neatly without cutoffs) */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span
            className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={{
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#06b6d4',
            }}
          >
            {ep.episodeLabel}
          </span>
          {ep.rating && (
            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
              ★ {ep.rating}
            </span>
          )}
        </div>

        {/* Episode Title */}
        <h3 className="text-xs sm:text-sm font-bold text-white group-hover/episode:text-cyan-300 transition-colors line-clamp-1 sm:line-clamp-2 leading-snug">
          {ep.title}
        </h3>

        {/* Overview Snippet (Desktop/Tablet) */}
        {ep.overview && (
          <p className="hidden md:block text-[11px] text-slate-400 mt-1 line-clamp-1 leading-relaxed">
            {ep.overview}
          </p>
        )}
      </div>

      {/* 4. Watch / Nonton Button (Flex-shrink-0, perfectly centered) */}
      <div className="flex items-center justify-end flex-shrink-0 pl-1">
        <span
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 group-hover/episode:scale-105 shadow-md"
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
            boxShadow: '0 0 12px rgba(6, 182, 212, 0.25)',
          }}
        >
          <Play size={11} fill="white" className="flex-shrink-0" />
          <span className="hidden xs:inline">Nonton</span>
        </span>
      </div>
    </Link>
  );
}

export default function TVEpisodeList({
  seasons,
  hasSeasons,
  showTitle,
  defaultBackdrop,
}: TVEpisodeListProps) {
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState<number>(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close season dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (!seasons || seasons.length === 0) return null;

  const currentSeason = seasons[selectedSeasonIndex] || seasons[0];

  return (
    <section className="mt-10 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
      {/* ── Header: Title & Season Dropdown ── */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(124, 58, 237, 0.2))',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)',
            }}
          >
            <Folder size={16} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Episodes List</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-400">
                {currentSeason.episodes.length} eps
              </span>
            </h2>
          </div>
        </div>

        {/* Season Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          {hasSeasons && seasons.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md"
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(124, 58, 237, 0.22))',
                  border: '1px solid rgba(6, 182, 212, 0.45)',
                  boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
                }}
              >
                <Folder size={12} className="text-cyan-400" />
                <span>{currentSeason.seasonName}</span>
                <ChevronDown
                  size={13}
                  className={`text-slate-400 transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180 text-cyan-400' : ''
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 p-1.5 rounded-2xl border z-30 shadow-2xl animate-in fade-in slide-in-from-top-2"
                  style={{
                    background: 'rgba(9, 13, 30, 0.95)',
                    backdropFilter: 'blur(24px)',
                    borderColor: 'rgba(6, 182, 212, 0.3)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(6, 182, 212, 0.15)',
                  }}
                >
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-white/[0.08] mb-1">
                    Select Season
                  </div>
                  {seasons.map((season, idx) => {
                    const isSelected = selectedSeasonIndex === idx;
                    return (
                      <button
                        key={season.seasonName}
                        type="button"
                        onClick={() => {
                          setSelectedSeasonIndex(idx);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                          isSelected
                            ? 'text-cyan-300'
                            : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                        }`}
                        style={{
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(124, 58, 237, 0.2))'
                            : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span>{season.seasonName}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            ({season.episodes.length})
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-300"
              style={{
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              {currentSeason.seasonName}
            </div>
          )}
        </div>
      </div>

      {/* ── Compact & Perfectly Aligned Episodes List ── */}
      <div className="space-y-2.5">
        {currentSeason.episodes.map((ep) => (
          <EpisodeRowItem
            key={ep.slug}
            ep={ep}
            showTitle={showTitle}
            defaultBackdrop={defaultBackdrop}
          />
        ))}
      </div>
    </section>
  );
}
