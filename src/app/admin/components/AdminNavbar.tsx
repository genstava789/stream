import React from 'react';
import {
  Film,
  Tv,
  Users,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  CloudDownload,
  ArrowUpDown,
  Globe,
  Flame,
  XCircle,
  ChevronDown,
  Crown,
  ShieldCheck,
} from 'lucide-react';

interface AdminNavbarProps {
  activeTab: 'movies' | 'tv' | 'users';
  setActiveTab: (tab: 'movies' | 'tv' | 'users') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortOrder: 'newest' | 'oldest' | 'rating' | 'title' | 'weight';
  setSortOrder: (s: 'newest' | 'oldest' | 'rating' | 'title' | 'weight') => void;
  filterLanguage: 'all' | 'ID' | 'MS' | 'KR' | 'EN' | 'JP' | 'ANIME' | 'TH' | 'CN';
  setFilterLanguage: (l: 'all' | 'ID' | 'MS' | 'KR' | 'EN' | 'JP' | 'ANIME' | 'TH' | 'CN') => void;
  filterStatus: 'all' | 'trending' | 'featured';
  setFilterStatus: (st: 'all' | 'trending' | 'featured') => void;
  moviesCount: number;
  tvShowsCount: number;
  totalEpisodesCount?: number;
  loading: boolean;
  operatorRole?: 'owner' | 'admin' | 'member';
  onRefresh: () => void;
  onOpenCreateMovie: () => void;
  onOpenCreateTV: () => void;
  onOpenSettings: () => void;
  hasToken: boolean;
  selectedBatchCount: number;
  onBatchDelete: () => void;
  onClearSelection?: () => void;
  onManualSyncGitHub: () => void;
  syncingGitHub: boolean;
  onImportGitHub?: () => void;
  importingGitHub?: boolean;
  targetRepoName?: string;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  sortOrder,
  setSortOrder,
  filterLanguage,
  setFilterLanguage,
  filterStatus,
  setFilterStatus,
  moviesCount,
  tvShowsCount,
  loading,
  operatorRole = 'member',
  onRefresh,
  onOpenCreateMovie,
  onOpenCreateTV,
  onOpenSettings,
  hasToken,
  selectedBatchCount,
  onBatchDelete,
  onClearSelection,
  onManualSyncGitHub,
  syncingGitHub,
  onImportGitHub,
  importingGitHub = false,
  targetRepoName,
}) => {
  const isOwner = operatorRole === 'owner';

  return (
    <div className="space-y-3.5">
      {/* Top Main Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090e1f] border border-white/10 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Heading with Role Badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              CMS Dashboard
            </h1>

            {isOwner ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                <Crown size={11} className="text-amber-400 fill-amber-400" />
                <span>OWNER</span>
              </span>
            ) : operatorRole === 'admin' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                <ShieldCheck size={11} className="text-cyan-400" />
                <span>ADMINISTRATOR</span>
              </span>
            ) : null}

            {selectedBatchCount > 0 && isOwner && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {selectedBatchCount} Terpilih
              </span>
            )}
          </div>

          {/* Action & Utility Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {selectedBatchCount > 0 && isOwner && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onBatchDelete}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-400 text-white flex items-center gap-1.5 transition-all shadow-md shadow-red-500/20 active:scale-95 animate-pulse"
                >
                  <Trash2 size={13} />
                  <span>Hapus Terpilih ({selectedBatchCount})</span>
                </button>
                {onClearSelection && (
                  <button
                    onClick={onClearSelection}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Batalkan Seleksi"
                  >
                    <XCircle size={15} />
                  </button>
                )}
              </div>
            )}

            {/* Manual Push to GitHub (Export) Button */}
            <button
              onClick={onManualSyncGitHub}
              disabled={syncingGitHub || importingGitHub}
              className={`px-3 py-2 rounded-xl border text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 shadow-md ${
                syncingGitHub
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-400/40 shadow-purple-900/30'
              }`}
              title={`Export data MongoDB ke repository ${targetRepoName || 'konten'}`}
            >
              <CloudUpload size={14} className={syncingGitHub ? 'animate-bounce' : ''} />
              <span>{syncingGitHub ? 'Mengirim...' : 'Export ke GitHub'}</span>
            </button>

            {/* Manual Import from GitHub Button */}
            {onImportGitHub && (
              <button
                onClick={onImportGitHub}
                disabled={syncingGitHub || importingGitHub}
                className={`px-3 py-2 rounded-xl border text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 shadow-md ${
                  importingGitHub
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-700 to-teal-600 hover:from-blue-600 hover:to-teal-500 text-white border-teal-400/40 shadow-teal-900/30'
                }`}
                title={`Import file Markdown dari repository ${targetRepoName || 'konten'} ke MongoDB`}
              >
                <CloudDownload size={14} className={importingGitHub ? 'animate-spin' : ''} />
                <span>{importingGitHub ? 'Mengimpor...' : 'Import dari GitHub'}</span>
              </button>
            )}

            {/* Add Film */}
            <button
              onClick={onOpenCreateMovie}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 active:scale-95"
            >
              <Plus size={14} />
              <span>Tambahkan Movie</span>
            </button>

            {/* Add TV */}
            <button
              onClick={onOpenCreateTV}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-pink-500/20 active:scale-95"
            >
              <Plus size={14} />
              <span>Tambahkan Series</span>
            </button>

            {/* GitHub Token Config Status */}
            <button
              onClick={onOpenSettings}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                hasToken
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
              }`}
            >
              <Settings size={13} />
              <span className="hidden sm:inline">GitHub Token</span>
              {hasToken ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <AlertCircle size={13} className="text-amber-400 animate-pulse" />
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-cyan-400' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar & Filters */}
      <div className="p-3 rounded-2xl bg-[#090e1f] border border-white/10 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: Tab Switcher & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Tabs: Film vs TV vs Users */}
          <div className="flex items-center gap-1 p-1 bg-black/50 border border-white/10 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'movies'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film size={13} />
              <span>Film ({moviesCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('tv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'tv'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv size={13} />
              <span>TV Series ({tvShowsCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={13} />
              <span>Users & Role</span>
            </button>
          </div>

          {/* Search Box (Only on movies & tv tabs) */}
          {activeTab !== 'users' && (
            <div className="relative flex-1 min-w-[180px]">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Cari ${activeTab === 'movies' ? 'film' : 'series'}...`}
                className="w-full pl-9 pr-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all min-h-[40px]"
              />
            </div>
          )}
        </div>

        {/* Right: Filter & Sort Controls (Hidden on users tab) */}
        {activeTab !== 'users' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
            {/* Sort Dropdown */}
            <div className="relative flex items-center bg-black/50 border border-white/10 hover:border-white/20 focus-within:border-cyan-500 rounded-xl px-3 py-1.5 transition-all min-h-[40px]">
              <ArrowUpDown size={14} className="text-cyan-400 flex-shrink-0 mr-2 pointer-events-none" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer w-full appearance-none pr-6 truncate"
                aria-label="Urutkan Konten"
              >
                <option value="newest" className="bg-[#090e1f] text-white">Terbaru</option>
                <option value="oldest" className="bg-[#090e1f] text-white">Terlama</option>
                <option value="weight" className="bg-[#090e1f] text-white">Weight Terkecil</option>
                <option value="rating" className="bg-[#090e1f] text-white">Rating Tertinggi</option>
                <option value="title" className="bg-[#090e1f] text-white">Judul A-Z</option>
              </select>
              <ChevronDown size={13} className="text-slate-400 absolute right-2.5 pointer-events-none flex-shrink-0" />
            </div>

            {/* Language Filter */}
            <div className="relative flex items-center bg-black/50 border border-white/10 hover:border-white/20 focus-within:border-blue-500 rounded-xl px-3 py-1.5 transition-all min-h-[40px]">
              <Globe size={14} className="text-blue-400 flex-shrink-0 mr-2 pointer-events-none" />
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer w-full appearance-none pr-6 truncate"
                aria-label="Filter Bahasa"
              >
                <option value="all" className="bg-[#090e1f] text-white">Semua Bahasa</option>
                <option value="ID" className="bg-[#090e1f] text-white">ID - Indonesia</option>
                <option value="MS" className="bg-[#090e1f] text-white">MS - Melayu / Malaysia</option>
                <option value="KR" className="bg-[#090e1f] text-white">KR - Korea</option>
                <option value="EN" className="bg-[#090e1f] text-white">EN - English</option>
                <option value="JP" className="bg-[#090e1f] text-white">JP - Jepang (Live Action)</option>
                <option value="ANIME" className="bg-[#090e1f] text-white">ANIME - Jepang (Anime)</option>
                <option value="TH" className="bg-[#090e1f] text-white">TH - Thailand</option>
                <option value="CN" className="bg-[#090e1f] text-white">CN - China</option>
              </select>
              <ChevronDown size={13} className="text-slate-400 absolute right-2.5 pointer-events-none flex-shrink-0" />
            </div>

            {/* Status Filter */}
            <div className="relative flex items-center bg-black/50 border border-white/10 hover:border-white/20 focus-within:border-rose-500 rounded-xl px-3 py-1.5 transition-all min-h-[40px]">
              <Flame size={14} className="text-rose-400 flex-shrink-0 mr-2 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer w-full appearance-none pr-6 truncate"
                aria-label="Filter Status"
              >
                <option value="all" className="bg-[#090e1f] text-white">Semua Status</option>
                <option value="trending" className="bg-[#090e1f] text-white">Trending</option>
                <option value="featured" className="bg-[#090e1f] text-white">Featured Hero</option>
              </select>
              <ChevronDown size={13} className="text-slate-400 absolute right-2.5 pointer-events-none flex-shrink-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
