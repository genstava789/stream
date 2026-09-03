import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Film,
  Tv,
  Plus,
  Sparkles,
  Search,
  X,
  Star,
  CheckCircle,
  Play,
  ImageIcon,
  Check,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { DraftSeason, TMDBPreviewData, MovieItem, TVShowItem } from '../types';
import { BackdropPicker } from './BackdropPicker';
import { cleanVideoUrl, isValidVideoUrl, extractTmdbIdAndType } from '@/lib/urls';

interface TMDBLiveSearchResult {
  id: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: string | null;
  rating: number | null;
  originalLanguage?: string | null;
  mediaType: string;
}

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'movie' | 'tv_show' | 'tv_episode';
  setContentType: (t: 'movie' | 'tv_show' | 'tv_episode') => void;
  quickAddContext?: {
    show: TVShowItem;
    seasonSlug: string;
  } | null;
  onSubmit: (payload: any) => Promise<void>;
  movies: MovieItem[];
  tvShows: TVShowItem[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  isOpen,
  onClose,
  contentType,
  quickAddContext,
  onSubmit,
  tvShows,
  showToast,
}) => {
  const [formTmdbId, setFormTmdbId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formPoster, setFormPoster] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRating, setFormRating] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formTrending, setFormTrending] = useState(false);
  const [formLanguage, setFormLanguage] = useState('ID');
  const [formWeight, setFormWeight] = useState('');
  const [formSubtitles, setFormSubtitles] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formTvShowSlug, setFormTvShowSlug] = useState('');
  const [formSeasonNum, setFormSeasonNum] = useState('s1');
  const [formEpisodeNum, setFormEpisodeNum] = useState('e1');

  // Multi-season episodes for TV Series
  const [formSeasons, setFormSeasons] = useState<DraftSeason[]>([
    {
      id: 's1',
      season: 's1',
      episodes: [
        {
          id: 'e1',
          episode: 'e1',
          videourl: '',
          title: 'Episode 1',
          image_url: '',
        },
      ],
    },
  ]);

  // Live TMDB Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBLiveSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTmdbResult, setSelectedTmdbResult] = useState<TMDBLiveSearchResult | null>(null);

  // TMDB Live Preview & Backdrops
  const [tmdbPreview, setTmdbPreview] = useState<TMDBPreviewData | null>(null);
  const [fetchingTmdb, setFetchingTmdb] = useState(false);
  const [showSeriesBackdropPicker, setShowSeriesBackdropPicker] = useState(false);
  const [activeEpisodeBackdropId, setActiveEpisodeBackdropId] = useState<string | null>(null);
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [batchSeasonId, setBatchSeasonId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons((prev) => ({
      ...prev,
      [seasonId]: !prev[seasonId],
    }));
  };

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      setFormTmdbId('');
      setFormTitle('');
      setFormSlug('');
      setFormVideoUrl('');
      setFormPoster('');
      setFormDesc('');
      setFormRating('');
      setFormFeatured(false);
      setFormTrending(false);
      setFormLanguage('ID');
      setFormWeight('');
      setFormSubtitles('');
      setFormDuration('');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedTmdbResult(null);
      setTmdbPreview(null);
      setShowSeriesBackdropPicker(false);
      setActiveEpisodeBackdropId(null);
      setBatchUrlsInput('');
      setBatchSeasonId(null);
      setFormErrors({});
      setExpandedSeasons({});
      if (contentType === 'tv_episode' && quickAddContext) {
        setFormTvShowSlug(quickAddContext.show.showSlug);
        setFormSeasonNum(quickAddContext.seasonSlug);
        const targetSeasonSlug = quickAddContext.seasonSlug.toLowerCase();
        const existingCount = (quickAddContext.show.episodes || []).filter(
          (ep) => (ep.seasonFolder || 's1').toLowerCase() === targetSeasonSlug
        ).length;
        const nextNum = existingCount + 1;
        setFormEpisodeNum(`e${nextNum}`);
        setFormTitle(`Episode ${nextNum}`);
        setFormPoster(quickAddContext.show.posterUrl || quickAddContext.show.frontmatter?.image_url || '');
      }

      setFormSeasons([
        {
          id: 's1',
          season: 's1',
          episodes: [
            {
              id: 'e1',
              episode: 'e1',
              videourl: '',
              title: 'Episode 1',
              image_url: '',
            },
          ],
        },
      ]);
    }
  }, [isOpen, contentType, quickAddContext]);

  // Debounced Live TMDB Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const type = contentType === 'tv_show' ? 'tv' : 'movie';
        const res = await fetch(
          `/api/admin/tmdb-search?query=${encodeURIComponent(searchQuery.trim())}&type=${type}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, contentType]);

  if (!isOpen) return null;

  const handleSelectSearchResult = async (item: TMDBLiveSearchResult) => {
    setSelectedTmdbResult(item);
    setFormTmdbId(String(item.id));
    setSearchResults([]);
    setSearchQuery('');
    await handleApplyTmdbToForm(String(item.id));
  };

  const handleApplyTmdbToForm = async (explicitId?: string) => {
    const rawId = explicitId || (selectedTmdbResult ? selectedTmdbResult.id : formTmdbId);
    if (!rawId) return;

    const extracted = extractTmdbIdAndType(String(rawId));
    const idToFetch = extracted.id || String(rawId).trim();
    if (!idToFetch) return;

    const type = contentType === 'tv_show' ? 'tv' : 'movie';

    setFetchingTmdb(true);
    try {
      const res = await fetch(
        `/api/admin/tmdb-preview?id=${encodeURIComponent(String(idToFetch))}&type=${type}&include_images=true`
      );
      if (res.ok) {
        const data: TMDBPreviewData = await res.json();
        setTmdbPreview(data);
        if (data.title) setFormTitle(data.title);
        if (data.overview) setFormDesc(data.overview);
        if (data.posterUrl) setFormPoster(data.posterUrl);
        if (data.rating) setFormRating(String(data.rating));
        if (data.originalLanguage) {
          const l = data.originalLanguage.toLowerCase().trim();
          if (l === 'id' || l === 'ind') setFormLanguage('ID');
          else if (l === 'ms' || l === 'zlm' || l === 'mly') setFormLanguage('MS');
          else if (l === 'ko' || l === 'kr' || l === 'kor') setFormLanguage('KR');
          else if (l === 'en' || l === 'eng') setFormLanguage('EN');
          else if (l === 'ja' || l === 'jp' || l === 'jpn') {
            const isAnime = data.genres?.some((g) => g.toLowerCase().includes('animation') || g.toLowerCase().includes('anime'));
            setFormLanguage(isAnime ? 'ANIME' : 'JP');
          } else if (l === 'th' || l === 'tha') setFormLanguage('TH');
          else if (l === 'zh' || l === 'cn' || l === 'zho' || l === 'chi' || l === 'yue') setFormLanguage('CN');
          else setFormLanguage(data.originalLanguage.toUpperCase().slice(0, 2));
        }
        showToast(`Metadata & Bahasa (${data.originalLanguage?.toUpperCase() || 'ID'}) berhasil diterapkan ke form!`);
      } else {
        if (selectedTmdbResult) {
          setFormTitle(selectedTmdbResult.title);
          setFormDesc(selectedTmdbResult.overview);
          if (selectedTmdbResult.posterUrl) setFormPoster(selectedTmdbResult.posterUrl);
          if (selectedTmdbResult.rating) setFormRating(String(selectedTmdbResult.rating));
          if (selectedTmdbResult.originalLanguage) {
            const l = selectedTmdbResult.originalLanguage.toLowerCase().trim();
            if (l === 'id' || l === 'ind') setFormLanguage('ID');
            else if (l === 'ms' || l === 'zlm' || l === 'mly') setFormLanguage('MS');
            else if (l === 'ko' || l === 'kr' || l === 'kor') setFormLanguage('KR');
            else if (l === 'en' || l === 'eng') setFormLanguage('EN');
            else if (l === 'ja' || l === 'jp' || l === 'jpn') setFormLanguage('JP');
            else if (l === 'th' || l === 'tha') setFormLanguage('TH');
            else if (l === 'zh' || l === 'cn' || l === 'zho' || l === 'chi' || l === 'yue') setFormLanguage('CN');
            else setFormLanguage(selectedTmdbResult.originalLanguage.toUpperCase().slice(0, 2));
          }
          showToast('Data pencarian TMDB diterapkan ke form!');
        }
      }
    } catch {
      showToast('Gagal memuat detail TMDB', 'error');
    } finally {
      setFetchingTmdb(false);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (contentType === 'movie') {
      if (!formTmdbId) errors.formTmdbId = 'TMDB ID wajib diisi';
      if (!formVideoUrl) {
        errors.formVideoUrl = 'URL Video wajib diisi';
      } else if (!isValidVideoUrl(formVideoUrl)) {
        errors.formVideoUrl = 'URL Video harus diawali https://';
      }
    } else if (contentType === 'tv_show') {
      if (!formTmdbId) errors.formTmdbId = 'TMDB ID wajib diisi';
      for (const s of formSeasons) {
        for (const ep of s.episodes) {
          if (ep.videourl && !isValidVideoUrl(ep.videourl)) {
            errors[`ep_video_${ep.id}`] = `URL Video untuk ${ep.episode || ep.title} harus diawali https://`;
          }
        }
      }
    } else if (contentType === 'tv_episode') {
      if (!formTvShowSlug) errors.formTvShowSlug = 'TV Series wajib dipilih';
      if (!formVideoUrl) {
        errors.formVideoUrl = 'URL Video wajib diisi';
      } else if (!isValidVideoUrl(formVideoUrl)) {
        errors.formVideoUrl = 'URL Video harus diawali https://';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Mohon perbaiki data input yang tidak valid', 'error');
      return;
    }

    setSubmitting(true);
    try {
      setSubmitError(null);
      const payload: any = {
        type: contentType,
        tmdb_id: formTmdbId,
        title: formTitle,
        slug: formSlug,
        videourl: formVideoUrl,
        poster: formPoster,
        image_url: formPoster,
        desc: formDesc,
        rating: formRating,
        featured: formFeatured,
        trending: formTrending,
        language: formLanguage,
        weight: formWeight ? Number(formWeight) : undefined,
        subtitles: formSubtitles,
        duration: formDuration,
        showSlug: formTvShowSlug,
        season: formSeasonNum,
        episode: formEpisodeNum,
        seasons: formSeasons,
      };
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Gagal membuat konten';
      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyBatchUrls = (seasonId: string) => {
    if (!batchUrlsInput.trim()) return;
    const lines = batchUrlsInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    setFormSeasons((prev) =>
      prev.map((s) => {
        if (s.id !== seasonId) return s;
        const currentEps = s.episodes || [];
        const totalCount = Math.max(currentEps.length, lines.length);
        const updatedEps = [];

        for (let i = 0; i < totalCount; i++) {
          const epNum = i + 1;
          const lineUrl = i < lines.length ? cleanVideoUrl(lines[i]) || lines[i] : null;
          const existingEp = currentEps[i];

          if (existingEp) {
            updatedEps.push({
              ...existingEp,
              videourl: lineUrl !== null ? lineUrl : existingEp.videourl,
            });
          } else {
            updatedEps.push({
              id: `ep_batch_${Date.now()}_${epNum}`,
              episode: `e${epNum}`,
              videourl: lineUrl || '',
              title: `Episode ${epNum}`,
              image_url: formPoster || '',
            });
          }
        }
        return { ...s, episodes: updatedEps };
      })
    );

    setBatchUrlsInput('');
    setBatchSeasonId(null);
    showToast(`${lines.length} URL video berhasil diterapkan dari baris 1 s/d ${lines.length}!`, 'success');
  };

  const modalTitle =
    contentType === 'movie'
      ? 'Tambah Movie Baru'
      : contentType === 'tv_show'
      ? 'Tambah TV Series Baru'
      : 'Tambah Episode Baru';

  const modalIcon =
    contentType === 'movie' ? (
      <Film size={18} />
    ) : contentType === 'tv_show' ? (
      <Tv size={18} />
    ) : (
      <Play size={18} />
    );

  const themeColor =
    contentType === 'movie'
      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      : contentType === 'tv_show'
      ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
      : 'bg-purple-500/20 text-purple-400 border-purple-500/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-[#0b1329] border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Dedicated Modal Header (No duplicate tabs) */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-white/10 bg-[#090e1f]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${themeColor}`}>
              {modalIcon}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">{modalTitle}</h2>
              <p className="text-[11px] text-slate-400">
                {contentType === 'movie'
                  ? 'Isi detail film, streaming video URL, dan metadata TMDB.'
                  : contentType === 'tv_show'
                  ? 'Isi metadata series, kelola judul episode, dan daftar season.'
                  : 'Tambahkan episode baru ke TV Series.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Error Alert Banner */}
          {submitError && (
            <div className="p-3.5 rounded-xl bg-red-950/95 border border-red-500/60 text-red-200 text-xs font-semibold flex items-center justify-between gap-3 shadow-xl animate-shake">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="text-red-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Live TMDB Search Bar (For Movies and TV Series) */}
          {contentType !== 'tv_episode' && (
            <div className="p-3 sm:p-4 rounded-xl bg-[#080d1e] border border-cyan-500/25 space-y-3">
              <label className="block text-xs font-bold text-cyan-300">
                Pencarian Live TMDB (Ketik Judul {contentType === 'movie' ? 'Film' : 'Series'})
              </label>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Cari judul ${contentType === 'movie' ? 'film' : 'series'} di TMDB...`}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-black/60 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all min-h-[42px]"
                />
                {searching && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Sparkles size={16} className="animate-spin text-cyan-400" />
                  </div>
                )}
              </div>

              {/* Live Search Results Dropdown / List */}
              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-white/10 rounded-xl p-2 bg-black/70">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                    Hasil Pencarian ({searchResults.length}) - Klik untuk memilih:
                  </span>
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSearchResult(item)}
                      className="p-2 rounded-lg bg-[#0c1328] hover:bg-cyan-950/50 border border-white/5 hover:border-cyan-500/40 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.posterUrl ? (
                          <div className="relative w-8 h-11 rounded overflow-hidden flex-shrink-0 bg-slate-900">
                            <Image
                              src={item.posterUrl}
                              alt={item.title}
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-11 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500 text-[10px]">
                            {contentType === 'movie' ? <Film size={14} /> : <Tv size={14} />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                            {item.title}{' '}
                            {item.year ? <span className="text-slate-400 font-normal">({item.year})</span> : ''}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono text-cyan-400">ID: {item.id}</span>
                            {item.rating ? (
                              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                <Star size={10} fill="currentColor" /> {item.rating}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500 group-hover:text-black transition-all flex-shrink-0"
                      >
                        Pilih
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected TMDB Item Preview Box (Does NOT auto-overwrite form until clicked) */}
              {selectedTmdbResult && (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedTmdbResult.posterUrl && (
                      <div className="relative w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900 border border-cyan-500/30">
                        <Image
                          src={selectedTmdbResult.posterUrl}
                          alt={selectedTmdbResult.title}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300">
                          TMDB ID: {selectedTmdbResult.id}
                        </span>
                        {selectedTmdbResult.year && (
                          <span className="text-[10px] text-slate-400">({selectedTmdbResult.year})</span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {selectedTmdbResult.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {selectedTmdbResult.overview || 'Tidak ada deskripsi'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyTmdbToForm()}
                    disabled={fetchingTmdb}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 flex-shrink-0"
                  >
                    <Check size={14} />
                    <span>{fetchingTmdb ? 'Menerapkan...' : 'Terapkan Metadata ke Form'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TMDB ID */}
          {contentType !== 'tv_episode' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                TMDB ID <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formTmdbId}
                  onChange={(e) => setFormTmdbId(e.target.value)}
                  placeholder="Contoh: 1671701"
                  className={`flex-1 px-3.5 py-2.5 sm:py-3 bg-black/50 border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none min-h-[42px] ${
                    formErrors.formTmdbId ? 'border-red-500' : 'border-white/10 focus:border-cyan-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    handleApplyTmdbToForm(formTmdbId);
                  }}
                  disabled={fetchingTmdb || !formTmdbId.trim()}
                  className="px-4 py-2.5 sm:py-3 rounded-xl text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-all disabled:opacity-50 min-h-[42px] flex-shrink-0"
                  title="Cek TMDB & Auto-fill Metadata dan Bahasa"
                >
                  <Sparkles size={14} className={fetchingTmdb ? 'animate-spin' : ''} />
                  <span>{fetchingTmdb ? 'Memuat...' : 'Cek TMDB'}</span>
                </button>
              </div>
              {formErrors.formTmdbId && (
                <p className="text-[10px] text-red-400">{formErrors.formTmdbId}</p>
              )}
            </div>
          )}

          {/* Episode Parent Show & Locked Season Info (No Select Needed When Adding From Season) */}
          {contentType === 'tv_episode' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-black/50 to-pink-950/30 border border-purple-500/30 space-y-3 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center flex-shrink-0 text-pink-400">
                    <Tv size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-400 block">
                      Serial Induk
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {quickAddContext?.show?.displayTitle || quickAddContext?.show?.frontmatter?.title || formTvShowSlug || 'Series'}
                    </h4>
                  </div>
                </div>

                {/* Locked Season & Episode Badges */}
                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  <div className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1.5 shadow-sm capitalize">
                    <Lock size={12} className="text-pink-400" />
                    <span>Season {formSeasonNum.replace(/\D/g, '') || formSeasonNum}</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono shadow-sm">
                    {formEpisodeNum.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Nomor Episode
                  </label>
                  <input
                    type="text"
                    value={formEpisodeNum}
                    onChange={(e) => setFormEpisodeNum(e.target.value)}
                    placeholder="e1"
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-cyan-500 min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Judul Episode <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Episode 1..."
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white capitalize focus:outline-none focus:border-pink-500 min-h-[40px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Title & Slug (For Movie & TV Show) */}
          {contentType !== 'tv_episode' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {contentType === 'tv_show' ? 'Judul TV Series' : 'Judul Konten'}
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={contentType === 'tv_show' ? 'Judul TV Series' : 'Judul Film'}
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Custom Slug (Opsional)
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="nama-slug-kustom"
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono min-h-[42px]"
                />
              </div>
            </div>
          )}

          {/* Movie / Episode Video Stream URL */}
          {contentType !== 'tv_show' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                URL Video Stream (MP4 / MKV / HLS .m3u8) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formVideoUrl}
                onChange={(e) => setFormVideoUrl(e.target.value)}
                placeholder="https://server.com/video.mp4 atau .m3u8"
                className={`w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none font-mono min-h-[42px] ${
                  formErrors.formVideoUrl
                    ? 'border-red-500'
                    : 'border-white/10 focus:border-cyan-500'
                }`}
              />
              {formErrors.formVideoUrl && (
                <p className="text-[10px] text-red-400 mt-1">{formErrors.formVideoUrl}</p>
              )}
            </div>
          )}

          {/* Player / Generic Content Thumbnail Image (image_url) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Image Player & Generic Content (image_url)
              </label>
              {tmdbPreview?.backdrops && tmdbPreview.backdrops.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSeriesBackdropPicker(!showSeriesBackdropPicker)}
                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <ImageIcon size={12} />
                  <span>
                    {showSeriesBackdropPicker ? 'Tutup Galeri' : `Pilih dari Galeri (${tmdbPreview.backdrops.length})`}
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {formPoster && (
                <div className="relative w-12 h-8 rounded-lg overflow-hidden border border-cyan-500/40 flex-shrink-0 bg-black/60">
                  <Image
                    src={formPoster}
                    alt="Series Poster"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <input
                type="text"
                value={formPoster}
                onChange={(e) => setFormPoster(e.target.value)}
                placeholder="https://image.tmdb.org/t/p/... atau URL gambar kustom"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
              />
              {formPoster && (
                <button
                  type="button"
                  onClick={() => setFormPoster('')}
                  className="p-2 text-slate-400 hover:text-red-400"
                  title="Hapus Image"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Khusus digunakan untuk poster video player & JSON-LD thumbnailUrl (tidak mengubah poster utama di homepage).
            </p>

            {showSeriesBackdropPicker && tmdbPreview?.backdrops && (
              <BackdropPicker
                backdrops={tmdbPreview.backdrops}
                selectedUrl={formPoster}
                title="Pilih Backdrop untuk Player Series"
                onSelect={(url) => {
                  setFormPoster(url);
                  setShowSeriesBackdropPicker(false);
                  showToast('Backdrop series diterapkan!');
                }}
                onClose={() => setShowSeriesBackdropPicker(false)}
              />
            )}
          </div>

          {/* Rating, Language, Weight, Subtitles */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Rating (0 - 10)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={formRating}
                onChange={(e) => setFormRating(e.target.value)}
                placeholder="8.5"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Bahasa (Language)</label>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
              >
                <option value="ID">ID - Indonesia</option>
                <option value="MS">MS - Melayu / Malaysia</option>
                <option value="KR">KR - Korea (Drakor)</option>
                <option value="EN">EN - English (Barat)</option>
                <option value="JP">JP - Jepang (Live Action / Biasa)</option>
                <option value="ANIME">ANIME - Jepang (Anime)</option>
                <option value="TH">TH - Thailand</option>
                <option value="CN">CN - China / Mandarin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Weight Prioritas
              </label>
              <input
                type="number"
                min="1"
                max="9999"
                value={formWeight}
                onChange={(e) => setFormWeight(e.target.value)}
                placeholder="Urutan (1, 2, ..)"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                title="Angka lebih kecil = urutan lebih prioritas/paling depan di section"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Subtitles (VTT/SRT)</label>
              <input
                type="text"
                value={formSubtitles}
                onChange={(e) => setFormSubtitles(e.target.value)}
                placeholder="https://server.com/sub.vtt"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-mono min-h-[42px]"
              />
            </div>
          </div>

          {/* Featured & Trending Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-black/30 border border-white/5 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formFeatured}
                onChange={(e) => setFormFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-black/50 border-white/20"
              />
              <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1">
                <Star size={14} fill="currentColor" /> Featured Hero Carousel
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formTrending}
                onChange={(e) => setFormTrending(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-black/50 border-white/20"
              />
              <span className="text-xs sm:text-sm font-bold text-rose-400 flex items-center gap-1">
                🔥 Trending Section (Home)
              </span>
            </label>
          </div>

          {/* Overview / Deskripsi */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Deskripsi / Sinopsis
            </label>
            <textarea
              rows={3}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Sinopsis singkat..."
              className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* TV Series Multi-Season Episode Creator with Title & URL Controls */}
          {contentType === 'tv_show' && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Tv size={15} className="text-pink-400" />
                  <span className="text-xs sm:text-sm font-bold text-white">Kelola Season & Episode</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormSeasons((prev) => [
                      ...prev,
                      {
                        id: `s${prev.length + 1}`,
                        season: `s${prev.length + 1}`,
                        episodes: [
                          {
                            id: `e1_${Date.now()}`,
                            episode: 'e1',
                            videourl: '',
                            title: 'Episode 1',
                            image_url: formPoster || '',
                          },
                        ],
                      },
                    ])
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1"
                >
                  <Plus size={12} /> Tambah Season
                </button>
              </div>

              {formSeasons.map((season, sIdx) => {
                const isBatchOpen = batchSeasonId === season.id;
                const isExpanded = Boolean(expandedSeasons[season.id]);
                return (
                  <div
                    key={season.id}
                    className="p-3 sm:p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-3 transition-all"
                  >
                    <div
                      onClick={() => toggleSeason(season.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none p-2 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-slate-300">
                          {isExpanded ? (
                            <ChevronDown size={15} className="text-pink-400 transition-transform" />
                          ) : (
                            <ChevronRight size={15} className="text-slate-400 transition-transform" />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-extrabold text-pink-300 capitalize tracking-tight">
                          Season {sIdx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                          {season.episodes.length} Episode
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isExpanded) toggleSeason(season.id);
                            setBatchSeasonId(isBatchOpen ? null : season.id);
                          }}
                          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
                        >
                          {isBatchOpen ? 'Tutup Batch Paste' : 'Batch Paste URLs'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isExpanded) toggleSeason(season.id);
                            setFormSeasons((prev) =>
                              prev.map((s) =>
                                s.id === season.id
                                  ? {
                                      ...s,
                                      episodes: [
                                        ...s.episodes,
                                        {
                                          id: `ep_${Date.now()}_${s.episodes.length + 1}`,
                                          episode: `e${s.episodes.length + 1}`,
                                          videourl: '',
                                          title: `Episode ${s.episodes.length + 1}`,
                                          image_url: formPoster || '',
                                        },
                                      ],
                                    }
                                  : s
                              )
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 flex items-center gap-1 transition-all capitalize active:scale-95"
                        >
                          <Plus size={11} />
                          <span>Tambah Episode</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && isBatchOpen && (
                      <div className="p-3 sm:p-3.5 rounded-xl bg-black/70 border border-cyan-500/30 space-y-2.5 animate-fade-in shadow-inner">
                        <label className="block text-xs font-bold text-cyan-300">
                          Paste URL Video Stream (1 URL per baris — Baris 1 mengisi Ep 1, Baris 2 mengisi Ep 2, dst)
                        </label>
                        <textarea
                          rows={4}
                          value={batchUrlsInput}
                          onChange={(e) => setBatchUrlsInput(e.target.value)}
                          placeholder={`https://server.com/s${sIdx + 1}-e1.mp4\nhttps://server.com/s${sIdx + 1}-e2.mp4\nhttps://server.com/s${sIdx + 1}-e3.mp4`}
                          className="w-full p-2.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">
                            {batchUrlsInput.split('\n').filter((l) => l.trim()).length} baris URL terdeteksi
                          </span>
                          <div className="flex gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setBatchSeasonId(null)}
                              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyBatchUrls(season.id)}
                              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-md shadow-md"
                            >
                              Terapkan ke Season {sIdx + 1}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Individual Episode Rows */}
                    {isExpanded && (
                      <>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                          {season.episodes.map((ep, eIdx) => (
                            <div
                              key={ep.id}
                              className="p-3 sm:p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2.5 hover:border-pink-500/30 transition-all"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="w-8 text-center font-mono text-xs font-black text-pink-400 bg-pink-500/10 rounded-lg py-1.5 border border-pink-500/20">
                                    {ep.episode.toUpperCase()}
                                  </span>
                                  <input
                                    type="text"
                                    value={ep.title}
                                    onChange={(e) =>
                                      setFormSeasons((prev) =>
                                        prev.map((s) =>
                                          s.id === season.id
                                            ? {
                                                ...s,
                                                episodes: s.episodes.map((item) =>
                                                  item.id === ep.id
                                                    ? { ...item, title: e.target.value }
                                                    : item
                                                ),
                                              }
                                            : s
                                        )
                                      )
                                    }
                                    placeholder={`Judul Episode ${eIdx + 1}`}
                                    className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-pink-400 flex-1 min-h-[36px] capitalize"
                                  />
                                </div>

                                {season.episodes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFormSeasons((prev) =>
                                        prev.map((s) =>
                                          s.id === season.id
                                            ? {
                                                ...s,
                                                episodes: s.episodes.filter((item) => item.id !== ep.id),
                                              }
                                            : s
                                        )
                                      )
                                    }
                                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    title="Hapus Episode"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[11px] text-slate-400 font-bold mb-1">
                                    URL Video Stream <span className="text-red-400">*</span>
                                  </label>
                                  <div className="flex items-center gap-1.5 bg-black/70 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-400 min-h-[38px]">
                                    <Play size={12} className="text-cyan-400 flex-shrink-0" />
                                    <input
                                      type="text"
                                      value={ep.videourl}
                                      onChange={(e) =>
                                        setFormSeasons((prev) =>
                                          prev.map((s) =>
                                            s.id === season.id
                                              ? {
                                                  ...s,
                                                  episodes: s.episodes.map((item) =>
                                                    item.id === ep.id
                                                      ? { ...item, videourl: e.target.value }
                                                      : item
                                                  ),
                                                }
                                              : s
                                          )
                                        )
                                      }
                                      placeholder="https://server.com/video.mp4"
                                      className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                                    />
                                  </div>
                                  {formErrors[`ep_video_${ep.id}`] && (
                                    <p className="text-[10px] text-red-400 mt-0.5">{formErrors[`ep_video_${ep.id}`]}</p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] text-slate-400 font-bold">
                                      Image Player & Thumbnail (image_url)
                                    </label>
                                    {tmdbPreview?.backdrops && tmdbPreview.backdrops.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveEpisodeBackdropId(
                                            activeEpisodeBackdropId === ep.id ? null : ep.id
                                          )
                                        }
                                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                      >
                                        <ImageIcon size={11} />
                                        <span>
                                          {activeEpisodeBackdropId === ep.id ? 'Tutup Galeri' : 'Pilih TMDB'}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-black/70 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-pink-400 min-h-[38px]">
                                    {ep.image_url && (
                                      <div className="relative w-7 h-5 rounded overflow-hidden flex-shrink-0 border border-pink-500/40 bg-black/60">
                                        <Image
                                          src={ep.image_url}
                                          alt="Thumb"
                                          fill
                                          className="object-cover"
                                          unoptimized
                                        />
                                      </div>
                                    )}
                                    <input
                                      type="text"
                                      value={ep.image_url || ''}
                                      onChange={(e) =>
                                        setFormSeasons((prev) =>
                                          prev.map((s) =>
                                            s.id === season.id
                                              ? {
                                                  ...s,
                                                  episodes: s.episodes.map((item) =>
                                                    item.id === ep.id
                                                      ? { ...item, image_url: e.target.value }
                                                      : item
                                                  ),
                                                }
                                              : s
                                          )
                                        )
                                      }
                                      placeholder="https://image.tmdb.org/... atau URL kustom"
                                      className="w-full bg-transparent text-xs text-white focus:outline-none"
                                    />
                                    {ep.image_url && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setFormSeasons((prev) =>
                                            prev.map((s) =>
                                              s.id === season.id
                                                ? {
                                                    ...s,
                                                    episodes: s.episodes.map((item) =>
                                                      item.id === ep.id
                                                      ? { ...item, image_url: '' }
                                                      : item
                                                    ),
                                                  }
                                                : s
                                            )
                                          )
                                        }
                                        className="text-slate-400 hover:text-red-400 p-0.5"
                                        title="Hapus gambar episode"
                                      >
                                        <X size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Inline Backdrop Picker for this specific episode */}
                              {activeEpisodeBackdropId === ep.id && tmdbPreview?.backdrops && (
                                <BackdropPicker
                                  backdrops={tmdbPreview.backdrops}
                                  selectedUrl={ep.image_url}
                                  title={`Pilih Backdrop untuk ${ep.title || ep.episode.toUpperCase()}`}
                                  onSelect={(url) => {
                                    setFormSeasons((prev) =>
                                      prev.map((s) =>
                                        s.id === season.id
                                          ? {
                                              ...s,
                                              episodes: s.episodes.map((item) =>
                                                item.id === ep.id ? { ...item, image_url: url } : item
                                              ),
                                            }
                                          : s
                                      )
                                    );
                                    setActiveEpisodeBackdropId(null);
                                    showToast(`Backdrop diterapkan ke ${ep.title || ep.episode.toUpperCase()}!`, 'success');
                                  }}
                                  onClose={() => setActiveEpisodeBackdropId(null)}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setFormSeasons((prev) =>
                              prev.map((s) =>
                                s.id === season.id
                                  ? {
                                      ...s,
                                      episodes: [
                                        ...s.episodes,
                                        {
                                          id: `ep_${Date.now()}_${s.episodes.length + 1}`,
                                          episode: `e${s.episodes.length + 1}`,
                                          videourl: '',
                                          title: `Episode ${s.episodes.length + 1}`,
                                          image_url: formPoster || '',
                                        },
                                      ],
                                    }
                                  : s
                              )
                            )
                          }
                          className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 pt-1 capitalize active:scale-95"
                        >
                          <Plus size={12} /> Tambah Baris Episode
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Submit & Cancel Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all min-h-[42px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-white shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-h-[42px]"
            >
              <CheckCircle size={15} />
              <span>{submitting ? 'Menyimpan...' : 'Simpan Konten'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
