'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Genre } from '@/types/tmdb';
import siteConfig from '@/config';

interface GenreFilterProps {
  genres: Genre[];
  activeGenreId?: number | null;
  title?: string;
  type?: 'movie' | 'tv';
  allHref?: string;
  hideTitle?: boolean;
  onGenreSelect?: (genreId: number) => void;
  onAllSelect?: () => void;
}

export default function GenreFilter({
  genres,
  activeGenreId,
  title,
  type = 'movie',
  allHref,
  hideTitle = false,
  onGenreSelect,
  onAllSelect,
}: GenreFilterProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [optimisticActiveId, setOptimisticActiveId] = useState<number | null | undefined>(activeGenreId);

  const isTV = type === 'tv';

  // Sync optimistic active id when activeGenreId prop updates
  useEffect(() => {
    setOptimisticActiveId(activeGenreId);
  }, [activeGenreId]);

  const checkScrollability = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScrollability();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollability, { passive: true });
      window.addEventListener('resize', checkScrollability);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [genres]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = Math.min(el.clientWidth * 0.75, 400);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const getGenreHref = (genreId: number) => {
    return isTV ? `/genre/${genreId}?type=tv` : `/genre/${genreId}`;
  };

  const getAllHref = () => {
    if (allHref) return allHref;
    return isTV ? '/genre/all?type=tv' : '/genre/all';
  };

  const handleGenreClick = (e: React.MouseEvent, genreId: number) => {
    setOptimisticActiveId(genreId);
    if (onGenreSelect) {
      e.preventDefault();
      onGenreSelect(genreId);
    }
  };

  const handleAllClick = (e: React.MouseEvent) => {
    setOptimisticActiveId(null);
    if (onAllSelect) {
      e.preventDefault();
      onAllSelect();
    }
  };

  const activeGradient = isTV
    ? 'linear-gradient(135deg, #ec4899, #7c3aed)'
    : 'linear-gradient(135deg, #06b6d4, #7c3aed)';

  return (
    <div className="relative group/genres w-full max-w-full overflow-hidden">
      {/* Header with Title & Desktop Navigation Arrows (if not hidden) */}
      {!hideTitle && (
        <div className="flex items-center justify-between mb-2.5 sm:mb-3.5">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
            {title || (isTV ? (siteConfig.tvSections?.browseGenres || 'Browse Series by Genre') : (siteConfig.homepageSections?.browseGenres || 'Browse by Genre'))}
          </h2>

          {/* Scroll Arrows for Desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              title="Scroll Left"
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-150 ${
                canScrollLeft
                  ? 'bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 hover:text-white border border-white/10 hover:border-white/20 cursor-pointer'
                  : 'bg-white/[0.02] text-slate-600 border border-transparent cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              title="Scroll Right"
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-150 ${
                canScrollRight
                  ? 'bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 hover:text-white border border-white/10 hover:border-white/20 cursor-pointer'
                  : 'bg-white/[0.02] text-slate-600 border border-transparent cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Genre Pills Scroll Container */}
      <div className="relative w-full max-w-full">
        {/* Left Fade Gradient */}
        {canScrollLeft && (
          <div
            className="hidden sm:block absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-200"
            style={{
              background: 'linear-gradient(to right, #050816, transparent)',
            }}
          />
        )}

        <div
          ref={scrollRef}
          style={{ overscrollBehaviorX: 'contain' }}
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto hide-scrollbar scroll-smooth py-1"
        >
          {/* "All" button */}
          <Link
            href={getAllHref()}
            prefetch={true}
            onClick={handleAllClick}
            className={`flex-shrink-0 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-150 select-none ${
              !optimisticActiveId
                ? isTV
                  ? 'text-white shadow-md shadow-pink-500/20'
                  : 'text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20'
            }`}
            style={{
              background: !optimisticActiveId ? activeGradient : undefined,
            }}
          >
            All Genres
          </Link>

          {/* Genre list */}
          {genres.map((genre) => {
            const isActive = optimisticActiveId === genre.id;
            return (
              <Link
                key={genre.id}
                href={getGenreHref(genre.id)}
                prefetch={true}
                onClick={(e) => handleGenreClick(e, genre.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors duration-150 select-none ${
                  isActive
                    ? isTV
                      ? 'text-white font-semibold shadow-md shadow-pink-500/20'
                      : 'text-white font-semibold shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20'
                }`}
                style={{
                  background: isActive ? activeGradient : undefined,
                }}
              >
                {genre.name}
              </Link>
            );
          })}
        </div>

        {/* Right Fade Gradient */}
        {canScrollRight && (
          <div
            className="hidden sm:block absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-200"
            style={{
              background: 'linear-gradient(to left, #050816, transparent)',
            }}
          />
        )}
      </div>
    </div>
  );
}

