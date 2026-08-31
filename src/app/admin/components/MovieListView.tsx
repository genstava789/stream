import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Film, Plus, ExternalLink, Edit2, Trash2, Star, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { MovieItem } from '../types';
import { getMovieUrl } from '@/lib/urls';

interface MovieListViewProps {
  movies: MovieItem[];
  totalMoviesCount: number;
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageLoading?: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (movie: MovieItem) => void;
  onDelete: (relativePath: string, title: string) => void;
  selectedPaths: string[];
  onToggleSelect: (path: string) => void;
  onSelectAll?: (paths: string[]) => void;
  onClearSelection?: () => void;
  canDelete?: boolean;
}

function MovieCardSkeleton() {
  return (
    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0c1224] border border-white/5 animate-pulse flex flex-col justify-between">
      <div>
        <div className="flex items-start gap-3 mb-2.5">
          <div className="w-16 sm:w-20 aspect-[2/3] min-h-[96px] sm:min-h-[120px] rounded-lg sm:rounded-xl bg-slate-800/80 flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="flex gap-1.5">
              <div className="h-4 w-16 bg-slate-800/90 rounded-md" />
              <div className="h-4 w-12 bg-slate-800/60 rounded-md" />
            </div>
            <div className="h-4 w-3/4 bg-slate-700/80 rounded" />
            <div className="h-3 w-1/3 bg-slate-800/70 rounded" />
            <div className="h-2.5 w-1/2 bg-slate-800/50 rounded" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 mt-1">
        <div className="h-3 w-20 bg-slate-800/60 rounded" />
        <div className="flex gap-1.5">
          <div className="h-7 w-7 bg-slate-800/60 rounded-lg" />
          <div className="h-7 w-7 bg-slate-800/60 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function SafeAdminImage({ src, alt, sizes }: { src: string | null | undefined; alt: string; sizes?: string }) {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
        <Film size={20} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes || '80px'}
      onError={() => setError(true)}
      className="object-cover"
    />
  );
}

