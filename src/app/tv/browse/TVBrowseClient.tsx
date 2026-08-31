'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Tv, Globe, MessageSquarePlus } from 'lucide-react';
import { TVShow, Genre } from '@/types/tmdb';
import { discoverTVShows, getTVGenres, getGenres, prefetchImages } from '@/lib/tmdb';
import MovieCard, { MovieCardSkeleton } from '@/components/MovieCard';
import GenreFilter from '@/components/GenreFilter';

interface TVBrowseClientProps {
  initialShows?: TVShow[];
  totalPages?: number;
  totalResults?: number;
  initialPage?: number;
  initialSort?: string;
  initialGenreId?: number;
  allGenres?: Genre[];
}

const tvClientCache = new Map<string, any>();

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'first_air_date.desc', label: 'Newest First' },
  { value: 'first_air_date.asc', label: 'Oldest First' },
];

function sortLocalTVShows(items: TVShow[], sortOption: string): TVShow[] {
  const copy = [...items];
  if (sortOption === 'vote_average.desc') {
    return copy.sort((a, b) => {
      const diff = (b.vote_average || 0) - (a.vote_average || 0);
      if (diff !== 0) return diff;
      return (a.name || (a as any).title || '').localeCompare(b.name || (b as any).title || '');
    });
  }
  if (sortOption === 'first_air_date.desc' || sortOption === 'newest') {
    return copy.sort((a: any, b: any) => {
      const timeB = Number(b.updatedAt) || Number(b.createdAt) || 0;
      const timeA = Number(a.updatedAt) || Number(a.createdAt) || 0;
      if (timeB > 0 && timeA > 0 && timeB !== timeA) return timeB - timeA;
      if (timeB > 0 && timeA === 0) return -1;
      if (timeA > 0 && timeB === 0) return 1;

      const relB = new Date(b.first_air_date || 0).getTime();
      const relA = new Date(a.first_air_date || 0).getTime();
      if (relB !== relA) return relB - relA;

      return (a.name || a.title || a.customSlug || '').localeCompare(b.name || b.title || b.customSlug || '');
    });
  }
  if (sortOption === 'first_air_date.asc') {
    return copy.sort((a: any, b: any) => {
      const relA = new Date(a.first_air_date || '2099-01-01').getTime();
      const relB = new Date(b.first_air_date || '2099-01-01').getTime();
      if (relA !== relB) return relA - relB;
      return (a.name || a.title || a.customSlug || '').localeCompare(b.name || b.title || b.customSlug || '');
    });
  }
  if (sortOption === 'popularity.desc') {
    return copy.sort((a: any, b: any) => {
      if ((b.weight || 0) !== (a.weight || 0)) return (b.weight || 0) - (a.weight || 0);
      const diff = (b.popularity || 100) - (a.popularity || 100);
      if (diff !== 0) return diff;
      return (a.name || (a as any).title || '').localeCompare(b.name || (b as any).title || '');
    });
  }
  return copy;
}

type LanguageFilterType = 'all' | 'id' | 'en';

const LANGUAGE_OPTIONS: { value: LanguageFilterType; label: string; shortLabel: string }[] = [
  { value: 'all', label: 'Semua Bahasa', shortLabel: 'All' },
  { value: 'id', label: 'Bahasa Indonesia (ID)', shortLabel: 'ID' },
  { value: 'en', label: 'English (EN)', shortLabel: 'EN' },
];

function filterByLanguage(items: TVShow[], lang: string): TVShow[] {
  if (lang === 'all') return items;
  const target = lang.toUpperCase();
  return items.filter((s: any) => (s.language || 'ID').toUpperCase() === target);
}

