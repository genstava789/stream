'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  User,
  Bookmark,
  History,
  LogIn,
  LogOut,
  Trash2,
  Play,
  Film,
  Tv,
  Star,
  Clock,
  ShieldCheck,
  Crown,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton';
import { getImageUrl } from '@/lib/tmdb';

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Baru saja';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 30) return `${days} hari lalu`;
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatJoinDate(dateVal?: string | number): string {
  if (!dateVal) return '2026';
  try {
    const d = new Date(dateVal);
    return d.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '2026';
  }
}

const WATCHLIST_PER_PAGE = 12;
const HISTORY_PER_PAGE = 10;

function WatchlistCardItem({
  item,
  onRemove,
}: {
  item: any;
  onRemove: (id: string | number) => void;
}) {
  const [imgError, setImgError] = useState(false);

  const targetUrl = item.urlPath || (item.type === 'tv' ? `/tv/${item.contentId}` : `/movie/${item.contentId}`);
  const posterSrc = item.posterPath
    ? item.posterPath.startsWith('http')
      ? item.posterPath
      : getImageUrl(item.posterPath, 'w342')
    : '/placeholder-poster.svg';
  const rawRating = Number(item.rating || item.vote_average || item.voteAverage);
  const rating = !isNaN(rawRating) && rawRating > 0 ? Math.round(rawRating * 10) / 10 : null;
  const year = item.releaseDate ? String(item.releaseDate).slice(0, 4) : '2026';

  return (
    <div className="group/card block w-full select-none">
      {/* ── Poster Wrapper (Exact styling matching MovieCard) ── */}
      <div className="relative aspect-[2/3] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c1224] border border-white/10 shadow-md group-hover/card:shadow-xl transition-all duration-300 transform group-hover/card:-translate-y-1.5">
        <Link href={targetUrl} className="block w-full h-full relative">
          <div className="absolute inset-0 bg-white/[0.04]" />

          {!imgError ? (
            <img
              src={posterSrc}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#0f1a2e] to-[#1a2540] text-slate-500">
              <Film size={28} />
              <span className="text-xs text-center line-clamp-2 text-slate-400 font-medium">{item.title}</span>
            </div>
          )}

          {/* ── IMDb-Style Yellow Rating Badge (Top-Right) ── */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md bg-[#f5c518] text-black font-black text-[9px] xs:text-[9.5px] sm:text-[11.5px] shadow-lg shadow-black/50 tracking-tight">
            <Star size={10} fill="currentColor" stroke="none" className="text-black sm:w-[11px] sm:h-[11px]" />
            <span>{typeof rating === 'number' && rating > 0 ? rating.toFixed(1) : 'NR'}</span>
          </div>

          {/* ── Media Type Badge (Top-Left: Series / Movie) ── */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-slate-200 font-bold text-[8.5px] xs:text-[9px] sm:text-[10px] uppercase tracking-wider shadow-md">
            {item.type === 'tv' ? (
              <>
                <Tv size={9} className="text-cyan-400 sm:w-[10px] sm:h-[10px]" />
                <span>Series</span>
              </>
            ) : (
              <>
                <Film size={9} className="text-cyan-400 sm:w-[10px] sm:h-[10px]" />
                <span>Movie</span>
              </>
            )}
          </div>

          {/* Hover Play Overlay */}
          <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.8)] transform scale-75 group-hover/card:scale-100 transition-transform duration-300">
              <Play size={16} className="fill-current ml-0.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Info Outside Below Poster (Matching MovieCard) ── */}
      <div className="pt-1.5 sm:pt-2.5 px-0.5 space-y-0.5 sm:space-y-1">
        <div className="flex items-start justify-between gap-1.5">
          <Link href={targetUrl} className="flex-1 min-w-0 block">
            <h3
              title={item.title}
              className="font-bold text-white text-xs sm:text-[13.5px] leading-snug line-clamp-2 group-hover/card:text-cyan-400 transition-colors"
            >
              {item.title}
            </h3>
          </Link>

          <button
            onClick={() => onRemove(item.contentId)}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
            title="Hapus dari Watchlist"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="flex items-center text-[11px] sm:text-xs text-slate-400 font-medium">
          <span>{year}</span>
        </div>
      </div>
    </div>
  );
}

function WatchlistSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5 animate-pulse">
      {Array.from({ length: 12 }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col rounded-xl sm:rounded-2xl overflow-hidden bg-[#0c1224] border border-white/10 p-0"
        >
          <div className="aspect-[2/3] w-full bg-white/[0.06]" />
          <div className="pt-2 sm:pt-2.5 px-1 pb-1 space-y-1.5">
            <div className="h-3.5 w-3/4 rounded-md bg-white/[0.08]" />
            <div className="h-2.5 w-1/3 rounded-md bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistorySkeletonList() {
  return (
    <div className="space-y-3 sm:space-y-4 animate-pulse">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-[#0c1226] border border-white/[0.08]"
        >
          <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
            <div className="w-16 sm:w-20 aspect-[16/10] rounded-xl bg-white/[0.06] flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-3 w-10 rounded bg-white/[0.08]" />
                <div className="h-3.5 w-44 sm:w-60 rounded bg-white/[0.08]" />
              </div>
              <div className="h-2.5 w-24 rounded bg-white/[0.04]" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function ProfilePageClient() {
  const {
    user,
    authStatus,
    isLoggedIn,
    openAuthModal,
    logout,
    watchlist,
    removeFromWatchlist,
    history,
    removeFromHistory,
    clearHistory,
    refreshProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'watchlist' | 'history'>('watchlist');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // Pagination states
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const contentSectionRef = useRef<HTMLDivElement>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleClearAllHistory = async () => {
    await clearHistory();
    setConfirmClearHistory(false);
    setHistoryPage(1);
  };

  // Watchlist Pagination calculations
  const totalWatchlistPages = Math.max(1, Math.ceil(watchlist.length / WATCHLIST_PER_PAGE));
  const paginatedWatchlist = useMemo(() => {
    const start = (watchlistPage - 1) * WATCHLIST_PER_PAGE;
    return watchlist.slice(start, start + WATCHLIST_PER_PAGE);
  }, [watchlist, watchlistPage]);

  // History Pagination calculations
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PER_PAGE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PER_PAGE;
    return history.slice(start, start + HISTORY_PER_PAGE);
  }, [history, historyPage]);

  const scrollToContent = () => {
    if (contentSectionRef.current) {
      contentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const onWatchlistPageChange = (newPage: number) => {
    setWatchlistPage(newPage);
    scrollToContent();
  };

  const onHistoryPageChange = (newPage: number) => {
    setHistoryPage(newPage);
    scrollToContent();
  };

  // While checking initial session (and no local cache available), show smooth ProfileSkeleton
  if (authStatus === 'initializing') {
    return <ProfileSkeleton />;
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-20 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14" style={{ background: '#050816' }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── 1. USER PROFILE HEADER CARD ── */}
        <div
          className="relative rounded-3xl p-6 sm:p-8 overflow-hidden transition-all duration-300"
          style={{
            background: 'rgba(11, 16, 32, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(6, 182, 212, 0.08)',
          }}
        >
          {/* Ambient Glow Orbs */}
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #06b6d4, #7c3aed)' }}
          />
          <div
            className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full pointer-events-none opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #ec4899, #7c3aed)' }}
          />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            
            {/* Left: Avatar + Details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 w-full md:w-auto">
              {/* Avatar Frame */}
              <div className="relative group flex-shrink-0">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: isLoggedIn
                      ? 'linear-gradient(135deg, #06b6d4, #7c3aed, #ec4899)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    boxShadow: isLoggedIn ? '0 0 25px rgba(6, 182, 212, 0.4)' : 'none',
                  }}
                >
                  <div className="w-full h-full rounded-xl bg-[#0b1020] flex items-center justify-center overflow-hidden">
                    {isLoggedIn && user ? (
                      <img
                        src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.username)}`}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-purple-600/20 text-cyan-400">
                        <User size={36} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Indicator Dot */}
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0b1020] flex items-center justify-center ${
                    isLoggedIn ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'
                  }`}
                />
              </div>

              {/* User Info Details */}
              <div className="space-y-2 flex-1 min-w-0">
                {!isLoggedIn ? (
                  // GUEST MODE: Full prominent badge without redundant text heading
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-center sm:justify-start">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold bg-slate-500/20 border border-slate-500/35 text-slate-200 shadow-sm">
                        <User size={14} className="text-slate-400" />
                        <span>GUEST ACCOUNT</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-400">
                      Login untuk melihat riwayat tontonan & watchlist
                    </p>
                  </div>
                ) : (
                  // LOGGED IN MODE: Responsive username + Member Badge + Email + Joined Date
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1.5 sm:gap-2.5">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight break-all sm:break-normal max-w-full capitalize">
                        {user?.username}
                      </h1>
                      {user?.role === 'owner' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500/25 to-yellow-500/25 border border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] flex-shrink-0 mt-0.5 sm:mt-1">
                          <Crown size={12} className="text-amber-400 fill-amber-400" />
                          OWNER
                        </span>
                      ) : user?.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-cyan-500/25 to-sky-500/25 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex-shrink-0 mt-0.5 sm:mt-1">
                          <ShieldCheck size={12} className="text-cyan-400 fill-cyan-400/30" />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)] flex-shrink-0 mt-0.5 sm:mt-1">
                          <ShieldCheck size={12} className="text-cyan-400" />
                          MEMBER
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-400 truncate">
                      {user?.email}
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={13} className="text-purple-400" />
                        Bergabung: {formatJoinDate(user?.createdAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Stats & Actions */}
            <div className="flex flex-col items-center sm:items-end gap-3.5 w-full sm:w-auto">
              {/* Stats Pills */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-center min-w-[90px]">
                  <p className="text-xs text-slate-400">Watchlist</p>
                  <p className="text-lg font-black text-cyan-400">
                    {isLoggedIn ? watchlist.length : 0}
                  </p>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-center min-w-[90px]">
                  <p className="text-xs text-slate-400">Riwayat</p>
                  <p className="text-lg font-black text-purple-400">
                    {isLoggedIn ? history.length : 0}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 hover:text-white transition-all active:scale-95"
                      title="Refresh Data"
                    >
                      <RefreshCw
                        size={16}
                        className={isRefreshing ? 'animate-spin text-cyan-400' : ''}
                      />
                    </button>

                    <button
                      onClick={logout}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 transition-all duration-200 active:scale-95"
                    >
                      <LogOut size={15} />
                      <span>Keluar</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openAuthModal('login', 'Masuk untuk mengakses profil dan watchlist Anda')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                    }}
                  >
                    <LogIn size={16} />
                    <span>Masuk / Daftar Akun</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── 2. TAB SWITCHER ── */}
        <div ref={contentSectionRef} className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Watchlist Tab Button */}
            <button
              onClick={() => {
                setActiveTab('watchlist');
                setWatchlistPage(1);
              }}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'watchlist'
                  ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Bookmark
                size={16}
                fill={activeTab === 'watchlist' ? 'currentColor' : 'none'}
              />
              <span>Watchlist</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'watchlist'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {isLoggedIn ? watchlist.length : 0}
              </span>
            </button>

            {/* History Tab Button */}
            <button
              onClick={() => {
                setActiveTab('history');
                setHistoryPage(1);
              }}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                activeTab === 'history'
                  ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30 shadow-[0_0_15px_rgba(124,58,237,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <History size={16} />
              <span>Riwayat Tonton</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'history'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {isLoggedIn ? history.length : 0}
              </span>
            </button>
          </div>

          {/* Right Action: Clear History Trigger Button */}
          {activeTab === 'history' && isLoggedIn && history.length > 0 && (
            <button
              onClick={() => setConfirmClearHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex-shrink-0"
              title="Bersihkan Semua Riwayat"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Bersihkan Riwayat</span>
            </button>
          )}
        </div>

        {/* ── 3. TAB CONTENT VIEWS ── */}

        {/* ── TAB 1: WATCHLIST ── */}
        {activeTab === 'watchlist' && (
          <div className="space-y-8">
            {isRefreshing ? (
              <WatchlistSkeletonGrid />
            ) : !isLoggedIn ? (
              /* Guest Preview State for Watchlist */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5"
                style={{
                  background: 'rgba(11, 16, 32, 0.7)',
                  border: '1px dashed rgba(6, 182, 212, 0.3)',
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.2))',
                    border: '1px solid rgba(6,182,212,0.3)',
                    boxShadow: '0 0 25px rgba(6, 182, 212, 0.2)',
                  }}
                >
                  <Bookmark size={28} className="text-cyan-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Watchlist Pribadi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Login untuk melihat riwayat tontonan & watchlist. Semua film dan serial favoritmu akan tersimpan rapi di akunmu.
                  </p>
                </div>

                <button
                  onClick={() => openAuthModal('login', 'Masuk untuk menyimpan ke Watchlist')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                  }}
                >
                  <LogIn size={16} />
                  <span>Masuk Sekarang</span>
                </button>
              </div>
            ) : watchlist.length === 0 ? (
              /* Logged in but empty watchlist */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4"
                style={{
                  background: 'rgba(11, 16, 32, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <Bookmark size={24} />
                </div>
                <h3 className="text-base font-bold text-white">Watchlist Masih Kosong</h3>
                <p className="text-xs text-slate-400">
                  Jelajahi ribuan film dan serial pilihan, lalu klik tombol Watchlist untuk menyimpannya di sini.
                </p>
                <Link
                  href="/movie"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all"
                >
                  <Film size={14} />
                  <span>Jelajahi Film & Serial</span>
                </Link>
              </div>
            ) : (
              /* Watchlist Grid Consistent with Homepage MovieCard */
              <>
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
                  {paginatedWatchlist.map((item) => (
                    <WatchlistCardItem
                      key={String(item.contentId)}
                      item={item}
                      onRemove={removeFromWatchlist}
                    />
                  ))}
                </div>

                {/* Watchlist Pagination Controls */}
                {totalWatchlistPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
                    <p className="text-xs text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-white font-bold">{paginatedWatchlist.length}</span> dari{' '}
                      <span className="text-white font-bold">{watchlist.length}</span> item tersimpan
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onWatchlistPageChange(watchlistPage - 1)}
                        disabled={watchlistPage === 1}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalWatchlistPages }).map((_, idx) => {
                          const p = idx + 1;
                          const isActive = p === watchlistPage;
                          if (
                            p === 1 ||
                            p === totalWatchlistPages ||
                            (p >= watchlistPage - 1 && p <= watchlistPage + 1)
                          ) {
                            return (
                              <button
                                key={p}
                                onClick={() => onWatchlistPageChange(p)}
                                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                  isActive
                                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/5'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          }
                          if (p === watchlistPage - 2 || p === watchlistPage + 2) {
                            return (
                              <span key={p} className="text-slate-600 text-xs px-0.5">
                                •
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => onWatchlistPageChange(watchlistPage + 1)}
                        disabled={watchlistPage === totalWatchlistPages}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB 2: HISTORY ── */}
        {activeTab === 'history' && (
          <div className="space-y-8">
            {isRefreshing ? (
              <HistorySkeletonList />
            ) : !isLoggedIn ? (
              /* Guest Preview State for History */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5"
                style={{
                  background: 'rgba(11, 16, 32, 0.7)',
                  border: '1px dashed rgba(124, 58, 237, 0.3)',
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.2))',
                    border: '1px solid rgba(124,58,237,0.3)',
                    boxShadow: '0 0 25px rgba(124, 58, 237, 0.2)',
                  }}
                >
                  <History size={28} className="text-purple-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Riwayat Tontonan
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Login untuk melihat riwayat tontonan & watchlist. Lanjutkan film atau episode serial yang sedang kamu tonton kapan saja tanpa takut terlewat.
                  </p>
                </div>

                <button
                  onClick={() => openAuthModal('login', 'Masuk untuk mencatat riwayat tontonan')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)',
                  }}
                >
                  <LogIn size={16} />
                  <span>Masuk Sekarang</span>
                </button>
              </div>
            ) : history.length === 0 ? (
              /* Logged in but empty history */
              <div
                className="rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4"
                style={{
                  background: 'rgba(11, 16, 32, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <Clock size={24} />
                </div>
                <h3 className="text-base font-bold text-white">Belum Ada Riwayat Tontonan</h3>
                <p className="text-xs text-slate-400">
                  Mulai putar film atau serial favoritmu dan riwayat tontonan akan otomatis dicatat di sini.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all"
                >
                  <Play size={14} />
                  <span>Mulai Menonton</span>
                </Link>
              </div>
            ) : (
              /* History Timeline Grid & Pagination */
              <>
                <div className="space-y-3 sm:space-y-4">
                  {paginatedHistory.map((item) => {
                    const targetUrl = item.urlPath || (item.type === 'tv' ? `/tv/${item.contentId}` : `/movie/${item.contentId}`);
                    const posterSrc = item.posterPath
                      ? item.posterPath.startsWith('http')
                        ? item.posterPath
                        : getImageUrl(item.posterPath, 'w500')
                      : '/placeholder-poster.svg';

                    return (
                      <div
                        key={`${item.contentId}-${item.viewedAt}`}
                        className="group relative flex items-center justify-between gap-4 p-3 sm:p-4 rounded-2xl bg-[#0c1226] border border-white/[0.08] hover:border-purple-500/40 hover:bg-white/[0.03] transition-all duration-200"
                      >
                        {/* Left: Thumbnail & Info */}
                        <Link href={targetUrl} className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                          {/* Thumbnail */}
                          <div className="relative w-16 sm:w-20 aspect-[16/10] rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                            <Image
                              src={posterSrc}
                              alt={item.title}
                              fill
                              sizes="120px"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play size={14} className="text-cyan-400 fill-cyan-400" />
                            </div>
                          </div>

                          {/* Title & Metadata */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-white ${
                                  item.type === 'tv' ? 'bg-pink-600' : 'bg-cyan-600'
                                }`}
                              >
                                {item.type === 'tv' ? 'Series' : 'Movie'}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                                {item.title}
                              </h4>
                            </div>

                            {item.episodeTitle && (
                              <p className="text-[11px] font-semibold text-purple-300 truncate">
                                {item.episodeTitle}
                              </p>
                            )}

                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <Clock size={10} className="text-slate-400" />
                              <span>Ditonton {formatRelativeTime(item.viewedAt)}</span>
                            </p>
                          </div>
                        </Link>

                        {/* Right: Quick Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            href={targetUrl}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 transition-colors"
                          >
                            <Play size={12} className="fill-current" />
                            <span className="hidden sm:inline">Lanjutkan</span>
                          </Link>

                          <button
                            onClick={() => removeFromHistory(item.contentId)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Hapus dari Riwayat"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* History Pagination Controls */}
                {totalHistoryPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
                    <p className="text-xs text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-white font-bold">{paginatedHistory.length}</span> dari{' '}
                      <span className="text-white font-bold">{history.length}</span> riwayat tontonan
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onHistoryPageChange(historyPage - 1)}
                        disabled={historyPage === 1}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <ChevronLeft size={14} />
                        <span>Prev</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalHistoryPages }).map((_, idx) => {
                          const p = idx + 1;
                          const isActive = p === historyPage;
                          if (
                            p === 1 ||
                            p === totalHistoryPages ||
                            (p >= historyPage - 1 && p <= historyPage + 1)
                          ) {
                            return (
                              <button
                                key={p}
                                onClick={() => onHistoryPageChange(p)}
                                className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                  isActive
                                    ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]'
                                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/5'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          }
                          if (p === historyPage - 2 || p === historyPage + 2) {
                            return (
                              <span key={p} className="text-slate-600 text-xs px-0.5">
                                •
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => onHistoryPageChange(historyPage + 1)}
                        disabled={historyPage === totalHistoryPages}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 4. DEDICATED RESPONSIVE CLEAR ALL HISTORY MODAL ── */}
        {confirmClearHistory && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="relative w-full max-w-sm rounded-3xl p-6 sm:p-7 text-center space-y-5 shadow-2xl border"
              style={{
                background: 'rgba(11, 16, 32, 0.98)',
                borderColor: 'rgba(244, 63, 94, 0.35)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(244, 63, 94, 0.25)',
              }}
            >
              {/* Close Button Top Right */}
              <button
                onClick={() => setConfirmClearHistory(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>

              {/* Warning Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                <Trash2 size={26} />
              </div>

              {/* Text Information */}
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Hapus Semua Riwayat?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed px-1">
                  Seluruh daftar riwayat tontonan Anda akan dibersihkan secara permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              {/* Action Buttons: 100% visible & comfortable on all screen sizes */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmClearHistory(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-200 hover:text-white bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  className="flex-1 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-600/40 transition-all active:scale-95"
                >
                  Ya, Hapus Semua
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export { ProfilePageClient };
