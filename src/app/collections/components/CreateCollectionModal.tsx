'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Plus,
  Trash2,
  Sparkles,
  Film,
  Tv,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
} from 'lucide-react';
import { CollectionItem } from '@/lib/mongodb/collectionService';
import { searchMulti, getImageUrl } from '@/lib/tmdb';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (collection: any) => void;
  initialData?: {
    id?: string;
    title: string;
    description: string;
    items: CollectionItem[];
    isPublic: boolean;
  };
}

export default function CreateCollectionModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CreateCollectionModalProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [items, setItems] = useState<CollectionItem[]>(initialData?.items || []);
  const [isPublic, setIsPublic] = useState(initialData?.isPublic !== false);

  // TMDB search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(initialData?.id);

  // Reset form when modal is reopened for new collection
  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setItems(initialData?.items || []);
      setIsPublic(initialData?.isPublic !== false);
      setSearchQuery('');
      setSearchResults([]);
      setErrorMessage(null);
    }
  }, [isOpen, initialData]);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced TMDB search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchMulti(searchQuery.trim(), 1);
        const validResults = (res.results || []).filter(
          (item: any) =>
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            (item.title || item.name)
        );
        setSearchResults(validResults.slice(0, 10));
        setSearchOpen(true);
      } catch (err) {
        console.error('TMDB Search error in collection modal:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate year range
  const years = items
    .map((item) => (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : null))
    .filter((y): y is number => y !== null && !isNaN(y) && y > 1800)
    .sort((a, b) => a - b);

  const yearRange =
    years.length > 1
      ? `${years[0]} · ${years[years.length - 1]}`
      : years.length === 1
      ? `${years[0]}`
      : '-';

  const handleAddItem = (result: any) => {
    const isTV = result.media_type === 'tv';
    const itemId = result.id;
    const mediaType = isTV ? 'tv' : 'movie';

    // Check if already in collection
    const exists = items.some(
      (item) => String(item.id) === String(itemId) && item.mediaType === mediaType
    );
    if (exists) {
      setErrorMessage(`"${result.title || result.name}" sudah ada di dalam koleksi`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const newItem: CollectionItem = {
      id: itemId,
      mediaType,
      title: (result.title || result.name || '').trim(),
      posterPath: result.poster_path || null,
      backdropPath: result.backdrop_path || null,
      releaseDate: result.release_date || result.first_air_date || '',
      rating: typeof result.vote_average === 'number' ? result.vote_average : undefined,
      overview: result.overview || '',
      urlPath: isTV ? `/tv/${itemId}` : `/movie/${itemId}`,
    };

    setItems((prev) => [...prev, newItem]);
    setSearchQuery('');
    setSearchOpen(false);
    setErrorMessage(null);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Judul koleksi wajib diisi.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Koleksi harus memiliki minimal 1 judul film atau series.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const endpoint = isEditing ? `/api/collections/${initialData?.id}` : '/api/collections';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          items,
          isPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan koleksi');
      }

      onSuccess(data.collection);
      onClose();
    } catch (err: any) {
      console.error('Submit collection error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#090e21] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-white/10 flex-shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isEditing ? 'Edit Koleksi' : 'Buat Koleksi Baru'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Susun dan kurasi film & series favoritmu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Judul Koleksi */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-1.5">
              Judul Koleksi <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Misal: Marvel Cinematic Universe, Drakor Romantis Terbaik, Film Nolan..."
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>

          {/* 2. Deskripsi (Opsional) */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-1.5">
              Deskripsi Koleksi <span className="text-slate-500 text-xs">(Opsional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan sedikit tentang koleksi film/series yang kamu buat..."
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
            />
          </div>

          {/* 3. Search & Add Movie / TV Shows */}
          <div ref={searchContainerRef} className="relative">
            <label className="block text-xs sm:text-sm font-bold text-slate-200 mb-1.5">
              Cari & Tambahkan Judul Film / TV Series <span className="text-cyan-400">*</span>
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchOpen(true);
                }}
                placeholder="Ketik judul film/series untuk menambahkan..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              {searching && (
                <Loader2
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin"
                />
              )}
            </div>

            {/* Search Dropdown Results */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl bg-[#0b1020] border border-cyan-500/30 shadow-[0_15px_35px_rgba(0,0,0,0.8)] divide-y divide-white/5">
                {searchResults.map((result) => {
                  const isTV = result.media_type === 'tv';
                  const itemTitle = result.title || result.name;
                  const itemDate = result.release_date || result.first_air_date || '';
                  const itemYear = itemDate ? itemDate.substring(0, 4) : '';
                  const posterUrl = result.poster_path ? getImageUrl(result.poster_path, 'w92') : null;
                  const isAdded = items.some(
                    (i) => String(i.id) === String(result.id) && i.mediaType === (isTV ? 'tv' : 'movie')
                  );

                  return (
                    <button
                      key={`${result.media_type}-${result.id}`}
                      type="button"
                      onClick={() => handleAddItem(result)}
                      disabled={isAdded}
                      className={`w-full p-2.5 sm:p-3 flex items-center justify-between text-left transition-colors ${
                        isAdded
                          ? 'opacity-50 cursor-not-allowed bg-white/[0.02]'
                          : 'hover:bg-cyan-500/10 active:bg-cyan-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={itemTitle}
                            className="w-9 h-13 rounded-lg object-cover flex-shrink-0 bg-slate-800"
                          />
                        ) : (
                          <div className="w-9 h-13 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 flex-shrink-0">
                            {isTV ? <Tv size={16} /> : <Film size={16} />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {itemTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                isTV ? 'bg-pink-500/20 text-pink-300' : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {isTV ? 'TV Series' : 'Movie'}
                            </span>
                            {itemYear && (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {itemYear}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ml-3 flex-shrink-0">
                        {isAdded ? (
                          <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            <span>Ditambahkan</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-bold text-xs flex items-center gap-1 transition-all">
                            <Plus size={13} />
                            <span>Tambah</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. List of Added Items & Meta Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  Daftar Judul Koleksi
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black">
                  {items.length} judul
                </span>
              </div>
              {items.length > 0 && (
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Calendar size={12} className="text-cyan-400" />
                  <span>Rentang: {yearRange}</span>
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                <Film size={28} className="mx-auto text-slate-500 mb-2 opacity-60" />
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  Belum ada judul yang ditambahkan ke koleksi ini.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Gunakan kolom pencarian di atas untuk mencari dan menambahkan film & TV series.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((item, index) => {
                  const posterUrl = item.posterPath ? getImageUrl(item.posterPath, 'w92') : null;
                  const itemYear = item.releaseDate ? item.releaseDate.substring(0, 4) : '';

                  return (
                    <div
                      key={`${item.mediaType}-${item.id}-${index}`}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-xs font-black text-slate-500 flex-shrink-0">
                          {index + 1}
                        </span>
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={item.title}
                            className="w-8 h-11 rounded-lg object-cover flex-shrink-0 bg-slate-800"
                          />
                        ) : (
                          <div className="w-8 h-11 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 flex-shrink-0">
                            {item.mediaType === 'tv' ? <Tv size={14} /> : <Film size={14} />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                item.mediaType === 'tv'
                                  ? 'bg-pink-500/20 text-pink-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {item.mediaType === 'tv' ? 'TV Series' : 'Movie'}
                            </span>
                            {itemYear && (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {itemYear}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors ml-2 flex-shrink-0"
                        title="Hapus dari koleksi"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Footer Actions */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || items.length === 0 || !title.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{isEditing ? 'Simpan Perubahan' : 'Publikasikan Koleksi'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
