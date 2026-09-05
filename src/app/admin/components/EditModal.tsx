import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Edit2,
  X,
  Star,
  CheckCircle,
  ImageIcon,
  Sparkles,
  Layers,
  Plus,
  Play,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Cloud,
} from 'lucide-react';
import { EditingItemState, TMDBPreviewData, TVShowItem } from '../types';
import { BackdropPicker } from './BackdropPicker';
import { S3BrowserModal } from './S3BrowserModal';
import { extractTmdbIdAndType, cleanVideoUrl, isValidVideoUrl } from '@/lib/urls';
import { normalizeLangCode } from '@/lib/language';
import siteConfig from '@/config';

interface EditableEpisode {
  id: string;
  relativePath?: string;
  seasonFolder: string;
  slug: string;
  title: string;
  videourl: string;
  image_url: string;
  subtitles: string;
  duration: string;
  deleted?: boolean;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: EditingItemState | null;
  setEditingItem: React.Dispatch<React.SetStateAction<EditingItemState | null>>;
  onSubmit: (item: any) => Promise<void>;
  tvShows: TVShowItem[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  setEditingItem,
  onSubmit,
  tvShows,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'episodes'>('info');
  const [tmdbPreview, setTmdbPreview] = useState<TMDBPreviewData | null>(null);
  const [fetchingTmdb, setFetchingTmdb] = useState(false);
  const [showBackdropPicker, setShowBackdropPicker] = useState(false);
  const [activeEpBackdropId, setActiveEpBackdropId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // S3 Storage Browser State
  const [s3BrowserOpen, setS3BrowserOpen] = useState(false);
  const [s3Target, setS3Target] = useState<{
    type: 'mainVideo' | 'subtitles' | 'episode';
    episodeId?: string;
  }>({ type: 'mainVideo' });
  const [s3FilterMode, setS3FilterMode] = useState<'all' | 'video' | 'subtitle'>('video');

  const openS3Browser = (
    mode: 'video' | 'subtitle',
    target: { type: 'mainVideo' | 'subtitles' | 'episode'; episodeId?: string }
  ) => {
    setS3FilterMode(mode);
    setS3Target(target);
    setS3BrowserOpen(true);
  };

  const handleS3Select = (url: string) => {
    if (s3Target.type === 'mainVideo') {
      updateFrontmatter('videourl', url);
      showToast('URL Video berhasil dipilih dari S3!');
    } else if (s3Target.type === 'subtitles') {
      updateFrontmatter('subtitles', url);
      showToast('URL Subtitle berhasil dipilih dari S3!');
    } else if (s3Target.type === 'episode' && s3Target.episodeId) {
      handleUpdateEpisode(s3Target.episodeId, 'videourl', url);
      showToast('URL Video Episode berhasil dipilih dari S3!');
    }
  };

  // Editable episodes state when editing a TV Show
  const [episodesList, setEpisodesList] = useState<EditableEpisode[]>([]);
  const [expandedEditSeasons, setExpandedEditSeasons] = useState<Record<string, boolean>>({});
  const [batchInputSeason, setBatchInputSeason] = useState<string | null>(null);
  const [batchUrlsText, setBatchUrlsText] = useState('');

  const toggleEditSeason = (season: string) => {
    setExpandedEditSeasons((prev) => ({
      ...prev,
      [season]: !prev[season],
    }));
  };

  const currentShow =
    editingItem?.type === 'tv_show'
      ? tvShows.find((s) => s.relativePath === editingItem.relativePath)
      : null;

  // Initialize editable episodes from current show
  useEffect(() => {
    if (editingItem && isOpen) {
      setSubmitError(null);
      setExpandedEditSeasons({});
      if (editingItem.type === 'tv_show' && currentShow) {
        const mapped: EditableEpisode[] = (currentShow.episodes || []).map((ep, idx) => ({
          id: ep.relativePath || `ep_${idx}_${Date.now()}`,
          relativePath: ep.relativePath,
          seasonFolder: (ep.seasonFolder || 's1').toLowerCase(),
          slug: ep.slug || `e${idx + 1}`,
          title: ep.displayTitle || ep.frontmatter?.title || `Episode ${idx + 1}`,
          videourl: ep.frontmatter?.videourl || ep.frontmatter?.video_url || '',
          image_url: ep.frontmatter?.image_url || '',
          subtitles: ep.frontmatter?.subtitles || '',
          duration: ep.frontmatter?.duration || '',
        }));
        setEpisodesList(mapped);
      }

      let tmdbIdToFetch = editingItem.frontmatter.tmdb_id;
      if (!tmdbIdToFetch && editingItem.type === 'tv_episode') {
        const showSlug = editingItem.relativePath.split('/')[1];
        const show = tvShows.find((s) => s.showSlug === showSlug);
        tmdbIdToFetch = show?.frontmatter.tmdb_id;
      }
      if (tmdbIdToFetch) {
        handleFetchTmdb(String(tmdbIdToFetch), editingItem.type === 'movie' ? 'movie' : 'tv');
      }
    }
  }, [editingItem?.relativePath, isOpen]);

  if (!isOpen || !editingItem) return null;

  const handleFetchTmdb = async (idInput: string, type: 'movie' | 'tv') => {
    const extracted = extractTmdbIdAndType(idInput);
    const idToUse = extracted.id || idInput.trim();
    if (!idToUse) return;

    setFetchingTmdb(true);
    try {
      const res = await fetch(
        `/api/admin/tmdb-preview?id=${encodeURIComponent(idToUse)}&type=${type}&include_images=true`
      );
      if (res.ok) {
        const data: TMDBPreviewData = await res.json();
        setTmdbPreview(data);

        // Auto-detect and auto-fill language from TMDB ONLY if not already set on this existing content
        if (data.originalLanguage && (!editingItem.frontmatter.language || editingItem.frontmatter.language === '')) {
          const l = data.originalLanguage.toLowerCase().trim();
          let detectedLang = 'ID';
          if (l === 'id' || l === 'ind') detectedLang = 'ID';
          else if (l === 'ms' || l === 'zlm' || l === 'mly') detectedLang = 'MS';
          else if (l === 'ko' || l === 'kr' || l === 'kor') detectedLang = 'KR';
          else if (l === 'en' || l === 'eng') detectedLang = 'EN';
          else if (l === 'ja' || l === 'jp' || l === 'jpn') {
            const isAnime = data.genres?.some((g) => g.toLowerCase().includes('animation') || g.toLowerCase().includes('anime'));
            detectedLang = isAnime ? 'ANIME' : 'JP';
          } else if (l === 'th' || l === 'tha') detectedLang = 'TH';
          else if (l === 'zh' || l === 'cn' || l === 'zho' || l === 'chi' || l === 'yue') detectedLang = 'CN';
          else detectedLang = data.originalLanguage.toUpperCase().slice(0, 2);

          updateFrontmatter('language', detectedLang);
          showToast(`Bahasa otomatis terdeteksi: ${detectedLang}`);
        }
      }
    } catch {
    } finally {
      setFetchingTmdb(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side URL validation
    if (editingItem.type === 'movie' || editingItem.type === 'tv_episode') {
      const vid = editingItem.frontmatter.videourl || editingItem.frontmatter.video_url;
      if (vid && !isValidVideoUrl(vid)) {
        const msg = 'URL Video harus diawali https://';
        setSubmitError(msg);
        showToast(msg, 'error');
        return;
      }
    } else if (editingItem.type === 'tv_show') {
      for (const ep of episodesList) {
        if (ep.videourl && !isValidVideoUrl(ep.videourl)) {
          const msg = `URL Video untuk ${ep.title || ep.slug} harus diawali https://`;
          setSubmitError(msg);
          showToast(msg, 'error');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      setSubmitError(null);
      const payload: any = {
        relativePath: editingItem.relativePath,
        frontmatter: editingItem.frontmatter,
        content: editingItem.content,
      };

      if (editingItem.type === 'tv_show') {
        payload.episodes = episodesList;
      }

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Gagal menyimpan perubahan';
      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateFrontmatter = (key: string, value: any) => {
    setEditingItem({
      ...editingItem,
      frontmatter: {
        ...editingItem.frontmatter,
        [key]: value,
      },
    });
  };

  // Group episodes by season
  const activeEpisodes = episodesList.filter((ep) => !ep.deleted);
  const seasonsMap: Record<string, EditableEpisode[]> = {};
  activeEpisodes.forEach((ep) => {
    const s = ep.seasonFolder || 's1';
    if (!seasonsMap[s]) seasonsMap[s] = [];
    seasonsMap[s].push(ep);
  });

  const availableSeasons = Object.keys(seasonsMap).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  if (availableSeasons.length === 0) {
    availableSeasons.push('s1');
    seasonsMap['s1'] = [];
  }

  const handleAddEpisodeToSeason = (season: string) => {
    const count = (seasonsMap[season] || []).length + 1;
    const newEp: EditableEpisode = {
      id: `new_ep_${Date.now()}_${count}`,
      seasonFolder: season,
      slug: `e${count}`,
      title: `Episode ${count}`,
      videourl: '',
      image_url: editingItem.frontmatter?.image_url || '',
      subtitles: '',
      duration: '',
    };
    setEpisodesList((prev) => [...prev, newEp]);
    showToast(`Episode ${count} ditambahkan ke ${season.toUpperCase()}`);
  };

  const handleAddNewSeason = () => {
    const nextSeasonNum = availableSeasons.length + 1;
    const newSeasonKey = `s${nextSeasonNum}`;
    const newEp: EditableEpisode = {
      id: `new_ep_${Date.now()}_1`,
      seasonFolder: newSeasonKey,
      slug: 'e1',
      title: 'Episode 1',
      videourl: '',
      image_url: editingItem.frontmatter?.image_url || '',
      subtitles: '',
      duration: '',
    };
    setEpisodesList((prev) => [...prev, newEp]);
    showToast(`Season ${nextSeasonNum} dibuat!`);
  };

  const handleUpdateEpisode = (id: string, field: keyof EditableEpisode, value: any) => {
    setEpisodesList((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, [field]: value } : ep))
    );
  };

  const handleDeleteEpisode = (id: string) => {
    setEpisodesList((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, deleted: true } : ep))
    );
    showToast('Episode ditandai untuk dihapus');
  };

  const handleApplyBatchUrls = (season: string) => {
    if (!batchUrlsText.trim()) return;
    const lines = batchUrlsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    setEpisodesList((prev) => {
      const seasonEps = prev.filter((ep) => ep.seasonFolder === season && !ep.deleted);
      const otherEps = prev.filter((ep) => ep.seasonFolder !== season || ep.deleted);

      const totalCount = Math.max(seasonEps.length, lines.length);
      const updatedSeasonEps: EditableEpisode[] = [];

      for (let i = 0; i < totalCount; i++) {
        const epNum = i + 1;
        const lineUrl = i < lines.length ? cleanVideoUrl(lines[i]) || lines[i] : null;
        const existingEp = seasonEps[i];

        if (existingEp) {
          updatedSeasonEps.push({
            ...existingEp,
            videourl: lineUrl !== null ? lineUrl : existingEp.videourl,
          });
        } else {
          updatedSeasonEps.push({
            id: `batch_ep_${Date.now()}_${epNum}`,
            seasonFolder: season,
            slug: `e${epNum}`,
            title: `Episode ${epNum}`,
            videourl: lineUrl || '',
            image_url: editingItem.frontmatter?.image_url || '',
            subtitles: '',
            duration: '',
          });
        }
      }

      return [...otherEps, ...updatedSeasonEps];
    });

    setBatchUrlsText('');
    setBatchInputSeason(null);
    showToast(`${lines.length} URL video berhasil diterapkan dari baris 1 s/d ${lines.length} di ${season.toUpperCase()}!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-[#0b1329] border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-white/10 bg-[#090e1f]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <Edit2 size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Edit {editingItem.type === 'movie' ? 'Movie' : editingItem.type === 'tv_show' ? 'TV Series' : 'Episode'}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                {editingItem.relativePath}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher for TV Series */}
        {editingItem.type === 'tv_show' && (
          <div className="px-3.5 sm:px-5 pt-3 pb-2 border-b border-white/5 flex gap-2 bg-[#090e1f]/50">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'info'
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Info & Metadata Series
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('episodes')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'episodes'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>Kelola Episode ({activeEpisodes.length})</span>
            </button>
          </div>
        )}

        {/* Form Body */}
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

          {activeTab === 'info' ? (
            <>
              {/* TMDB ID & Autofill */}
              {editingItem.type !== 'tv_episode' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    TMDB ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editingItem.frontmatter.tmdb_id || ''}
                      onChange={(e) => updateFrontmatter('tmdb_id', Number(e.target.value))}
                      placeholder="TMDB ID"
                      className="flex-1 px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleFetchTmdb(
                          String(editingItem.frontmatter.tmdb_id),
                          editingItem.type === 'movie' ? 'movie' : 'tv'
                        )
                      }
                      disabled={fetchingTmdb || !editingItem.frontmatter.tmdb_id}
                      className="px-4 py-2.5 sm:py-3 rounded-xl text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-all disabled:opacity-50 min-h-[42px]"
                    >
                      <Sparkles size={14} className={fetchingTmdb ? 'animate-spin' : ''} />
                      <span>{fetchingTmdb ? 'Memuat...' : 'Cek TMDB'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Judul Kustom (Title)
                </label>
                <input
                  type="text"
                  value={editingItem.frontmatter.title || ''}
                  onChange={(e) => updateFrontmatter('title', e.target.value)}
                  placeholder="Judul Film atau Series"
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                />
              </div>

              {/* Video URL (Movies & Episodes) */}
              {editingItem.type !== 'tv_show' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      URL Video Stream (videourl)
                    </label>
                    <button
                      type="button"
                      onClick={() => openS3Browser('video', { type: 'mainVideo' })}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Cloud size={13} />
                      <span>Browse S3 Storage</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editingItem.frontmatter.videourl || editingItem.frontmatter.video_url || ''}
                    onChange={(e) => updateFrontmatter('videourl', e.target.value)}
                    placeholder="https://server.com/video.mp4 atau .m3u8"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-mono min-h-[42px]"
                  />
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
                        onClick={() => setShowBackdropPicker(!showBackdropPicker)}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <ImageIcon size={12} />
                        <span>
                          {showBackdropPicker ? 'Tutup Galeri' : `Pilih dari Galeri (${tmdbPreview.backdrops.length})`}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingItem.frontmatter.image_url && (
                      <div className="relative w-12 h-8 rounded-lg overflow-hidden border border-cyan-500/40 flex-shrink-0 bg-black/60">
                        <Image
                          src={editingItem.frontmatter.image_url}
                          alt="Series Poster"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      value={editingItem.frontmatter.image_url || ''}
                      onChange={(e) => updateFrontmatter('image_url', e.target.value)}
                      placeholder="https://image.tmdb.org/t/p/... atau URL gambar kustom"
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                    />
                    {editingItem.frontmatter.image_url && (
                      <button
                        type="button"
                        onClick={() => updateFrontmatter('image_url', '')}
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

                  {showBackdropPicker && tmdbPreview?.backdrops && (
                    <BackdropPicker
                      backdrops={tmdbPreview.backdrops}
                      selectedUrl={editingItem.frontmatter.image_url}
                      title="Pilih Backdrop untuk Player Series"
                      onSelect={(url) => {
                        updateFrontmatter('image_url', url);
                        setShowBackdropPicker(false);
                        showToast('Backdrop series diterapkan!');
                      }}
                      onClose={() => setShowBackdropPicker(false)}
                    />
                  )}
                </div>

              {/* Rating, Language, Weight, Subtitles, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Rating (0 - 10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={editingItem.frontmatter.rating || ''}
                    onChange={(e) => updateFrontmatter('rating', Number(e.target.value))}
                    placeholder="8.5"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                  />
                </div>

                {editingItem.type !== 'tv_episode' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Bahasa (Language)
                    </label>
                    <select
                      value={normalizeLangCode(editingItem.frontmatter.language) || 'ID'}
                      onChange={(e) => updateFrontmatter('language', e.target.value)}
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
                )}

                {editingItem.type !== 'tv_episode' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Weight Prioritas
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={editingItem.frontmatter.weight || ''}
                      onChange={(e) => updateFrontmatter('weight', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Urutan (1, 2, ..)"
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                      title="Angka lebih kecil = urutan lebih prioritas/paling depan di section"
                    />
                  </div>
                )}

                {editingItem.type === 'tv_episode' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Durasi (e.g. 45m)
                    </label>
                    <input
                      type="text"
                      value={editingItem.frontmatter.duration || ''}
                      onChange={(e) => updateFrontmatter('duration', e.target.value)}
                      placeholder="45m"
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 min-h-[42px]"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300">
                        Subtitles URL
                      </label>
                      <button
                        type="button"
                        onClick={() => openS3Browser('subtitle', { type: 'subtitles' })}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                      >
                        <Cloud size={12} />
                        <span>Browse S3</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editingItem.frontmatter.subtitles || ''}
                      onChange={(e) => updateFrontmatter('subtitles', e.target.value)}
                      placeholder="https://server.com/sub.vtt"
                      className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-mono min-h-[42px]"
                    />
                  </div>
                )}
              </div>

              {/* Featured & Trending Toggles (Movies & TV Series) */}
              {editingItem.type !== 'tv_episode' && (() => {
                const featLimit = siteConfig?.featuredLimit || 7;
                const isTV = editingItem.type === 'tv_show';
                const trendLimit = isTV
                  ? (siteConfig as any)?.trendingTVLimit || 10
                  : (siteConfig as any)?.trendingLimit ||
                    siteConfig?.sections?.find((s) => s.id === 'trending')?.limit ||
                    10;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-black/30 border border-white/5 rounded-xl">
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(editingItem.frontmatter.featured)}
                          onChange={(e) => updateFrontmatter('featured', e.target.checked)}
                          className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-black/50 border-white/20"
                        />
                        <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1">
                          <Star size={14} fill="currentColor" /> Featured Hero Carousel
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Maks. {featLimit}
                        </span>
                      </label>
                      <p className="text-[10.5px] text-slate-400 pl-6 leading-tight">
                        Item lama otomatis di-uncheck jika kuota {featLimit} terlampaui.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(editingItem.frontmatter.trending)}
                          onChange={(e) => updateFrontmatter('trending', e.target.checked)}
                          className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-black/50 border-white/20"
                        />
                        <span className="text-xs sm:text-sm font-bold text-rose-400 flex items-center gap-1">
                          🔥 Trending Section (Home)
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Maks. {trendLimit}
                        </span>
                      </label>
                      <p className="text-[10.5px] text-slate-400 pl-6 leading-tight">
                        Item lama otomatis di-uncheck jika kuota {trendLimit} terlampaui.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Deskripsi / Sinopsis
                </label>
                <textarea
                  rows={3}
                  value={editingItem.frontmatter.deskripsi || editingItem.frontmatter.description || ''}
                  onChange={(e) => updateFrontmatter('deskripsi', e.target.value)}
                  placeholder="Sinopsis singkat..."
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Markdown Content Body */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Catatan / Markdown Body
                </label>
                <textarea
                  rows={3}
                  value={editingItem.content || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  placeholder="Konten markdown tambahan..."
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </>
          ) : (
            /* Episodes Manager Tab - Spacious, Mobile-Friendly UI */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Kelola Episode ({activeEpisodes.length} total)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Edit URL video, judul, backdrop, dan kelola episode per season.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddNewSeason}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 min-h-[38px]"
                >
                  <Plus size={13} />
                  <span>Tambah Season Baru</span>
                </button>
              </div>

              {/* Seasons list */}
              <div className="space-y-4">
                {availableSeasons.map((season) => {
                  const sEpisodes = seasonsMap[season] || [];
                  const isBatchActive = batchInputSeason === season;
                  const isExpanded = Boolean(expandedEditSeasons[season]);
                  const seasonLabel = `Season ${season.replace(/\D/g, '') || season}`;

                  return (
                    <div
                      key={season}
                      className="p-3 sm:p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3 transition-all"
                    >
                      <div
                        onClick={() => toggleEditSeason(season)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 cursor-pointer transition-all select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-slate-300">
                            {isExpanded ? (
                              <ChevronDown size={15} className="text-pink-400 transition-transform" />
                            ) : (
                              <ChevronRight size={15} className="text-slate-400 transition-transform" />
                            )}
                          </div>
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30 capitalize">
                            {seasonLabel}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">
                            {sEpisodes.length} Episode
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isExpanded) toggleEditSeason(season);
                              setBatchInputSeason(isBatchActive ? null : season);
                            }}
                            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
                          >
                            {isBatchActive ? 'Tutup Batch Paste' : 'Batch Paste URLs'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isExpanded) toggleEditSeason(season);
                              handleAddEpisodeToSeason(season);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 flex items-center gap-1 transition-all capitalize active:scale-95"
                          >
                            <Plus size={12} />
                            <span>Tambah Episode</span>
                          </button>
                        </div>
                      </div>

                      {/* Batch URL input */}
                      {isExpanded && isBatchActive && (
                        <div className="p-3 rounded-lg bg-black/60 border border-cyan-500/30 space-y-2 animate-fade-in">
                          <label className="block text-xs font-bold text-cyan-300">
                            Paste URL Video Stream (1 URL per baris)
                          </label>
                          <textarea
                            rows={3}
                            value={batchUrlsText}
                            onChange={(e) => setBatchUrlsText(e.target.value)}
                            placeholder={`https://server.com/${season}-e1.mp4\nhttps://server.com/${season}-e2.mp4`}
                            className="w-full p-2.5 bg-black/80 border border-white/10 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setBatchInputSeason(null)}
                              className="px-3 py-1.5 text-xs text-slate-400"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyBatchUrls(season)}
                              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-md shadow-md"
                            >
                              Terapkan ke {season.toUpperCase()}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Episodes Editable Cards */}
                      {isExpanded && (
                        sEpisodes.length === 0 ? (
                          <div className="p-3 text-center text-slate-500 text-xs">
                            Belum ada episode di season ini.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sEpisodes.map((ep, idx) => (
                              <div
                                key={ep.id}
                                className="p-3 sm:p-3.5 rounded-xl bg-[#090e1e] border border-white/10 hover:border-purple-500/40 space-y-3 transition-all shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="w-8 text-center font-mono text-xs font-black text-pink-400 bg-pink-500/10 rounded-lg py-1.5 border border-pink-500/20">
                                      {ep.slug.toUpperCase()}
                                    </span>
                                    <input
                                      type="text"
                                      value={ep.title}
                                      onChange={(e) =>
                                        handleUpdateEpisode(ep.id, 'title', e.target.value)
                                      }
                                      placeholder="Judul Episode..."
                                      className="px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-purple-400 flex-1 min-h-[38px] capitalize"
                                    />
                                  </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteEpisode(ep.id)}
                                  className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                  title="Hapus Episode"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>

                              {/* Video URL & Details - Mobile-Friendly */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] text-slate-400 font-bold">
                                      URL Video Stream <span className="text-red-400">*</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openS3Browser('video', {
                                          type: 'episode',
                                          episodeId: ep.id,
                                        })
                                      }
                                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
                                    >
                                      <Cloud size={11} />
                                      <span>Browse S3</span>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-400 min-h-[40px]">
                                    <Play size={13} className="text-cyan-400 flex-shrink-0" />
                                    <input
                                      type="text"
                                      value={ep.videourl}
                                      onChange={(e) =>
                                        handleUpdateEpisode(ep.id, 'videourl', e.target.value)
                                      }
                                      placeholder="https://server.com/video.mp4"
                                      className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                                    />
                                  </div>
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
                                          setActiveEpBackdropId(
                                            activeEpBackdropId === ep.id ? null : ep.id
                                          )
                                        }
                                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                      >
                                        <ImageIcon size={11} />
                                        <span>
                                          {activeEpBackdropId === ep.id ? 'Tutup Galeri' : 'Pilih TMDB'}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-purple-400 min-h-[40px]">
                                    {ep.image_url && (
                                      <div className="relative w-8 h-5 rounded overflow-hidden flex-shrink-0 border border-purple-500/40 bg-black/60">
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
                                      value={ep.image_url}
                                      onChange={(e) =>
                                        handleUpdateEpisode(ep.id, 'image_url', e.target.value)
                                      }
                                      placeholder="https://image.tmdb.org/... atau URL gambar"
                                      className="w-full bg-transparent text-xs text-white focus:outline-none"
                                    />
                                    {ep.image_url && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateEpisode(ep.id, 'image_url', '')}
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
                              {activeEpBackdropId === ep.id && tmdbPreview?.backdrops && (
                                <BackdropPicker
                                  backdrops={tmdbPreview.backdrops}
                                  selectedUrl={ep.image_url}
                                  title={`Pilih Backdrop untuk ${ep.title || ep.slug.toUpperCase()}`}
                                  onSelect={(url) => {
                                    handleUpdateEpisode(ep.id, 'image_url', url);
                                    setActiveEpBackdropId(null);
                                    showToast(`Backdrop diterapkan ke ${ep.title || ep.slug.toUpperCase()}!`, 'success');
                                  }}
                                  onClose={() => setActiveEpBackdropId(null)}
                                />
                              )}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
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
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-h-[42px]"
            >
              <CheckCircle size={15} />
              <span>{submitting ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* S3 Storage Browser Modal */}
      <S3BrowserModal
        isOpen={s3BrowserOpen}
        onClose={() => setS3BrowserOpen(false)}
        onSelect={handleS3Select}
        filterMode={s3FilterMode}
        targetFieldLabel={
          s3Target.type === 'subtitles'
            ? 'Subtitles'
            : s3Target.type === 'episode'
            ? 'Episode Video Stream'
            : 'URL Video Stream'
        }
      />
    </div>
  );
};