export default function TVBrowseClient({
  initialShows = [],
  totalPages: initialTotalPages = 1,
  totalResults: initialTotalResults = 0,
  initialPage = 1,
  initialSort = 'popularity.desc',
  initialGenreId,
  allGenres: propGenres = [],
}: TVBrowseClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [genres, setGenres] = useState<Genre[]>(propGenres);
  const [languageFilter, setLanguageFilter] = useState<LanguageFilterType>('all');
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(initialSort);
  const [genreId, setGenreId] = useState<number | undefined>(initialGenreId);
  const [shows, setShows] = useState<TVShow[]>(() => {
    if (initialShows.length === 0) return [];
    const filtered = filterByLanguage(initialShows, 'all');
    return sortLocalTVShows(filtered, initialSort);
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(initialShows.length === 0);
  const [sortOpen, setSortOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  // Fetch genres if not provided
  useEffect(() => {
    if (genres.length === 0) {
      getTVGenres()
        .catch(() => getGenres())
        .then((g) => setGenres(g))
        .catch(() => {});
    }
  }, [genres.length]);

  // Close dropdowns when clicking outside
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

  // Sync state when searchParams change (e.g. browser back/forward)
  useEffect(() => {
    const p = Number(searchParams.get('page')) || 1;
    const s = searchParams.get('sort') || 'popularity.desc';
    const g = searchParams.get('genre') ? Number(searchParams.get('genre')) : undefined;
    const rawL = (searchParams.get('lang') || 'all').toLowerCase();
    const validLangs: LanguageFilterType[] = ['all', 'id', 'en'];
    const l: LanguageFilterType = validLangs.includes(rawL as any) ? (rawL as LanguageFilterType) : 'all';

    setPage(p);
    setSort(s);
    setGenreId(g);
    setLanguageFilter(l);
  }, [searchParams]);

  // Fetch or filter TV shows when filter/sort/page/language change
  useEffect(() => {
    // 1. If local TV shows exist:
    if (initialShows.length > 0) {
      let filtered = filterByLanguage(initialShows, languageFilter);
      if (genreId) {
        filtered = filtered.filter((s) => s.genre_ids && s.genre_ids.includes(genreId));
      }
      const sorted = sortLocalTVShows(filtered, sort);
      const start = (page - 1) * 20;
      setShows(sorted.slice(start, start + 20));
      setTotalPages(Math.max(1, Math.ceil(sorted.length / 20)));
      setTotalResults(sorted.length);
      setLoading(false);
      return;
    }

    const cacheKey = `${page}_${sort}_${genreId || 'all'}`;
    if (tvClientCache.has(cacheKey)) {
      const cached = tvClientCache.get(cacheKey);
      setShows(cached.results);
      setTotalPages(Math.min(cached.total_pages, 500));
      setTotalResults(cached.total_results);
      setLoading(false);
      return;
    }

    setLoading(true);
    discoverTVShows(page, sort, genreId)
      .then((data) => {
        tvClientCache.set(cacheKey, data);
        setShows(data.results);
        setTotalPages(Math.min(data.total_pages, 500));
        setTotalResults(data.total_results);

        prefetchImages(data.results);
      })
      .catch((err) => {
        console.error('Error fetching TV shows:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, sort, genreId, languageFilter, initialShows]);

  const updateUrl = (newPage: number, newSort: string, newGenreId?: number, newLang: string = languageFilter) => {
    const params = new URLSearchParams();
    if (newPage > 1) params.set('page', newPage.toString());
    if (newSort && newSort !== 'popularity.desc') params.set('sort', newSort);
    if (newGenreId) params.set('genre', newGenreId.toString());
    if (newLang && newLang !== 'all') params.set('lang', newLang);

    const qs = params.toString();
    router.push(`/tv/browse${qs ? `?${qs}` : ''}`);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLanguageChange = (newLang: LanguageFilterType) => {
    setLanguageFilter(newLang);
    setLangOpen(false);
    setPage(1);
    updateUrl(1, sort, genreId, newLang);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    setSortOpen(false);
    updateUrl(1, newSort, genreId, languageFilter);
  };

  const handleGenreSelect = (gId: number) => {
    if (genreId === gId) return;
    setGenreId(gId);
    setPage(1);
    updateUrl(1, sort, gId, languageFilter);
  };

  const handleAllSelect = () => {
    if (!genreId) return;
    setGenreId(undefined);
    setPage(1);
    updateUrl(1, sort, undefined, languageFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    updateUrl(newPage, sort, genreId, languageFilter);
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';
  const currentLangObj = LANGUAGE_OPTIONS.find((l) => l.value === languageFilter) || LANGUAGE_OPTIONS[0];
  const currentLangLabel = currentLangObj.label;
  const currentLangShortLabel = currentLangObj.shortLabel;
  const selectedGenreName = genres.find((g) => g.id === genreId)?.name;

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
        
        {/* ── Page Header: Title on Left, Language & Sort Controls on Right ── */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black truncate sm:whitespace-normal mb-1">
                <span
                  style={{
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Browse TV Series
                </span>
              </h1>
              <p className="text-xs sm:text-sm font-medium" style={{ color: '#94a3b8' }}>
                Jelajahi <span className="text-pink-400 font-bold">{totalResults > 0 ? totalResults.toLocaleString() : '0'}</span> series untuk ditonton
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
                  <Globe size={13} className="sm:w-[15px] sm:h-[15px] text-pink-400 flex-shrink-0" />
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
                      border: '1px solid rgba(236,72,153,0.35)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(236,72,153,0.15)',
                    }}
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleLanguageChange(option.value)}
                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition-colors duration-150 hover:bg-white/10 active:bg-pink-500/20 flex items-center justify-between"
                        style={{
                          color: languageFilter === option.value ? '#ec4899' : '#cbd5e1',
                          fontWeight: languageFilter === option.value ? 700 : 500,
                          background: languageFilter === option.value ? 'rgba(236,72,153,0.08)' : 'transparent',
                        }}
                      >
                        <span>{option.label}</span>
                        {languageFilter === option.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_#ec4899]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Dropdown */}
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
                  <SlidersHorizontal size={13} className="sm:w-[15px] sm:h-[15px] text-pink-400 flex-shrink-0" />
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
                      border: '1px solid rgba(236,72,153,0.35)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(236,72,153,0.15)',
                    }}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSortChange(option.value)}
                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition-colors duration-150 hover:bg-white/10 active:bg-pink-500/20 flex items-center justify-between"
                        style={{
                          color: sort === option.value ? '#ec4899' : '#cbd5e1',
                          fontWeight: sort === option.value ? 700 : 500,
                          background: sort === option.value ? 'rgba(236,72,153,0.08)' : 'transparent',
                        }}
                      >
                        <span>{option.label}</span>
                        {sort === option.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_#ec4899]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Browse by Genre Filter ── */}
        {genres.length > 0 && (
          <div className="mb-8">
            <GenreFilter
              genres={genres}
              activeGenreId={genreId}
              type="tv"
              allHref="/tv/browse"
              hideTitle={true}
              onGenreSelect={handleGenreSelect}
              onAllSelect={handleAllSelect}
            />
          </div>
        )}

        {/* ── TV Shows Grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {Array.from({ length: 18 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))}
          </div>
        ) : shows.length > 0 ? (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {shows.map((show, i) => (
              <MovieCard key={show.id} item={show} type="tv" priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#090e1f] rounded-2xl border border-white/5 max-w-2xl mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-pink-400 mb-4 shadow-lg shadow-pink-500/10">
              <Tv size={28} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-2">
              Belum Ada Series {selectedGenreName ? `Genre ${selectedGenreName}` : ''}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-md">
              {selectedGenreName
                ? `Serial TV dengan genre "${selectedGenreName}" belum tersedia di katalog kami. Anda dapat me-request serial TV favorit Anda untuk ditambahkan segera.`
                : `Tidak ada serial TV yang sesuai dengan filter yang dipilih.`}
            </p>
            <div className="flex items-center justify-center">
              <Link
                href="/request"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-95 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 text-white shadow-pink-500/20"
              >
                <MessageSquarePlus size={15} />
                <span>Request</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── Pagination with Large Page Window and Go-To-Top ── */}
        {totalPages > 1 && !loading && (
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
                          background: 'linear-gradient(135deg, #ec4899, #7c3aed)',
                          color: 'white',
                          boxShadow: '0 0 15px rgba(236,72,153,0.4)',
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
