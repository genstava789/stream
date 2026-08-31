'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutGrid,
  Search,
  Plus,
  Sparkles,
  Layers,
  Calendar,
  User,
  Film,
  Tv,
  ArrowRight,
  Loader2,
  LogIn,
  Flame,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  ShieldCheck,
} from 'lucide-react';
import { MongoCollection } from '@/lib/mongodb/collectionService';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/tmdb';
import CreateCollectionModal from './components/CreateCollectionModal';

interface CollectionsClientProps {
  initialCollections?: MongoCollection[];
  initialTotal?: number;
  initialFilter?: string;
  initialSearch?: string;
}

const ITEMS_PER_PAGE = 24;

export default function CollectionsClient({
  initialCollections = [],
  initialTotal = 0,
  initialFilter = 'latest',
  initialSearch = '',
}: CollectionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn } = useAuth();

  const [collections, setCollections] = useState<MongoCollection[]>(initialCollections);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeFilter, setActiveFilter] = useState<'all' | 'popular' | 'latest' | 'my'>(
    (initialFilter as any) || 'latest'
  );

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  // Debounced search & filter fetch
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (activeFilter) params.set('filter', activeFilter);
        params.set('page', page.toString());
        params.set('limit', ITEMS_PER_PAGE.toString());

        const res = await fetch(`/api/collections?${params.toString()}`);
        const data = await res.json();
        if (active && data.success) {
          setCollections(data.collections || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Fetch collections error:', err);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeFilter, page]);

  const handleCreateClick = () => {
    if (!isLoggedIn) {
      setLoginPromptOpen(true);
      return;
    }
    setModalOpen(true);
  };

  const handleCollectionCreated = (newCol: MongoCollection) => {
    setCollections((prev) => [newCol, ...prev]);
    setTotal((prev) => prev + 1);
    router.push(`/collections/${newCol.slug || newCol._id}`);
  };

  // Vote Like / Dislike (Only for logged-in users)
  const handleVote = async (
    e: React.MouseEvent,
    collectionId: string,
    type: 'like' | 'dislike'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn || !user) {
      setLoginPromptOpen(true);
      return;
    }

    // Optimistic UI update
    setCollections((prev) =>
      prev.map((col) => {
        if (col.slug === collectionId || String(col._id) === String(collectionId)) {
          const currentVote = col.userVote;
          let newVote: 'like' | 'dislike' | null = type;
          let likes = col.likes || 0;
          let dislikes = col.dislikes || 0;

          if (type === 'like') {
            if (currentVote === 'like') {
              newVote = null;
              likes = Math.max(0, likes - 1);
            } else {
              likes += 1;
              if (currentVote === 'dislike') {
                dislikes = Math.max(0, dislikes - 1);
              }
            }
          } else {
            if (currentVote === 'dislike') {
              newVote = null;
              dislikes = Math.max(0, dislikes - 1);
            } else {
              dislikes += 1;
              if (currentVote === 'like') {
                likes = Math.max(0, likes - 1);
              }
            }
          }

          return {
            ...col,
            likes,
            dislikes,
            userVote: newVote,
          };
        }
        return col;
      })
    );

    try {
      const res = await fetch(`/api/collections/${collectionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Sync server response
        setCollections((prev) =>
          prev.map((col) => {
            if (col.slug === collectionId || String(col._id) === String(collectionId)) {
              return {
                ...col,
                likes: data.likes,
                dislikes: data.dislikes,
                userVote: data.userVote,
              };
            }
            return col;
          })
        );
      }
    } catch (err) {
      console.error('Vote collection error:', err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

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
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16" style={{ background: '#050816' }}>
      <div className="max-w-7xl mx-auto">
        
        {/* ── Top Hero Header ── */}
        <div className="relative rounded-3xl p-6 sm:p-10 mb-8 sm:mb-10 overflow-hidden border border-cyan-500/20 bg-gradient-to-br from-[#0b122c] via-[#090e24] to-[#060814] shadow-[0_0_50px_rgba(6,182,212,0.1)]">
          {/* Ambient Glows */}
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-purple-600/10 blur-[90px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-4 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <LayoutGrid size={14} />
                <span>Koleksi Komunitas</span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
                Koleksi{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 50%, #ec4899 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Film & TV Series
                </span>
              </h1>

              <p className="text-xs sm:text-sm md:text-base text-slate-400 leading-relaxed">
                Jelajahi daftar tontonan yang dikurasi oleh komunitas atau buat dan bagikan koleksi judul film & serial favoritmu sendiri.
              </p>
            </div>

            {/* Buat Koleksi Action Button */}
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={handleCreateClick}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-extrabold text-sm shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
              >
                <Plus size={18} className="transition-transform group-hover:rotate-90 duration-200" />
                <span>Buat Koleksi</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Tabs Bar ── */}
        <div className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama koleksi, franchise, atau pembuat..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 text-xs sm:text-sm font-medium focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => {
                setActiveFilter('latest');
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === 'latest'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock size={13} />
              <span>Terbaru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('popular');
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === 'popular'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame size={13} />
              <span>Populer (Most Liked)</span>
            </button>

            {isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('my');
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFilter === 'my'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User size={13} />
                <span>Koleksi Saya</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Collection Cards Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="w-full h-36 bg-white/5 rounded-2xl mb-4" />
                <div className="space-y-2">
                  <div className="w-3/4 h-5 bg-white/5 rounded-lg" />
                  <div className="w-1/2 h-3.5 bg-white/5 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          /* Empty State */
          <div className="p-12 sm:p-16 rounded-3xl bg-[#090e21] border border-white/10 text-center max-w-xl mx-auto shadow-2xl">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
              <Layers size={36} />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
              {searchQuery ? 'Koleksi Tidak Ditemukan' : 'Belum Ada Koleksi'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              {searchQuery
                ? `Tidak ditemukan koleksi dengan kata kunci "${searchQuery}". Coba kata kunci lain atau buat koleksi baru!`
                : 'Jadilah yang pertama membuat koleksi film atau serial TV favoritmu dan bagikan ke komunitas!'}
            </p>

            <button
              type="button"
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={16} />
              <span>Buat Koleksi Sekarang</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
              {collections.map((collection) => {
                const previewItems = (collection.items || []).slice(0, 4);
                const yearSpan =
                  collection.yearStart && collection.yearEnd
                    ? collection.yearStart === collection.yearEnd
                      ? `${collection.yearStart}`
                      : `${collection.yearStart} · ${collection.yearEnd}`
                    : null;

                const colId = collection.slug || (collection._id as any);

                return (
                  <Link
                    key={collection.slug || collection._id?.toString()}
                    href={`/collections/${collection.slug || collection._id}`}
                    prefetch={true}
                    className="group relative rounded-3xl bg-[#090e21] border border-white/10 hover:border-cyan-500/50 p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] overflow-hidden"
                  >
                    {/* Backdrop Collage / Preview Posters Stack */}
                    <div className="relative h-44 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-slate-900 to-black border border-white/5">
                      {previewItems.length > 0 ? (
                        <div className="absolute inset-0 grid grid-cols-3 gap-1.5 p-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {previewItems.slice(0, 3).map((item, idx) => {
                            const posterUrl = item.posterPath ? getImageUrl(item.posterPath, 'w185') : null;
                            return (
                              <div
                                key={idx}
                                className="relative h-full rounded-xl overflow-hidden bg-slate-800"
                              >
                                {posterUrl ? (
                                  <img
                                    src={posterUrl}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <Film size={20} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Layers size={32} />
                        </div>
                      )}

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#090e21] via-transparent to-transparent" />

                      {/* Count & Year Badge on Top */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-white text-[11px] font-black shadow-lg">
                          {collection.itemCount || (collection.items || []).length} judul
                        </span>

                        {yearSpan && (
                          <span className="px-2.5 py-1 rounded-xl bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-[11px] font-bold shadow-lg">
                            {yearSpan}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info Section */}
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-1 mb-1.5">
                        {collection.title}
                      </h3>

                      {collection.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                          {collection.description}
                        </p>
                      )}

                      {/* Footer Author & Like/Dislike Info */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                        {/* Author Info */}
                        <div className="flex items-center gap-1.5 min-w-0 mr-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                            {collection.authorName ? collection.authorName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="truncate font-semibold text-slate-300">
                            {collection.authorName || 'Pengguna'}
                          </span>
                          {collection.authorRole === 'owner' ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex-shrink-0 flex items-center gap-0.5 shadow-sm">
                              <Crown size={9} className="text-amber-400 fill-amber-400" />
                              <span>Owner</span>
                            </span>
                          ) : collection.authorRole === 'admin' ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex-shrink-0 flex items-center gap-0.5 shadow-sm">
                              <ShieldCheck size={9} className="text-cyan-400" />
                              <span>Admin</span>
                            </span>
                          ) : null}
                        </div>

                        {/* Interactive Like & Dislike Buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Like Button */}
                          <button
                            type="button"
                            onClick={(e) => handleVote(e, colId, 'like')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all duration-150 active:scale-90 ${
                              collection.userVote === 'like'
                                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/80 shadow-[0_0_14px_rgba(6,182,212,0.35)] scale-105'
                                : 'bg-white/[0.05] hover:bg-white/[0.12] text-slate-400 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30'
                            }`}
                            title={isLoggedIn ? 'Suka koleksi ini' : 'Login untuk menyukai'}
                          >
                            <ThumbsUp
                              size={13}
                              className={`transition-transform duration-150 ${
                                collection.userVote === 'like'
                                  ? 'fill-cyan-400 text-cyan-400 scale-110'
                                  : 'group-hover:scale-110'
                              }`}
                            />
                            <span className="tabular-nums">{collection.likes || 0}</span>
                          </button>

                          {/* Dislike Button */}
                          <button
                            type="button"
                            onClick={(e) => handleVote(e, colId, 'dislike')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all duration-150 active:scale-90 ${
                              collection.userVote === 'dislike'
                                ? 'bg-rose-500/25 text-rose-300 border border-rose-400/80 shadow-[0_0_14px_rgba(244,63,94,0.35)] scale-105'
                                : 'bg-white/[0.05] hover:bg-white/[0.12] text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30'
                            }`}
                            title={isLoggedIn ? 'Tidak suka koleksi ini' : 'Login untuk memberi tanggapan'}
                          >
                            <ThumbsDown
                              size={13}
                              className={`transition-transform duration-150 ${
                                collection.userVote === 'dislike'
                                  ? 'fill-rose-400 text-rose-400 scale-110'
                                  : 'group-hover:scale-110'
                              }`}
                            />
                            <span className="tabular-nums">{collection.dislikes || 0}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ── Pagination Controls ── */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:pointer-events-none border border-white/10 transition-all"
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers().map((pNum, idx) => {
                  if (pNum === '...') {
                    return (
                      <span key={`dots-${idx}`} className="px-2 text-slate-500 font-bold text-xs">
                        ...
                      </span>
                    );
                  }

                  const active = page === pNum;
                  return (
                    <button
                      key={`page-${pNum}`}
                      type="button"
                      onClick={() => {
                        setPage(Number(pNum));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`min-w-[36px] h-9 px-3 rounded-xl text-xs font-black transition-all ${
                        active
                          ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25 scale-105'
                          : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:pointer-events-none border border-white/10 transition-all"
                  aria-label="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Modal Create Collection ── */}
        <CreateCollectionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleCollectionCreated}
        />

        {/* ── Login Required Prompt Modal ── */}
        {loginPromptOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="relative w-full max-w-md rounded-3xl bg-[#090e21] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)] p-6 sm:p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 mx-auto rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                <LogIn size={32} />
              </div>

              <h3 className="text-xl font-black text-white mb-2">
                Login Diperlukan
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mb-6">
                Silakan login ke akunmu untuk membuat koleksi atau memberikan Like/Dislike pada koleksi komunitas.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLoginPromptOpen(false)}
                  className="w-full sm:w-1/2 px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-slate-300 font-semibold text-xs sm:text-sm transition-all"
                >
                  Batal
                </button>
                <Link
                  href="/login?redirect=/collections"
                  className="w-full sm:w-1/2 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>Login Sekarang</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
