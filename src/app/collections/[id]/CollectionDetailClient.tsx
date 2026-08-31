'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Layers,
  User,
  Share2,
  Edit3,
  Trash2,
  Film,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  ShieldCheck,
  AlertTriangle,
  LogIn,
  ArrowRight,
} from 'lucide-react';
import { MongoCollection } from '@/lib/mongodb/collectionService';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/tmdb';
import MovieCard from '@/components/MovieCard';
import CreateCollectionModal from '../components/CreateCollectionModal';
import ShareCollectionModal from '../components/ShareCollectionModal';
import { Movie, TVShow } from '@/types/tmdb';

interface CollectionDetailClientProps {
  collection: MongoCollection;
}

const ITEMS_PER_PAGE = 24;

export default function CollectionDetailClient({ collection: initialCollection }: CollectionDetailClientProps) {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();

  const [collection, setCollection] = useState<MongoCollection>(initialCollection);
  const [page, setPage] = useState(1);

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = Boolean(user && collection.userId && user.id === collection.userId);

  const items = collection.items || [];
  const yearSpan =
    collection.yearStart && collection.yearEnd
      ? collection.yearStart === collection.yearEnd
        ? `${collection.yearStart}`
        : `${collection.yearStart} · ${collection.yearEnd}`
      : null;

  // Handle Like / Dislike Vote
  const handleVote = async (type: 'like' | 'dislike') => {
    if (!isLoggedIn || !user) {
      setLoginPromptOpen(true);
      return;
    }

    const colId = collection.slug || (collection._id as any);
    const currentVote = collection.userVote;
    let newVote: 'like' | 'dislike' | null = type;
    let likes = collection.likes || 0;
    let dislikes = collection.dislikes || 0;

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

    // Optimistic state
    setCollection((prev) => ({
      ...prev,
      likes,
      dislikes,
      userVote: newVote,
    }));

    try {
      const res = await fetch(`/api/collections/${colId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCollection((prev) => ({
          ...prev,
          likes: data.likes,
          dislikes: data.dislikes,
          userVote: data.userVote,
        }));
      }
    } catch (err) {
      console.error('Vote detail collection error:', err);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${collection.slug || collection._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/collections');
      } else {
        alert(data.message || 'Gagal menghapus koleksi');
      }
    } catch (err) {
      console.error('Delete collection error:', err);
      alert('Terjadi kesalahan saat menghapus koleksi');
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleUpdateSuccess = (updated: MongoCollection) => {
    setCollection(updated);
    setPage(1);
  };

  const backdropUrl = collection.featuredBackdrop
    ? getImageUrl(collection.featuredBackdrop, 'original')
    : items[0]?.backdropPath
    ? getImageUrl(items[0].backdropPath, 'original')
    : null;

  // Convert CollectionItem to Movie / TVShow format for MovieCard
  const formattedItems: (Movie | TVShow)[] = items.map((item) => {
    const isTV = item.mediaType === 'tv';
    return {
      id: typeof item.id === 'string' ? (parseInt(item.id, 10) || 0) : item.id,
      title: item.title,
      name: item.title,
      media_type: item.mediaType,
      poster_path: item.posterPath || null,
      backdrop_path: item.backdropPath || null,
      release_date: !isTV ? item.releaseDate || '' : undefined,
      first_air_date: isTV ? item.releaseDate || '' : undefined,
      vote_average: item.rating || 0,
      overview: item.overview || '',
      customUrlPath: item.urlPath,
    } as any;
  });

  const totalPages = Math.max(1, Math.ceil(formattedItems.length / ITEMS_PER_PAGE));
  const paginatedItems = formattedItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
    <div className="min-h-screen pt-20 sm:pt-24 pb-16" style={{ background: '#050816' }}>
      
      {/* ── Hero Banner Header with Backdrop Overlay ── */}
      <div className="relative w-full overflow-hidden border-b border-white/10 bg-[#090e21] mb-8 sm:mb-12">
        {backdropUrl && (
          <div className="absolute inset-0 z-0">
            <img
              src={backdropUrl}
              alt={collection.title}
              className="w-full h-full object-cover opacity-20 filter blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090e21] via-[#090e21]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#090e21] via-transparent to-[#090e21]" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-12">
          {/* Back to Collections Link */}
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold mb-6 border border-white/10 transition-all"
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Daftar Koleksi</span>
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl">
              {/* Badges Bar */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  <Layers size={13} />
                  <span>{items.length} Judul Film & Series</span>
                </span>

                {yearSpan && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
                    <Calendar size={13} />
                    <span>{yearSpan}</span>
                  </span>
                )}
              </div>

              {/* Collection Title */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-3">
                {collection.title}
              </h1>

              {/* Description */}
              {collection.description && (
                <p className="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed mb-4 max-w-2xl">
                  {collection.description}
                </p>
              )}

              {/* Creator Metadata */}
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-[11px] font-black text-white shadow-md">
                    {collection.authorName ? collection.authorName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-slate-200 font-bold">
                    By {collection.authorName || 'Pengguna'}
                  </span>
                  {collection.authorRole === 'owner' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                      <Crown size={10} className="text-amber-400 fill-amber-400" />
                      <span>Owner</span>
                    </span>
                  ) : collection.authorRole === 'admin' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shadow-sm">
                      <ShieldCheck size={10} className="text-cyan-400" />
                      <span>Admin</span>
                    </span>
                  ) : null}
                </div>
                <span>•</span>
                <span>
                  Dibuat {new Date(collection.createdAt || Date.now()).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Action Buttons (Like/Dislike, Share, Edit, Delete) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Like / Dislike Buttons */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.06] border border-white/10">
                <button
                  type="button"
                  onClick={() => handleVote('like')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 active:scale-90 ${
                    collection.userVote === 'like'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.35)] scale-105'
                      : 'text-slate-300 hover:text-cyan-300 hover:bg-white/5 border border-transparent'
                  }`}
                  title={isLoggedIn ? 'Suka koleksi ini' : 'Login untuk menyukai'}
                >
                  <ThumbsUp
                    size={14}
                    className={`transition-transform duration-150 ${
                      collection.userVote === 'like'
                        ? 'fill-cyan-400 text-cyan-400 scale-110'
                        : 'group-hover:scale-110'
                    }`}
                  />
                  <span className="tabular-nums">{collection.likes || 0}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVote('dislike')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 active:scale-90 ${
                    collection.userVote === 'dislike'
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-400/80 shadow-[0_0_15px_rgba(244,63,94,0.35)] scale-105'
                      : 'text-slate-300 hover:text-rose-300 hover:bg-white/5 border border-transparent'
                  }`}
                  title={isLoggedIn ? 'Tidak suka koleksi ini' : 'Login untuk memberi tanggapan'}
                >
                  <ThumbsDown
                    size={14}
                    className={`transition-transform duration-150 ${
                      collection.userVote === 'dislike'
                        ? 'fill-rose-400 text-rose-400 scale-110'
                        : 'group-hover:scale-110'
                    }`}
                  />
                  <span className="tabular-nums">{collection.dislikes || 0}</span>
                </button>
              </div>

              {/* Share Button (Opens Share Modal) */}
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-xs sm:text-sm border border-white/10 transition-all flex items-center gap-2"
              >
                <Share2 size={15} />
                <span>Bagikan</span>
              </button>

              {/* Edit Button (Owner of collection only) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs sm:text-sm border border-cyan-500/40 transition-all flex items-center gap-1.5"
                >
                  <Edit3 size={15} />
                  <span>Edit</span>
                </button>
              )}

              {/* Delete Button (Owner of collection OR Admin/Owner force delete) */}
              {(isOwner || user?.role === 'owner' || user?.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs sm:text-sm border border-red-500/40 transition-all flex items-center gap-1.5 shadow-sm"
                  title={!isOwner ? 'Hapus paksa (Hak Akses Moderator/Admin)' : 'Hapus Koleksi'}
                >
                  <Trash2 size={15} />
                  <span>{!isOwner ? (user?.role === 'owner' ? 'Hapus (Owner)' : 'Hapus (Admin)') : 'Hapus'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Movie & TV Shows Grid (Homepage Layout) ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        {/* Clean Heading without icon */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            Daftar Koleksi
          </h2>
          <span className="text-xs text-slate-400 font-bold">
            Total {formattedItems.length} Judul
          </span>
        </div>

        {formattedItems.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#090e21] border border-white/10 text-center">
            <Film size={36} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              Belum ada judul film atau series dalam koleksi ini.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
              {paginatedItems.map((item, index) => {
                const isTV = (item as any).media_type === 'tv';
                return (
                  <div key={`${item.id}-${index}`} className="relative group">
                    <MovieCard item={item} type={isTV ? 'tv' : 'movie'} />
                  </div>
                );
              })}
            </div>

            {/* ── Item Pagination Controls ── */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
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
                        window.scrollTo({ top: 400, behavior: 'smooth' });
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
                    window.scrollTo({ top: 400, behavior: 'smooth' });
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
      </div>

      {/* ── Share Collection Modal ── */}
      <ShareCollectionModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={collection.title}
        itemCount={items.length}
      />

      {/* ── Edit Collection Modal ── */}
      {isOwner && (
        <CreateCollectionModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={handleUpdateSuccess}
          initialData={{
            id: collection.slug || (collection._id as any),
            title: collection.title,
            description: collection.description || '',
            items: collection.items || [],
            isPublic: collection.isPublic !== false,
          }}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md rounded-3xl bg-[#090e21] border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)] p-6 sm:p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_25px_rgba(239,68,68,0.25)]">
              <AlertTriangle size={32} />
            </div>

            <h3 className="text-xl font-black text-white mb-2">
              Hapus Koleksi Ini?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              Koleksi &quot;<span className="text-white font-bold">{collection.title}</span>&quot; akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                className="w-full sm:w-1/2 px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-slate-300 font-semibold text-xs sm:text-sm transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full sm:w-1/2 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Login Prompt Modal ── */}
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
              Silakan login ke akunmu untuk memberikan Like atau Dislike pada koleksi ini.
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
                href={`/login?redirect=/collections/${collection.slug || collection._id}`}
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
  );
}
