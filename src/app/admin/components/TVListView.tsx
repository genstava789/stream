import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Tv,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Play,
  Film,
  Star,
  Check,
} from 'lucide-react';
import { TVShowItem, TVEpisodeItem } from '../types';
import { getTVUrl } from '@/lib/urls';
import { getLanguageBadge } from '@/lib/language';

interface TVListViewProps {
  tvShows: TVShowItem[];
  totalShowsCount: number;
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageLoading?: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (show: TVShowItem) => void;
  onOpenEditEpisode: (ep: TVEpisodeItem, show: TVShowItem) => void;
  onDeleteShow: (path: string, title: string) => void;
  onDeleteEpisode: (path: string, title: string) => void;
  onQuickAddEpisode: (show: TVShowItem, seasonSlug: string) => void;
  selectedPaths?: string[];
  onToggleSelect?: (path: string) => void;
  onSelectAll?: (paths: string[]) => void;
  onClearSelection?: () => void;
  canDelete?: boolean;
}

function TVCardSkeleton() {
  return (
    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0c1224] border border-white/5 animate-pulse space-y-3 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-12 sm:w-14 aspect-[2/3] min-h-[72px] sm:min-h-[84px] rounded-lg bg-slate-800/80 flex-shrink-0" />
          <div className="space-y-2 py-1 flex-1">
            <div className="flex gap-1.5">
              <div className="h-4 w-16 bg-slate-800/90 rounded" />
              <div className="h-4 w-20 bg-slate-800/60 rounded" />
              <div className="h-4 w-16 bg-slate-800/40 rounded" />
            </div>
            <div className="h-4 w-48 bg-slate-700/80 rounded" />
            <div className="h-2.5 w-32 bg-slate-800/50 rounded" />
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="h-8 w-16 bg-slate-800/60 rounded-lg" />
          <div className="h-8 w-24 bg-slate-800/60 rounded-lg" />
        </div>
      </div>
      <div className="h-10 bg-slate-800/40 rounded-xl" />
    </div>
  );
}

function SafeAdminImage({
  src,
  fallbackSrc,
  alt,
  sizes,
}: {
  src: string | null | undefined;
  fallbackSrc?: string | null;
  alt: string;
  sizes?: string;
}) {
  const [error, setError] = useState(false);
  const target = error ? fallbackSrc : src || fallbackSrc;

  if (!target) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
        <Tv size={16} />
      </div>
    );
  }

  return (
    <Image
      src={target}
      alt={alt}
      fill
      sizes={sizes || '56px'}
      onError={() => setError(true)}
      className="object-cover"
    />
  );
}

const EPISODES_PER_SEASON_PAGE = 6;