export const MovieListView: React.FC<MovieListViewProps> = ({
  movies,
  totalMoviesCount,
  searchQuery,
  currentPage,
  totalPages,
  onPageChange,
  pageLoading,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  selectedPaths,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  canDelete = true,
}) => {
  if (pageLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MovieCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="py-16 text-center bg-[#090e1f] rounded-2xl border border-white/5 p-6">
        <Film size={36} className="mx-auto mb-3 text-slate-600" />
        <h3 className="text-sm font-bold text-white mb-1">Belum Ada Movie Ditemukan</h3>
        <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
          {searchQuery
            ? 'Tidak ada film yang cocok dengan kata kunci pencarian Anda.'
            : 'Mulai tambahkan movie baru dengan TMDB ID atau judul.'}
        </p>
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          <Plus size={14} />
          <span>Tambah Movie Baru</span>
        </button>
      </div>
    );
  }

  const allVisiblePaths = movies.map((m) => m.relativePath);
  const isAllCurrentSelected = allVisiblePaths.length > 0 && allVisiblePaths.every((p) => selectedPaths.includes(p));

  const handleToggleSelectAll = () => {
    if (isAllCurrentSelected) {
      if (onClearSelection) onClearSelection();
    } else {
      if (onSelectAll) onSelectAll(Array.from(new Set([...selectedPaths, ...allVisiblePaths])));
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Select All & Summary Header */}
      <div className="flex items-center justify-between px-1.5 py-1">
        {canDelete ? (
          <div
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <div
              className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                isAllCurrentSelected
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'bg-black/50 border border-white/30 hover:border-cyan-400 text-transparent'
              }`}
            >
              <Check size={11} strokeWidth={3} className={isAllCurrentSelected ? 'opacity-100' : 'opacity-0'} />
            </div>
            <span>Pilih Semua di Halaman Ini ({movies.length})</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-medium">
            Daftar Film Terdaftar ({movies.length})
          </span>
        )}
        <span className="text-xs text-slate-400">
          Total <span className="text-cyan-400 font-bold">{totalMoviesCount}</span> movies
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {movies.map((movie) => {
          const title = movie.displayTitle || movie.frontmatter.title || movie.slug;
          const tmdbId = movie.frontmatter.tmdb_id;
          const poster = movie.posterUrl || movie.frontmatter.image_url || movie.frontmatter.poster_path;
          const isFeatured = Boolean(movie.frontmatter.featured);
          const weight = movie.frontmatter.weight;
          const rating = movie.rating || movie.frontmatter.rating;
          const isSelected = selectedPaths.includes(movie.relativePath);

          return (
            <div
              key={movie.relativePath}
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0c1224] border transition-all flex flex-col justify-between shadow-sm relative group ${
                isSelected
                  ? 'border-cyan-400 bg-[#0d1733]'
                  : 'border-white/10 hover:border-cyan-500/40'
              }`}
            >
              <div>
                <div className="flex items-start gap-3 mb-2.5">
                  {/* Clean Selector Checkbox */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(movie.relativePath);
                      }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/40 ring-2 ring-cyan-400/40'
                          : 'bg-black/50 border border-white/20 hover:border-cyan-400 text-transparent'
                      }`}
                      title={isSelected ? 'Batalkan pilihan' : 'Pilih film ini'}
                    >
                      <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </button>
                  )}

                  {/* Poster Thumbnail */}
                  <div
                    onClick={() => {
                      if (canDelete) onToggleSelect(movie.relativePath);
                    }}
                    className={`relative w-16 sm:w-20 aspect-[2/3] min-h-[96px] sm:min-h-[120px] rounded-lg sm:rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-white/15 shadow-md ${
                      canDelete ? 'cursor-pointer' : ''
                    }`}
                  >
                    <SafeAdminImage src={poster} alt={title} sizes="(max-width: 640px) 64px, 80px" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        TMDB {tmdbId || 'N/A'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {String(movie.frontmatter.language || 'ID').toUpperCase()}
                      </span>
                      {weight !== undefined && weight !== null && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30" title="Prioritas Weight">
                          W: {weight}
                        </span>
                      )}
                      {Boolean(movie.frontmatter.trending) && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Trending
                        </span>
                      )}
                      {isFeatured && (
                        <span className="px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Star size={10} fill="currentColor" /> Featured
                        </span>
                      )}
                    </div>

                    <h3
                      className="font-extrabold text-white text-xs sm:text-sm leading-snug line-clamp-2 cursor-pointer hover:text-cyan-300 transition-colors"
                      title={title}
                      onClick={() => onOpenEdit(movie)}
                    >
                      {title}{' '}
                      {movie.year ? (
                        <span className="text-slate-400 font-normal text-xs">({movie.year})</span>
                      ) : (
                        ''
                      )}
                    </h3>

                    {rating ? (
                      <p className="text-[11px] sm:text-xs text-amber-400 font-black mt-1 flex items-center gap-1">
                        <Star size={11} fill="currentColor" /> {rating}
                      </p>
                    ) : null}

                    <p
                      className="text-[9.5px] sm:text-[10px] text-slate-500 font-mono truncate mt-1"
                      title={movie.relativePath}
                    >
                      {movie.relativePath}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-white/10 mt-1">
                <Link
                  href={getMovieUrl({
                    id: movie.frontmatter.tmdb_id,
                    tmdbId: movie.frontmatter.tmdb_id,
                    title: movie.displayTitle || movie.frontmatter.title,
                    year: movie.year,
                    customSlug: movie.slug,
                  })}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>Buka Halaman</span>
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEdit(movie)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95"
                    title="Edit Post"
                  >
                    <Edit2 size={13} />
                  </button>

                  {canDelete && (
                    <button
                      onClick={() => onDelete(movie.relativePath, title)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all shadow-sm active:scale-95"
                      title="Hapus Post"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination controls (active if totalMoviesCount > 7 or totalPages > 1) */}
      {(totalPages > 1 || totalMoviesCount > 7) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
          <span className="text-xs text-slate-400">
            Menampilkan{' '}
            <span className="font-bold text-white">
              {totalMoviesCount > 0 ? (currentPage - 1) * 7 + 1 : 0}
            </span>
            -
            <span className="font-bold text-white">
              {Math.min(currentPage * 7, totalMoviesCount)}
            </span>{' '}
            dari <span className="font-bold text-cyan-400">{totalMoviesCount}</span> film (Halaman {currentPage} dari {totalPages})
          </span>
          <div className="flex items-center gap-1 self-center sm:self-auto flex-wrap">
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft size={15} />
              <span className="hidden xs:inline">Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prevP = arr[idx - 1];
                const showEllipsis = prevP && p - prevP > 1;

                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-1 text-slate-500 text-xs">...</span>}
                    <button
                      onClick={() => onPageChange(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                        p === currentPage
                          ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all text-xs font-semibold flex items-center gap-1"
            >
              <span className="hidden xs:inline">Next</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
