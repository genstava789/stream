'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Play,
  ChevronDown,
  Clock,
  Tv,
  Check,
  Sparkles,
  Film,
} from 'lucide-react';
import { CustomSeason, CustomEpisode } from '@/lib/markdownTV';

interface EpisodeSelectorProps {
  seasons: CustomSeason[];
  hasSeasons: boolean;
  activeEpisode: CustomEpisode | null;
  showTitle: string;
  defaultBackdrop?: string;
  onSelectEpisode?: (ep: CustomEpisode) => void;
}

function EpisodeThumbnail({ src, fallbackSrc, title }: { src: string; fallbackSrc?: string; title: string }) {
  const [currentSrc, setCurrentSrc] = useState<string>(src || fallbackSrc || '');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '');
    setHasError(false);
  }, [src, fallbackSrc]);

  if (hasError || !currentSrc || (!currentSrc.startsWith('http') && !currentSrc.startsWith('/'))) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500">
        <Film size={22} className="text-slate-600 mb-0.5" />
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Episode</span>
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={title}
      fill
      className="object-cover group-hover:scale-105 transition-transform duration-500"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc && (fallbackSrc.startsWith('http') || fallbackSrc.startsWith('/'))) {
          setCurrentSrc(fallbackSrc);
        } else {
          setHasError(true);
        }
      }}
    />
  );
}

export default function EpisodeSelector({
  seasons,
  hasSeasons,
  activeEpisode,
  showTitle,
  defaultBackdrop,
  onSelectEpisode,
}: EpisodeSelectorProps) {
  // Find initial selected season index based on activeEpisode
  const initialSeasonIndex = seasons.findIndex((s) =>
    s.episodes.some((e) => e.slug === activeEpisode?.slug)
  );
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState<number>(
    initialSeasonIndex >= 0 ? initialSeasonIndex : 0
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync selected season when activeEpisode changes
  useEffect(() => {
    if (activeEpisode) {
      const idx = seasons.findIndex((s) =>
        s.episodes.some((e) => e.slug === activeEpisode.slug)
      );
      if (idx >= 0 && idx !== selectedSeasonIndex) {
        setSelectedSeasonIndex(idx);
      }
    }
  }, [activeEpisode, seasons, selectedSeasonIndex]);

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

  const handleEpisodeClick = (ep: CustomEpisode) => {
    if (onSelectEpisode) {
      onSelectEpisode(ep);
    }
    // Update browser URL bar cleanly without triggering full-page RSC re-fetch
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', ep.urlPath);
    }
  };

  return (
    <section className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 mt-6">
      {/* ── Outer Container with Modern Glass Aesthetic ── */}
      <div
        className="rounded-3xl p-4 sm:p-6 transition-all duration-300"
        style={{
          background: 'rgba(8, 12, 28, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header Bar: Title & Season Dropdown */}
        <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(124, 58, 237, 0.2))',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)',
              }}
            >
              <Tv size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Episodes</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-400">
                  {currentSeason.episodes.length} eps
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {hasSeasons ? currentSeason.seasonName : 'Season 1'} • Select an episode to stream
              </p>
            </div>
          </div>

          {/* Season Selector (Dropdown Menu if multi-season, or pill badge if single season) */}
          <div className="relative" ref={dropdownRef}>
            {hasSeasons && seasons.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(124, 58, 237, 0.22))',
                    border: '1px solid rgba(6, 182, 212, 0.45)',
                    boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
                  }}
                >
                  <Sparkles size={13} className="text-cyan-400" />
                  <span>{currentSeason.seasonName}</span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${
                      dropdownOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu Modal */}
                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-48 sm:w-56 p-1.5 rounded-2xl border z-30 shadow-2xl animate-in fade-in slide-in-from-top-2"
                    style={{
                      background: 'rgba(9, 13, 30, 0.95)',
                      backdropFilter: 'blur(24px)',
                      borderColor: 'rgba(6, 182, 212, 0.3)',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(6, 182, 212, 0.15)',
                    }}
                  >
                    <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-white/[0.08] mb-1">
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

        {/* ── Modern Episode Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {currentSeason.episodes.map((ep) => {
            const isActive = activeEpisode?.slug === ep.slug;
            const epImage = ep.imageUrl || defaultBackdrop || '/placeholder-poster.jpg';

            return (
              <div
                key={ep.slug}
                onClick={() => handleEpisodeClick(ep)}
                className={`group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isActive ? 'scale-[1.02]' : 'hover:scale-[1.015]'
                }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(180deg, rgba(6, 182, 212, 0.14) 0%, rgba(124, 58, 237, 0.18) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isActive
                    ? '1.5px solid rgba(6, 182, 212, 0.7)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isActive
                    ? '0 0 25px rgba(6, 182, 212, 0.25), 0 10px 30px rgba(0, 0, 0, 0.5)'
                    : '0 4px 20px rgba(0, 0, 0, 0.25)',
                }}
              >
                {/* 16:9 Thumbnail Container */}
                <div className="relative w-full aspect-video overflow-hidden bg-black/60">
                  <EpisodeThumbnail src={ep.imageUrl || ''} fallbackSrc={defaultBackdrop} title={ep.title} />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Play Button Overlay on Hover / Active */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-110"
                      style={{
                        background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                        boxShadow: '0 0 20px rgba(6, 182, 212, 0.6)',
                      }}
                    >
                      <Play size={16} fill="white" className="text-white ml-0.5" />
                    </div>
                  </div>

                  {/* Episode Badge (Top Left) */}
                  <div className="absolute top-2.5 left-2.5">
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md"
                      style={{
                        background: isActive ? 'rgba(6, 182, 212, 0.85)' : 'rgba(0, 0, 0, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'white',
                      }}
                    >
                      {ep.episodeLabel}
                    </span>
                  </div>

                  {/* Duration Pill (Bottom Right) */}
                  {ep.duration && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-bold text-slate-300">
                      <Clock size={10} className="text-cyan-400" />
                      <span>{ep.duration}</span>
                    </div>
                  )}

                  {/* Now Playing Active Indicator (Bottom Left) */}
                  {isActive && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-400/60 backdrop-blur-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        Playing
                      </span>
                    </div>
                  )}
                </div>

                {/* Episode Details */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <h3
                      className="font-bold text-xs sm:text-sm line-clamp-1 group-hover:text-cyan-300 transition-colors"
                      style={{ color: isActive ? '#38bdf8' : '#f1f5f9' }}
                    >
                      {ep.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed font-normal">
                      {ep.overview || `${showTitle} episode streaming HD.`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