export const TVListView: React.FC<TVListViewProps> = ({
  tvShows,
  totalShowsCount,
  searchQuery,
  currentPage,
  totalPages,
  onPageChange,
  pageLoading,
  onOpenCreate,
  onOpenEdit,
  onOpenEditEpisode,
  onDeleteShow,
  onDeleteEpisode,
  onQuickAddEpisode,
  selectedPaths = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  canDelete = true,
}) => {
  const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});
  const [seasonPages, setSeasonPages] = useState<Record<string, number>>({});

  const toggleSeasonAccordion = (showSlug: string, seasonSlug: string) => {
    const key = `${showSlug}_${seasonSlug}`;
    setExpandedSeasons((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isSeasonExpanded = (showSlug: string, seasonSlug: string) => {
    const key = `${showSlug}_${seasonSlug}`;
    return Boolean(expandedSeasons[key]);
  };

  const getShowSeasons = (show: TVShowItem) => {
    const seasonsSet = new Set<string>();
    show.episodes.forEach((ep) => {
      if (ep.seasonFolder) seasonsSet.add(ep.seasonFolder.toLowerCase());
    });
    const sorted = Array.from(seasonsSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
    return sorted.length > 0 ? sorted : ['s1'];
  };

  const formatSeasonLabel = (seasonSlug: string) => {
    const num = seasonSlug.replace(/\D/g, '') || '1';
    return `Season ${num}`;
  };

  const formatEpisodeTitle = (title?: string, slug?: string) => {
    if (!title || title.toLowerCase().startsWith('e') && !title.includes(' ')) {
      const epNum = slug ? getEpisodeNumber(slug) : (title ? getEpisodeNumber(title) : '1');
      return `Episode ${epNum}`;
    }
    return title
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  };

  const getSeasonNumber = (seasonFolder: string | null) => {
    if (!seasonFolder) return '1';
    return seasonFolder.replace(/\D/g, '') || '1';
  };

  const getEpisodeNumber = (slug: string) => {
    const match = slug.match(/e(\d+)/i) || slug.match(/ep(\d+)/i) || slug.match(/(\d+)/);
    return match ? match[1] : slug;
  };

  if (pageLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <TVCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (tvShows.length === 0) {
    return (
      <div className="py-16 text-center bg-[#090e1f] rounded-2xl border border-white/5 p-6">
        <Tv size={36} className="mx-auto mb-3 text-slate-600" />
        <h3 className="text-sm font-bold text-white mb-1">Belum Ada TV Series Ditemukan</h3>
        <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
          {searchQuery
            ? 'Tidak ada serial TV yang cocok dengan kata kunci pencarian Anda.'
            : 'Mulai tambahkan serial TV baru beserta episodenya.'}
        </p>
        <button
          onClick={onOpenCreate}
          className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-pink-500/20 active:scale-95 inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>Tambah TV Series Baru</span>
        </button>
      </div>
    );
  }

  const allVisiblePaths = tvShows.map((s) => s.relativePath);
  const isAllCurrentSelected =
    allVisiblePaths.length > 0 && allVisiblePaths.every((p) => selectedPaths.includes(p));

  const handleToggleSelectAll = () => {
    if (isAllCurrentSelected) {
      if (onClearSelection) onClearSelection();
    } else {
      if (onSelectAll) onSelectAll(Array.from(new Set([...selectedPaths, ...allVisiblePaths])));
    }
  };

  return (
    <div className="space-y-4">
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
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'bg-black/50 border border-white/30 hover:border-pink-400 text-transparent'
              }`}
            >
              <Check size={11} strokeWidth={3} className={isAllCurrentSelected ? 'opacity-100' : 'opacity-0'} />
            </div>
            <span>Pilih Semua di Halaman Ini ({tvShows.length})</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-medium">
            Daftar Serial TV Terdaftar ({tvShows.length})
          </span>
        )}
        <span className="text-xs text-slate-400">
          Total <span className="text-pink-400 font-bold">{totalShowsCount}</span> serial TV
        </span>
      </div>

      <div className="space-y-3.5 w-full">
        {tvShows.map((show) => {
          const title = show.displayTitle || show.frontmatter.title || show.showSlug;
          const tmdbId = show.frontmatter.tmdb_id;
          const poster = show.posterUrl || show.frontmatter.image_url;
          const year = show.year;
          const weight = show.frontmatter.weight;
          const showSeasons = getShowSeasons(show);
          const isSelected = selectedPaths.includes(show.relativePath);

          return (
            <div
              key={show.showSlug}
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0c1224] border transition-all shadow-sm w-full space-y-3 ${
                isSelected
                  ? 'border-pink-400 bg-[#190d24]'
                  : 'border-white/10 hover:border-pink-500/40'
              }`}
            >
              {/* Show Main Header - Mobile Responsive */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10 w-full">
                <div className="flex items-start sm:items-center gap-2.5">
                  {/* Clean Selector Checkbox */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleSelect) onToggleSelect(show.relativePath);
                      }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0 mt-1 sm:mt-0 ${
                        isSelected
                          ? 'bg-pink-500 text-white shadow-md shadow-pink-500/40 ring-2 ring-pink-400/40'
                          : 'bg-black/50 border border-white/20 hover:border-pink-400 text-transparent'
                      }`}
                      title={isSelected ? 'Batalkan pilihan' : 'Pilih serial ini'}
                    >
                      <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </button>
                  )}

                  {/* Poster Thumbnail */}
                  <div
                    onClick={() => {
                      if (canDelete && onToggleSelect) onToggleSelect(show.relativePath);
                    }}
                    className={`relative w-12 sm:w-14 aspect-[2/3] min-h-[72px] sm:min-h-[84px] rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 border border-white/10 shadow-sm ${
                      canDelete ? 'cursor-pointer' : ''
                    }`}
                  >
                    <SafeAdminImage src={poster} alt={title} sizes="56px" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/30">
                        TMDB {tmdbId}
                      </span>
                      {(() => {
                        const langBadge = getLanguageBadge(show.frontmatter.language);
                        return (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${langBadge.bg} ${langBadge.text} border ${langBadge.border}`}
                            title={`Bahasa: ${langBadge.label}`}
                          >
                            {langBadge.fullBadge}
                          </span>
                        );
                      })()}
                      {weight !== undefined && weight !== null && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30" title="Prioritas Weight">
                          W: {weight}
                        </span>
                      )}
                      {Boolean(show.frontmatter.trending) && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Trending
                        </span>
                      )}
                      {Boolean(show.frontmatter.featured) && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Star size={10} fill="currentColor" /> Featured
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        {show.episodes.length} Episode
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-white/5 text-slate-300 border border-white/10">
                        {showSeasons.length} Season
                      </span>
                    </div>
                    <h3 className="font-extrabold text-white text-xs sm:text-sm leading-snug line-clamp-2">
                      {title}{' '}
                      {year ? <span className="text-slate-400 font-normal text-xs">({year})</span> : ''}
                    </h3>
                    <p className="text-[9.5px] text-slate-500 font-mono truncate mt-0.5">
                      tv/{show.showSlug}/_index.md
                    </p>
                  </div>
                </div>

                {/* Show Actions - Responsive Grid on Mobile */}
                <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 w-full md:w-auto pt-1 md:pt-0">
                  <Link
                    href={getTVUrl({
                      id: show.frontmatter.tmdb_id,
                      tmdbId: show.frontmatter.tmdb_id,
                      name: show.displayTitle || show.frontmatter.title,
                      year: show.year,
                      customSlug: show.showSlug,
                    })}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-cyan-400 transition-all border border-white/5"
                  >
                    <ExternalLink size={12} />
                    <span>Lihat</span>
                  </Link>

                  <button
                    onClick={() => onOpenEdit(show)}
                    className="col-span-2 sm:col-auto inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 transition-all active:scale-95"
                  >
                    <Edit2 size={12} />
                    <span>Kelola Series</span>
                  </button>

                  {canDelete && (
                    <button
                      onClick={() => onDeleteShow(`tv/${show.showSlug}`, title)}
                      className="hidden sm:inline-flex p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                      title="Hapus Seluruh TV Series"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Season Accordions */}
              <div className="space-y-2 w-full">
                {showSeasons.length === 0 || show.episodes.length === 0 ? (
                  <div className="p-3 text-center bg-black/20 rounded-lg border border-white/5">
                    <p className="text-[11px] text-slate-400 mb-1">Belum ada episode di series ini.</p>
                    <button
                      onClick={() => onOpenEdit(show)}
                      className="text-[11px] font-bold text-pink-400 hover:text-pink-300 inline-flex items-center gap-1"
                    >
                      <Plus size={11} /> Tambah Episode
                    </button>
                  </div>
                ) : (
                  showSeasons.map((seasonSlug) => {
                    const isExpanded = isSeasonExpanded(show.showSlug, seasonSlug);
                    const seasonEps = show.episodes.filter(
                      (ep) => (ep.seasonFolder || 's1').toLowerCase() === seasonSlug.toLowerCase()
                    );
                    const pageKey = `${show.showSlug}_${seasonSlug}`;
                    const seasonPage = seasonPages[pageKey] || 1;
                    const seasonTotalPages = Math.ceil(seasonEps.length / EPISODES_PER_SEASON_PAGE) || 1;
                    const pagedEpisodes = seasonEps.slice(
                      (seasonPage - 1) * EPISODES_PER_SEASON_PAGE,
                      seasonPage * EPISODES_PER_SEASON_PAGE
                    );

                    return (
                      <div
                        key={seasonSlug}
                        className="rounded-xl border border-white/10 bg-black/30 overflow-hidden transition-all shadow-sm"
                      >
                        <div
                          onClick={() => toggleSeasonAccordion(show.showSlug, seasonSlug)}
                          className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-white/10 active:bg-white/15 transition-all select-none min-h-[44px]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-slate-300">
                              {isExpanded ? (
                                <ChevronDown size={16} className="text-pink-400 transition-transform" />
                              ) : (
                                <ChevronRight size={16} className="text-slate-400 transition-transform" />
                              )}
                            </div>
                            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate capitalize">
                              {formatSeasonLabel(seasonSlug)}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                              Episode {seasonEps.length}
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => onOpenEdit(show)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40 flex items-center gap-1 transition-all shadow-sm active:scale-95 capitalize"
                              title="Kelola / Edit Season & Episode"
                            >
                              <Edit2 size={11} className="text-pink-300" />
                              <span>Edit Season</span>
                            </button>

                            <button
                              onClick={() => onQuickAddEpisode(show, seasonSlug)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 flex items-center gap-1 transition-all shadow-sm active:scale-95 capitalize"
                            >
                              <Plus size={11} className="text-purple-300" />
                              <span>Tambah Episode</span>
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-2.5 sm:p-3 pt-2 border-t border-white/5 space-y-2.5 bg-black/40">
                            {seasonEps.length === 0 ? (
                              <div className="p-3 text-center text-slate-500 text-[11px]">
                                Belum ada episode di {formatSeasonLabel(seasonSlug)}.
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                                  {pagedEpisodes.map((ep) => {
                                    const epTitle = ep.displayTitle || ep.frontmatter.title || ep.slug;
                                    const formattedTitle = formatEpisodeTitle(epTitle, ep.slug);
                                    const epVideo = ep.frontmatter.videourl || ep.frontmatter.video_url;
                                    const epPoster = ep.posterUrl || ep.frontmatter.image_url;
                                    const baseTVUrl = getTVUrl({
                                      id: show.frontmatter.tmdb_id,
                                      tmdbId: show.frontmatter.tmdb_id,
                                      name: show.displayTitle || show.frontmatter.title,
                                      year: show.year,
                                      customSlug: show.showSlug,
                                    });
                                    const linkPath = ep.seasonFolder
                                      ? `${baseTVUrl}/${ep.seasonFolder}/${ep.slug}`
                                      : `${baseTVUrl}/${ep.slug}`;

                                    const seasonNum = getSeasonNumber(ep.seasonFolder);
                                    const episodeNum = getEpisodeNumber(ep.slug || ep.filename);

                                    return (
                                      <div
                                        key={ep.relativePath}
                                        className="p-2.5 rounded-xl bg-[#090e1e]/90 border border-white/10 flex items-start gap-2.5 w-full hover:border-purple-500/50 hover:bg-[#0c1328] transition-all shadow-sm group"
                                      >
                                        <div className="relative w-14 sm:w-16 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-white/10 flex-shrink-0 shadow-sm mt-0.5">
                                          <SafeAdminImage
                                            src={epPoster}
                                            fallbackSrc={poster}
                                            alt={formattedTitle}
                                            sizes="64px"
                                          />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                              S{seasonNum}
                                            </span>
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                              E{episodeNum}
                                            </span>
                                          </div>

                                          <h4
                                            className="font-bold text-white text-xs leading-tight line-clamp-1 group-hover:text-purple-300 transition-colors capitalize"
                                            title={formattedTitle}
                                          >
                                            {formattedTitle}
                                          </h4>

                                          <div className="flex items-center gap-1 mt-0.5 text-[9.5px] text-slate-400">
                                            <Play size={9} className="text-cyan-400 flex-shrink-0" />
                                            <span className="truncate font-mono">{epVideo || 'No URL'}</span>
                                          </div>

                                          <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-white/5">
                                            <Link
                                              href={linkPath}
                                              target="_blank"
                                              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-0.5"
                                            >
                                              <ExternalLink size={10} />
                                              <span>Play</span>
                                            </Link>

                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => onOpenEditEpisode(ep, show)}
                                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                                                title="Edit Episode"
                                              >
                                                <Edit2 size={11} />
                                              </button>
                                              {canDelete && (
                                                <button
                                                  onClick={() => onDeleteEpisode(ep.relativePath, epTitle)}
                                                  className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400"
                                                  title="Hapus Episode"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {seasonTotalPages > 1 && (
                                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                                    <span>
                                      Hal {seasonPage} dari {seasonTotalPages}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        disabled={seasonPage <= 1}
                                        onClick={() =>
                                          setSeasonPages((prev) => ({
                                            ...prev,
                                            [pageKey]: seasonPage - 1,
                                          }))
                                        }
                                        className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white"
                                      >
                                        <ChevronLeft size={14} />
                                      </button>
                                      <button
                                        disabled={seasonPage >= seasonTotalPages}
                                        onClick={() =>
                                          setSeasonPages((prev) => ({
                                            ...prev,
                                            [pageKey]: seasonPage + 1,
                                          }))
                                        }
                                        className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white"
                                      >
                                        <ChevronRight size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination controls (active if totalShowsCount > 7 or totalPages > 1) */}
      {(totalPages > 1 || totalShowsCount > 7) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
          <span className="text-xs text-slate-400">
            Menampilkan{' '}
            <span className="font-bold text-white">
              {totalShowsCount > 0 ? (currentPage - 1) * 7 + 1 : 0}
            </span>
            -
            <span className="font-bold text-white">
              {Math.min(currentPage * 7, totalShowsCount)}
            </span>{' '}
            dari <span className="font-bold text-pink-400">{totalShowsCount}</span> series (Halaman {currentPage} dari {totalPages})
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
                          ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
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
