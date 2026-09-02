'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Film,
  Tv,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Check,
  Folder,
} from 'lucide-react';
import TrailerModal from '@/components/TrailerModal';
import VideoPlayer from '@/components/VideoPlayer';
import ShareButton from '@/components/ShareButton';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { CustomSeason, CustomEpisode } from '@/lib/markdownTV';
import { useAuth } from '@/context/AuthContext';
import { getBaseUrl, getAbsoluteUrl } from '@/lib/urls';
import siteConfig from '@/config';

interface TVDetailHeaderActionsProps {
  activeEpisodeLabel?: string;
  activeEpisodeTitle?: string;
  hasVideo?: boolean;
  trailerKey?: string | null;
  homepage?: string | null;
  showTitle: string;
  showId?: string | number;
  posterPath?: string | null;
  rating?: number | string | null;
  releaseDate?: string | null;
}

export function TVDetailHeaderActions({
  trailerKey,
  showTitle,
  showId,
  posterPath,
  rating,
  releaseDate,
}: TVDetailHeaderActionsProps) {
  const [showTrailer, setShowTrailer] = useState(false);
  const { toggleWatchlist, isInWatchlist } = useAuth();

  const itemId = showId || showTitle;
  const isSaved = isInWatchlist(itemId);
  const numRating = rating !== undefined && rating !== null ? Number(rating) : undefined;

  const handleWatchlistClick = () => {
    toggleWatchlist({
      contentId: itemId,
      title: showTitle,
      posterPath: posterPath || null,
      type: 'tv',
      rating: numRating,
      releaseDate: releaseDate || undefined,
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {/* Watch Trailer */}
        {trailerKey && (
          <button
            onClick={() => setShowTrailer(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #7c3aed)',
              boxShadow: '0 0 18px rgba(236,72,153,0.35)',
            }}
          >
            <Film size={16} />
            <span>Watch Trailer</span>
          </button>
        )}

        {/* Bookmark / Watchlist */}
        <button
          onClick={handleWatchlistClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: isSaved ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.06)',
            border: isSaved
              ? '1px solid rgba(236,72,153,0.5)'
              : '1px solid rgba(255,255,255,0.1)',
            color: isSaved ? '#ec4899' : '#f1f5f9',
          }}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          <span>{isSaved ? 'Saved in Watchlist' : 'Add to Watchlist'}</span>
        </button>

        {/* Share Button */}
        <ShareButton title={showTitle} />
      </div>

      {showTrailer && trailerKey && (
        <TrailerModal
          videoKey={trailerKey}
          title={`${showTitle} - Trailer`}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </>
  );
}

interface TVDetailPlayerSectionProps {
  showTitle: string;
  seasons: CustomSeason[];
  hasSeasons: boolean;
  initialActiveEpisode: CustomEpisode | null;
  defaultBackdrop?: string;
}

export default function TVDetailClient({
  showTitle,
  seasons,
  hasSeasons,
  initialActiveEpisode,
  defaultBackdrop,
}: TVDetailPlayerSectionProps) {
  const { addToHistory } = useAuth();
  const router = useRouter();
  const [activeEpisode, setActiveEpisode] = useState<CustomEpisode | null>(initialActiveEpisode);

  const initialSeasonIndex = seasons.findIndex((s) =>
    s.episodes.some((e) => e.slug === activeEpisode?.slug)
  );
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState<number>(
    initialSeasonIndex >= 0 ? initialSeasonIndex : 0
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setActiveEpisode(initialActiveEpisode);
    if (initialActiveEpisode) {
      const seasonIdx = seasons.findIndex((s) =>
        s.episodes.some((e) => e.slug === initialActiveEpisode.slug)
      );
      if (seasonIdx >= 0) {
        setSelectedSeasonIndex(seasonIdx);
      }
    }
  }, [initialActiveEpisode, seasons]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastRecordedKeyRef = useRef<string>('');

  // Automatically record view to user history once per episode if logged in
  useEffect(() => {
    if (showTitle) {
      const epKey = `${showTitle}_${activeEpisode?.slug || 'main'}`;
      if (lastRecordedKeyRef.current !== epKey) {
        lastRecordedKeyRef.current = epKey;
        const epLabel = activeEpisode?.episodeLabel
          ? `${activeEpisode.episodeLabel} - ${activeEpisode.title || 'Episode'}`
          : activeEpisode?.title;
        addToHistory({
          contentId: showTitle,
          title: showTitle,
          episodeTitle: epLabel,
          posterPath: defaultBackdrop || null,
          type: 'tv',
        });
      }
    }
  }, [showTitle, activeEpisode?.slug, defaultBackdrop, addToHistory]);

  const allEpisodes = React.useMemo(() => {
    return seasons.flatMap((s) => s.episodes);
  }, [seasons]);

  const currentEpisodeIndex = allEpisodes.findIndex((e) => e.slug === activeEpisode?.slug);
  const prevEpisode = currentEpisodeIndex > 0 ? allEpisodes[currentEpisodeIndex - 1] : null;
  const nextEpisode =
    currentEpisodeIndex >= 0 && currentEpisodeIndex < allEpisodes.length - 1
      ? allEpisodes[currentEpisodeIndex + 1]
      : null;

  // Sync selected season when activeEpisode slug changes
  useEffect(() => {
    if (activeEpisode) {
      const idx = seasons.findIndex((s) =>
        s.episodes.some((e) => e.slug === activeEpisode.slug)
      );
      if (idx >= 0) {
        setSelectedSeasonIndex(idx);
      }
    }
  }, [activeEpisode?.slug, seasons]);

  // Sync with browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const matched = allEpisodes.find((ep) => ep.urlPath === currentPath);
        if (matched) {
          setActiveEpisode(matched);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [allEpisodes]);

  // Click outside to close dropdown
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

  const currentSeason = seasons[selectedSeasonIndex] || seasons[0];

  const handleSelectEpisode = (ep: CustomEpisode) => {
    setActiveEpisode(ep);
    if (ep.urlPath && typeof window !== 'undefined') {
      window.history.pushState({}, '', ep.urlPath);
      const credit = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
      const epText = ep.title?.toLowerCase().startsWith(ep.episodeLabel.toLowerCase())
        ? ep.title
        : `${ep.episodeLabel}: ${ep.title}`;
      document.title = `${showTitle} - ${epText}${credit}`;
    }
  };

  const handleSelectSeason = (idx: number) => {
    setSelectedSeasonIndex(idx);
    setDropdownOpen(false);
    const targetSeason = seasons[idx];
    if (targetSeason && targetSeason.episodes.length > 0) {
      handleSelectEpisode(targetSeason.episodes[0]);
    }
  };

  const scrollHorizontally = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const currentVideoTitle = activeEpisode
    ? `${showTitle} - ${activeEpisode.episodeLabel}: ${activeEpisode.title}${creditSuffix}`
    : `${showTitle}${creditSuffix}`;

  const siteUrl = getBaseUrl();
  const pageUrl = activeEpisode?.urlPath ? getAbsoluteUrl(activeEpisode.urlPath) : siteUrl;
  const embedUrl = activeEpisode?.urlPath ? getAbsoluteUrl(`/embed${activeEpisode.urlPath}`) : siteUrl;

  return (
    <div className="w-full">
      {/* ── 1. Top Video Player (Edge-to-edge / Full view) ── */}
      <div className="w-full bg-black mb-4">
        {activeEpisode?.videoUrl ? (
          <VideoPlayer
            key={activeEpisode.urlPath || activeEpisode.slug || activeEpisode.videoUrl}
            videoUrl={activeEpisode.videoUrl}
            title={currentVideoTitle}
            poster={activeEpisode.imageUrl || defaultBackdrop}
            subtitles={activeEpisode.subtitles}
            onNextEpisode={nextEpisode ? () => handleSelectEpisode(nextEpisode) : undefined}
            onPrevEpisode={prevEpisode ? () => handleSelectEpisode(prevEpisode) : undefined}
            nextEpisodeTitle={nextEpisode ? `${nextEpisode.episodeLabel}: ${nextEpisode.title}` : undefined}
            prevEpisodeTitle={prevEpisode ? `${prevEpisode.episodeLabel}: ${prevEpisode.title}` : undefined}
          />
        ) : (
          <div className="w-full aspect-video max-h-[72vh] flex items-center justify-center bg-black/90">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
              <div className="w-6 h-6 rounded-full bg-cyan-400/40" />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Open Episode Details & Actions ── */}
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 pt-2">
        {/* Episode Navigation Quick Bar (Prev / Next Episode Buttons) */}
        {allEpisodes.length > 1 && (
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.08]">
            {prevEpisode ? (
              <Link
                href={prevEpisode.urlPath || '#'}
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectEpisode(prevEpisode);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 text-slate-200 bg-white/5 hover:bg-white/10 hover:text-white active:scale-95 border border-white/10"
                title={`Episode Sebelumnya: ${prevEpisode.title}`}
              >
                <ChevronLeft size={15} />
                <span className="hidden xs:inline">Episode Sebelumnya</span>
                <span className="xs:hidden">Prev</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-50"
              >
                <ChevronLeft size={15} />
                <span className="hidden xs:inline">Episode Sebelumnya</span>
                <span className="xs:hidden">Prev</span>
              </button>
            )}

            <div className="text-center">
              <span className="text-xs font-bold text-cyan-300">
                {activeEpisode?.episodeLabel || 'Episode'}
              </span>
              <span className="text-[11px] text-slate-400 ml-1.5">
                ({currentEpisodeIndex + 1} dari {allEpisodes.length})
              </span>
            </div>

            {nextEpisode ? (
              <Link
                href={nextEpisode.urlPath || '#'}
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectEpisode(nextEpisode);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-md text-white bg-gradient-to-r from-cyan-500 to-purple-600 hover:scale-105 active:scale-95 shadow-cyan-500/25"
                title={`Episode Berikutnya: ${nextEpisode.title}`}
              >
                <span className="hidden xs:inline">Episode Berikutnya</span>
                <span className="xs:hidden">Next</span>
                <ChevronRight size={15} />
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-50"
              >
                <span className="hidden xs:inline">Episode Berikutnya</span>
                <span className="xs:hidden">Next</span>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}

        {/* Episode Title */}
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black leading-tight mb-2 tracking-tight text-white">
          {activeEpisode
            ? activeEpisode.title?.toLowerCase().startsWith(activeEpisode.episodeLabel.toLowerCase())
              ? activeEpisode.title
              : `${activeEpisode.episodeLabel}: ${activeEpisode.title}`
            : showTitle}
        </h1>

        {/* Episode Metadata Badges Row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider"
            style={{
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: '#06b6d4',
            }}
          >
            HD
          </span>
          {Boolean(activeEpisode?.rating && Number(activeEpisode.rating) > 0) && (
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              ★ {activeEpisode.rating}
            </span>
          )}
          {activeEpisode?.duration && (
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400">
              <Clock size={14} />
              {activeEpisode.duration}
            </div>
          )}
          <span className="text-xs text-slate-500 font-medium">
            {showTitle}
          </span>
        </div>

        {/* Episode Overview Snippet */}
        {activeEpisode?.overview && (
          <p className="text-xs sm:text-sm sm:leading-relaxed leading-normal mb-5 max-w-4xl text-slate-300">
            {activeEpisode.overview}
          </p>
        )}

        {/* Dedicated Action Buttons (Watchlist & Share) */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setBookmarked(!bookmarked)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: bookmarked ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.06)',
              border: bookmarked
                ? '1px solid rgba(236,72,153,0.5)'
                : '1px solid rgba(255,255,255,0.1)',
              color: bookmarked ? '#ec4899' : '#f1f5f9',
            }}
          >
            <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
            <span>{bookmarked ? 'Saved in Watchlist' : 'Add to Watchlist'}</span>
          </button>

          <ShareButton title={`${showTitle} - ${activeEpisode?.episodeLabel || 'Episode'}`} />
        </div>

        {/* ── 3. Bilibili.tv-Style Pill Badges Episode Selector (Clean Outline Active Hover) ── */}
        {seasons.length > 0 && (
          <div className="pt-4 border-t border-white/[0.08]">
            {/* Header: Title & Season Dropdown */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Folder size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Pilih Episode ({hasSeasons ? currentSeason.seasonName : 'Season 1'})
                </h3>
              </div>

              {/* Season Selector Dropdown */}
              {hasSeasons && seasons.length > 1 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(124, 58, 237, 0.22))',
                      border: '1px solid rgba(6, 182, 212, 0.45)',
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

                  {/* Dropdown Menu Modal */}
                  {dropdownOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-48 p-1.5 rounded-2xl border z-30 shadow-2xl animate-in fade-in slide-in-from-top-2"
                      style={{
                        background: 'rgba(9, 13, 30, 0.95)',
                        backdropFilter: 'blur(24px)',
                        borderColor: 'rgba(6, 182, 212, 0.3)',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
                      }}
                    >
                      {seasons.map((season, idx) => {
                        const isSelected = selectedSeasonIndex === idx;
                        return (
                          <button
                            key={season.seasonName}
                            type="button"
                            onClick={() => handleSelectSeason(idx)}
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
                            <span>{season.seasonName}</span>
                            {isSelected && <Check size={14} className="text-cyan-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bilibili.tv Pill Badges (E1, E2, E3...) with Simple Outline Active & Safe Margins */}
            <div className="relative flex items-center">
              <button
                onClick={() => scrollHorizontally('left')}
                className="hidden sm:flex absolute left-0 z-10 w-7 h-10 items-center justify-center rounded-l-xl text-slate-300 hover:text-white transition-all"
                style={{
                  background: 'linear-gradient(90deg, rgba(5, 8, 22, 0.95) 0%, rgba(5, 8, 22, 0.6) 100%)',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div
                ref={scrollContainerRef}
                className="w-full flex items-center gap-2 overflow-x-auto py-2 px-1 sm:px-8 hide-scrollbar scroll-smooth"
              >
                {currentSeason.episodes.map((ep) => {
                  const isActive = activeEpisode?.slug === ep.slug;
                  const badgeText = `E${ep.episodeNumber}`;

                  return (
                    <Link
                      key={ep.slug}
                      href={ep.urlPath || `/tv/${showTitle}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectEpisode(ep);
                      }}
                      className={`flex-shrink-0 flex items-center justify-center rounded-xl font-bold transition-all duration-150 min-w-[50px] sm:min-w-[56px] h-9 sm:h-10 px-3 ${
                        isActive
                          ? 'text-cyan-400 font-extrabold'
                          : 'text-slate-400 hover:text-white hover:border-cyan-400/40'
                      }`}
                      style={{
                        background: isActive
                          ? 'rgba(6, 182, 212, 0.12)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isActive
                          ? '1.5px solid #06b6d4'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: isActive
                          ? '0 0 12px rgba(6, 182, 212, 0.3)'
                          : 'none',
                      }}
                      title={`${ep.episodeLabel}: ${ep.title}`}
                    >
                      <span className="text-xs sm:text-sm font-black">{badgeText}</span>
                    </Link>
                  );
                })}
              </div>

              <button
                onClick={() => scrollHorizontally('right')}
                className="hidden sm:flex absolute right-0 z-10 w-7 h-10 items-center justify-center rounded-r-xl text-slate-300 hover:text-white transition-all"
                style={{
                  background: 'linear-gradient(-90deg, rgba(5, 8, 22, 0.95) 0%, rgba(5, 8, 22, 0.6) 100%)',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Active Episode Markdown Content / Notes ── */}
      {activeEpisode?.contentHtml && (
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 mt-8">
          <MarkdownRenderer
            contentHtml={activeEpisode.contentHtml}
            title={`${showTitle} - ${activeEpisode.episodeLabel}: ${activeEpisode.title}`}
          />
        </div>
      )}
    </div>
  );
}
