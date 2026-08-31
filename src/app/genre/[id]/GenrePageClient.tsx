'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Globe, Film, Tv, MessageSquarePlus } from 'lucide-react';
import { Movie, TVShow, Genre } from '@/types/tmdb';
import MovieCard from '@/components/MovieCard';
import GenreFilter from '@/components/GenreFilter';

interface GenrePageClientProps {
  genre: Genre;
  initialGenreId: number;
  allLocalItems: (Movie | TVShow)[];
  initialPage?: number;
  initialSort?: string;
  initialLanguage?: 'all' | 'en' | 'id';
  allGenres: Genre[];
  type?: 'movie' | 'tv';
}

const ITEMS_PER_PAGE = 20;

const MOVIE_SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'release_date.asc', label: 'Oldest First' },
];

const TV_SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'first_air_date.desc', label: 'Newest First' },
  { value: 'first_air_date.asc', label: 'Oldest First' },
];

export default function GenrePageClient({
  genre,
  initialGenreId,
  allLocalItems,
  initialPage = 1,
  initialSort = 'popularity.desc',
  initialLanguage = 'all',
  allGenres,
  type = 'movie',
}: GenrePageClientProps) {
  const router = useRouter();
  const isTV = type === 'tv';
  const sortOptions = isTV ? TV_SORT_OPTIONS : MOVIE_SORT_OPTIONS;

  const [activeGenreId, setActiveGenreId] = useState<number | null>(initialGenreId);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'en' | 'id'>(initialLanguage);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(initialPage);
  const [sortOpen, setSortOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const LANGUAGE_OPTIONS: { value: 'all' | 'en' | 'id'; label: string; shortLabel: string }[] = [
    { value: 'all', label: 'Semua Bahasa', shortLabel: 'All' },
    { value: 'id', label: 'Bahasa Indonesia (ID)', shortLabel: 'ID' },
    { value: 'en', label: 'English (EN)', shortLabel: 'EN' },
  ];

  // Active genre metadata
  const currentGenre = useMemo(() => {
    if (!activeGenreId) {
      return { id: 0, name: 'All' };
    }
    return allGenres.find((g) => g.id === activeGenreId) || genre;
  }, [allGenres, activeGenreId, genre]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter & Sort local items strictly by genre and selected language
  const filteredAndSortedItems = useMemo(() => {
    // 1. Filter by Active Genre ID (if null, show all local items)
    let list = activeGenreId
      ? allLocalItems.filter(
          (item: any) => Array.isArray(item.genre_ids) && item.genre_ids.includes(activeGenreId)
        )
      : [...allLocalItems];

    // 2. Language Filter (All (default), EN, ID)
    if (languageFilter === 'en') {
      list = list.filter((item: any) => (item.language || 'ID').toUpperCase() === 'EN');
    } else if (languageFilter === 'id') {
      list = list.filter((item: any) => (item.language || 'ID').toUpperCase() === 'ID');
    }

    // 3. Sort
    if (sort === 'vote_average.desc') {
      list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    } else if (sort === 'release_date.desc' || sort === 'first_air_date.desc') {
      list.sort((a, b) => {
        const dateA = (a as any).release_date || (a as any).first_air_date || '';
        const dateB = (b as any).release_date || (b as any).first_air_date || '';
        return dateB.localeCompare(dateA);
      });
    } else if (sort === 'release_date.asc' || sort === 'first_air_date.asc') {
      list.sort((a, b) => {
        const dateA = (a as any).release_date || (a as any).first_air_date || '';
        const dateB = (b as any).release_date || (b as any).first_air_date || '';
        return dateA.localeCompare(dateB);
      });
    } else {
      // Default: weight ascending first, then popularity
      list.sort((a: any, b: any) => {
        const wA = a.weight !== undefined && a.weight !== null ? Number(a.weight) : 999999;
        const wB = b.weight !== undefined && b.weight !== null ? Number(b.weight) : 999999;
        if (wA !== wB) return wA - wB;
        return (b.popularity || 0) - (a.popularity || 0);
      });
    }

    return list;
  }, [allLocalItems, activeGenreId, languageFilter, sort]);

  const totalResults = filteredAndSortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));

  // Current page items
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedItems, page]);

  // Helper to build URL query
  const updateUrl = (newGenreId: number | null, newLang: string, newSort: string) => {
    const query = new URLSearchParams();
    if (isTV) query.set('type', 'tv');
    if (newSort !== 'popularity.desc') query.set('sort', newSort);
    if (newLang !== 'all') query.set('lang', newLang);
    const queryString = query.toString();
    const targetUrl = newGenreId
      ? `/genre/${newGenreId}${queryString ? `?${queryString}` : ''}`
      : `/genre/all${queryString ? `?${queryString}` : ''}`;

    router.push(targetUrl);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Instant client-side genre switching
  const handleGenreSelect = (newGenreId: number) => {
    setActiveGenreId(newGenreId);
    setPage(1);
    updateUrl(newGenreId, languageFilter, sort);
  };

  const handleAllSelect = () => {
    setActiveGenreId(null);
    setPage(1);
    updateUrl(null, languageFilter, sort);
  };

  const handleLanguageChange = (newLang: 'all' | 'en' | 'id') => {
    setLanguageFilter(newLang);
    setLangOpen(false);
    setPage(1);
    updateUrl(activeGenreId, newLang, sort);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    setSortOpen(false);
    updateUrl(activeGenreId, languageFilter, newSort);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSortLabel = sortOptions.find((o) => o.value === sort)?.label || 'Sort';
  const currentLangObj = LANGUAGE_OPTIONS.find((l) => l.value === languageFilter) || LANGUAGE_OPTIONS[0];
  const currentLangLabel = currentLangObj.label;
  const currentLangShortLabel = currentLangObj.shortLabel;

  // Helper to build page numbers array with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-4 sm:pb-6" style={{ background: '#050816' }}>
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
        
        {/* Page Header: Title on Left, Language & Sort Controls on Right */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black truncate sm:whitespace-normal mb-1">
                <span
                  style={{
                    background: isTV
                      ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                      : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {isTV ? 'TV Series' : 'Movies'} — {currentGenre.name}
                </span>
              </h1>
              <p className="text-xs sm:text-sm font-medium" style={{ color: '#94a3b8' }}>
                Jelajahi <span className={isTV ? 'text-pink-400 font-bold' : 'text-cyan-400 font-bold'}>{totalResults.toLocaleString()}</span> {isTV ? 'series' : 'movie'} untuk ditonton
              </p>
            </div>

            {/* Right: Language Filter & Sort Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Language Dropdown */}
              <div className="relative flex-shrink-0" ref={langRef}>
                <button
                  type="button"
                  onClick={() => {
                    setLangOpen(!langOpen);
                    setSortOpen(false);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                  }}
                >
                  <Globe size={13} className={`sm:w-[15px] sm:h-[15px] flex-shrink-0 ${isTV ? 'text-pink-400' : 'text-cyan-400'}`} />
                  <span className="hidden xs:inline whitespace-nowrap">{currentLangLabel}</span>
                  <span className="inline xs:hidden whitespace-nowrap font-bold text-slate-200">{currentLangShortLabel}</span>
                  <ChevronRight
                    size={12}
                    className="transition-transform duration-200 flex-shrink-0 text-slate-400"
                    style={{ transform: langOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {langOpen && (
                  <div
                    className="absolute left-0 sm:left-auto right-auto sm:right-0 top-full mt-2 w-48 sm:w-52 rounded-xl overflow-hidden z-50 shadow-2xl backdrop-blur-xl"
                    style={{
                      background: '#0B1020',
                      border: isTV
                        ? '1px solid rgba(236,72,153,0.35)'
                        : '1px solid rgba(6,182,212,0.35)',
                      boxShadow: isTV
                        ? '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(236,72,153,0.15)'
                        : '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(6,182,212,0.15)',
                    }}
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleLanguageChange(option.value)}
                        className={`w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition-colors duration-150 flex items-center justify-between ${
                          isTV ? 'hover:bg-white/10 active:bg-pink-500/20' : 'hover:bg-white/10 active:bg-cyan-500/20'
                        }`}
                        style={{
                          color: languageFilter === option.value ? (isTV ? '#ec4899' : '#06b6d4') : '#cbd5e1',
                          fontWeight: languageFilter === option.value ? 700 : 500,
                          background:
                            languageFilter === option.value
                              ? isTV
                                ? 'rgba(236,72,153,0.08)'
                                : 'rgba(6,182,212,0.08)'
                              : 'transparent',
                        }}
                      >
                        <span>{option.label}</span>
                        {languageFilter === option.value && (
                          <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${isTV ? 'bg-pink-400 shadow-pink-400' : 'bg-cyan-400 shadow-cyan-400'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative flex-shrink-0" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSortOpen(!sortOpen);
                    setLangOpen(false);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                  }}
                >
                  <SlidersHorizontal size={13} className={`sm:w-[15px] sm:h-[15px] flex-shrink-0 ${isTV ? 'text-pink-400' : 'text-cyan-400'}`} />
                  <span className="whitespace-nowrap">{currentSortLabel}</span>
                  <ChevronRight
                    size={12}
                    className="transition-transform duration-200 flex-shrink-0 text-slate-400"
                    style={{ transform: sortOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {sortOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-44 sm:w-48 rounded-xl overflow-hidden z-50 shadow-2xl backdrop-blur-xl"
                    style={{
                      background: '#0B1020',
                      border: isTV
                        ? '1px solid rgba(236,72,153,0.35)'
                        : '1px solid rgba(6,182,212,0.35)',
                      boxShadow: isTV
                        ? '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(236,72,153,0.15)'
                        : '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(6,182,212,0.15)',
                    }}
                  >
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSortChange(option.value)}
                        className={`w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition-colors duration-150 flex items-center justify-between ${
                          isTV ? 'hover:bg-white/10 active:bg-pink-500/20' : 'hover:bg-white/10 active:bg-cyan-500/20'
                        }`}
                        style={{
                          color:
                            sort === option.value
                              ? isTV
                                ? '#ec4899'
                                : '#06b6d4'
                              : '#cbd5e1',
                          fontWeight: sort === option.value ? 700 : 500,
                          background:
                            sort === option.value
                              ? isTV
                                ? 'rgba(236,72,153,0.08)'
                                : 'rgba(6,182,212,0.08)'
                              : 'transparent',
                        }}
                      >
                        <span>{option.label}</span>
                        {sort === option.value && (
                          <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${isTV ? 'bg-pink-400 shadow-pink-400' : 'bg-cyan-400 shadow-cyan-400'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Genre filter list with instant callback */}
        {allGenres.length > 0 && (
          <div className="mb-8">
            <GenreFilter
              genres={allGenres}
              activeGenreId={activeGenreId}
              type={isTV ? 'tv' : 'movie'}
              allHref={isTV ? '/tv/browse' : '/movie'}
              hideTitle={true}
              onGenreSelect={handleGenreSelect}
              onAllSelect={handleAllSelect}
            />
          </div>
        )}

        {/* Items grid */}
        {paginatedItems.length > 0 ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {paginatedItems.map((item: any, i) => (
              <MovieCard key={item.id || item.customSlug || i} item={item} type={isTV ? 'tv' : 'movie'} priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#090e1f] rounded-2xl border border-white/5 max-w-2xl mx-auto my-8">
            <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 shadow-lg ${
              isTV ? 'text-pink-400 shadow-pink-500/10' : 'text-cyan-400 shadow-cyan-500/10'
            }`}>
              {isTV ? <Tv size={28} /> : <Film size={28} />}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-2">
              Belum Ada {isTV ? 'TV Series' : 'Film'} {activeGenreId && currentGenre.name !== 'All' ? `Genre ${currentGenre.name}` : ''}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-md">
              {activeGenreId && currentGenre.name !== 'All'
                ? `${isTV ? 'Serial TV' : 'Film'} dengan genre "${currentGenre.name}" belum tersedia di katalog kami. Anda dapat me-request judul favorit Anda untuk ditambahkan segera.`
                : `Tidak ada ${isTV ? 'serial TV' : 'film'} yang sesuai dengan filter yang dipilih.`}
            </p>
            <div className="flex items-center justify-center">
              <Link
                href="/request"
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-white shadow-lg active:scale-95 ${
                  isTV
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 shadow-pink-500/20'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/20'
                }`}
              >
                <MessageSquarePlus size={15} />
                <span>Request</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-8 sm:mt-10 mb-2">
            {/* Prev button */}
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="p-2 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
              }}
            >
              <ChevronLeft size={18} />
            </button>

            {/* Dynamic Page numbers with ellipsis */}
            {getPageNumbers().map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-8 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-500 select-none"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = item as number;
              const isCurrent = page === pageNum;

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105"
                  style={
                    isCurrent
                      ? {
                          background: isTV
                            ? 'linear-gradient(135deg, #ec4899, #7c3aed)'
                            : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                          color: 'white',
                          boxShadow: isTV
                            ? '0 0 15px rgba(236,72,153,0.4)'
                            : '0 0 15px rgba(6,182,212,0.3)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#94a3b8',
                        }
                  }
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next button */}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="p-2 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
