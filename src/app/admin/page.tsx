'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAdminData } from './hooks/useAdminData';
import { AdminNavbar } from './components/AdminNavbar';
import { MovieListView } from './components/MovieListView';
import { TVListView } from './components/TVListView';
import { UserManagementView } from './components/UserManagementView';
import { CreateModal } from './components/CreateModal';
import { EditModal } from './components/EditModal';
import { SettingsModal } from './components/SettingsModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { useAuth } from '@/context/AuthContext';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Shield,
  ShieldAlert,
  Lock,
  ArrowLeft,
  LogIn,
  LogOut,
  Crown,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function AdminPage() {
  const admin = useAdminData();
  const { user, isLoggedIn, authStatus, login, logout } = useAuth();

  // Quick add episode context
  const [quickAddContext, setQuickAddContext] = useState<{ show: any; seasonSlug: string } | null>(null);

  // Admin login form local state
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password) {
      setLoginError('Email dan password wajib diisi');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    const res = await login(emailOrUsername.trim(), password);
    setLoginLoading(false);

    if (!res.success) {
      setLoginError(res.message || 'Login gagal. Periksa kembali email dan password Anda.');
    }
  };

  // 1. Initializing State
  if (authStatus === 'initializing') {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw size={32} className="animate-spin mx-auto text-cyan-400" />
          <p className="text-xs font-semibold text-slate-400">Memverifikasi kredensial...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State -> Admin Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow ambient */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 space-y-6">
          {/* Back to Home Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span>Kembali ke Beranda</span>
          </Link>

          {/* Glassmorphic Login Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#090e24]/90 border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/25 border border-cyan-400/40">
                <Shield size={28} className="text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                CMS Dashboard Login
              </h1>
              <p className="text-xs text-slate-400">
                Masukkan akun dengan hak akses <strong className="text-cyan-300">Administrator</strong> atau <strong className="text-amber-300">Owner</strong>.
              </p>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Email / Username
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder="Username atau Email..."
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-500 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password akun..."
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-500 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 mt-2"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Memproses Login...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>Masuk ke CMS Dashboard</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-white/5 text-center">
              <p className="text-[11px] text-slate-500">
                Kredensial Owner utama terkonfigurasi pada sistem.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Logged In but Role is Member -> Access Restricted Screen
  if (user?.role !== 'owner' && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#090e24] border border-red-500/30 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
            <ShieldAlert size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Akses Ditolak
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Akun Anda saat ini <strong className="text-cyan-300">@{user?.username}</strong> memiliki role <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">MEMBER</span>.
              Hanya akun dengan hak akses <strong className="text-cyan-300">Administrator</strong> atau <strong className="text-amber-300">Owner</strong> yang dapat mengakses CMS Dashboard.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => logout()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/40 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <LogOut size={14} />
              <span>Ganti Akun</span>
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized (Owner or Admin) -> Full CMS Dashboard
  const isOwner = user?.role === 'owner';

  return (
    <div className="min-h-screen bg-[#050816] text-white p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {admin.toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3.5 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md pointer-events-auto animate-slide-in ${
              toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : 'bg-[#09152b]/95 border-cyan-500/40 text-cyan-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle size={16} className="text-cyan-400 flex-shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Main Admin Navbar */}
      <AdminNavbar
        activeTab={admin.activeTab}
        setActiveTab={admin.setActiveTab}
        searchQuery={admin.searchQuery}
        setSearchQuery={admin.setSearchQuery}
        sortOrder={admin.sortOrder}
        setSortOrder={admin.setSortOrder}
        filterLanguage={admin.filterLanguage}
        setFilterLanguage={admin.setFilterLanguage}
        filterStatus={admin.filterStatus}
        setFilterStatus={admin.setFilterStatus}
        moviesCount={admin.totalAllMoviesCount}
        tvShowsCount={admin.totalAllTvShowsCount}
        totalEpisodesCount={admin.totalEpisodesCount}
        loading={admin.loading}
        operatorRole={user?.role}
        onRefresh={() => admin.fetchContent({ force: true })}
        onOpenCreateMovie={() => {
          admin.setCreateContentType('movie');
          admin.setIsCreateModalOpen(true);
        }}
        onOpenCreateTV={() => {
          admin.setCreateContentType('tv_show');
          admin.setIsCreateModalOpen(true);
        }}
        onOpenSettings={() => admin.setIsSettingsOpen(true)}
        hasToken={Boolean(admin.ghToken)}
        selectedBatchCount={admin.selectedBatchPaths.length}
        onBatchDelete={() => {
          if (!isOwner) {
            admin.showToast('Hanya Owner yang dapat menghapus konten', 'error');
            return;
          }
          admin.setDeleteTarget({
            path: `${admin.selectedBatchPaths.length} file terpilih`,
            title: `${admin.selectedBatchPaths.length} Konten`,
            isBatch: true,
            count: admin.selectedBatchPaths.length,
          });
        }}
        onClearSelection={admin.clearSelection}
        onManualSyncGitHub={admin.handleManualSyncToGitHub}
        syncingGitHub={admin.syncingGitHub}
      />

      {/* Content Area */}
      {admin.activeTab === 'users' ? (
        <UserManagementView
          currentUserId={user.id}
          currentUserRole={user.role}
          onShowToast={admin.showToast}
        />
      ) : admin.loading && admin.movies.length === 0 && admin.tvShows.length === 0 ? (
        <div className="py-24 text-center text-slate-400">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-xs font-semibold">Memuat data CMS...</p>
        </div>
      ) : admin.activeTab === 'movies' ? (
        <MovieListView
          movies={admin.paginatedMovies}
          totalMoviesCount={admin.totalMovies}
          searchQuery={admin.searchQuery}
          currentPage={admin.moviePage}
          totalPages={admin.totalMoviePages}
          onPageChange={admin.setMoviePage}
          pageLoading={admin.pageLoading}
          canDelete={isOwner}
          onOpenCreate={() => {
            admin.setCreateContentType('movie');
            admin.setIsCreateModalOpen(true);
          }}
          onOpenEdit={(movie) => {
            admin.setEditingItem({
              type: 'movie',
              relativePath: movie.relativePath,
              frontmatter: { ...movie.frontmatter },
              content: movie.content,
            });
            admin.setIsEditModalOpen(true);
          }}
          onDelete={(relativePath, title) => {
            if (!isOwner) {
              admin.showToast('Hanya Owner yang berhak menghapus konten', 'error');
              return;
            }
            admin.setDeleteTarget({ path: relativePath, title });
          }}
          selectedPaths={admin.selectedBatchPaths}
          onToggleSelect={admin.toggleBatchSelect}
          onSelectAll={admin.selectAll}
          onClearSelection={admin.clearSelection}
        />
      ) : (
        <TVListView
          tvShows={admin.paginatedTvShows}
          totalShowsCount={admin.totalTvShows}
          searchQuery={admin.searchQuery}
          currentPage={admin.tvPage}
          totalPages={admin.totalTvPages}
          onPageChange={admin.setTvPage}
          pageLoading={admin.pageLoading}
          canDelete={isOwner}
          onOpenCreate={() => {
            admin.setCreateContentType('tv_show');
            admin.setIsCreateModalOpen(true);
          }}
          onOpenEdit={(show) => {
            admin.setEditingItem({
              type: 'tv_show',
              relativePath: show.relativePath,
              frontmatter: { ...show.frontmatter },
              content: show.content,
            });
            admin.setIsEditModalOpen(true);
          }}
          onOpenEditEpisode={(ep) => {
            admin.setEditingItem({
              type: 'tv_episode',
              relativePath: ep.relativePath,
              frontmatter: { ...ep.frontmatter },
              content: ep.content,
            });
            admin.setIsEditModalOpen(true);
          }}
          onDeleteShow={(path, title) => {
            if (!isOwner) {
              admin.showToast('Hanya Owner yang berhak menghapus konten', 'error');
              return;
            }
            admin.setDeleteTarget({ path, title });
          }}
          onDeleteEpisode={(path, title) => {
            if (!isOwner) {
              admin.showToast('Hanya Owner yang berhak menghapus konten', 'error');
              return;
            }
            admin.setDeleteTarget({ path, title });
          }}
          onQuickAddEpisode={(show, seasonSlug) => {
            setQuickAddContext({ show, seasonSlug });
            admin.setCreateContentType('tv_episode');
            admin.setIsCreateModalOpen(true);
          }}
          selectedPaths={admin.selectedBatchPaths}
          onToggleSelect={admin.toggleBatchSelect}
          onSelectAll={admin.selectAll}
          onClearSelection={admin.clearSelection}
        />
      )}

      {/* Create Modal */}
      <CreateModal
        isOpen={admin.isCreateModalOpen}
        onClose={() => {
          admin.setIsCreateModalOpen(false);
          setQuickAddContext(null);
        }}
        contentType={admin.createContentType}
        setContentType={admin.setCreateContentType}
        quickAddContext={quickAddContext}
        onSubmit={admin.handleCreateSubmit}
        movies={admin.movies}
        tvShows={admin.tvShows}
        showToast={admin.showToast}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={admin.isEditModalOpen}
        onClose={() => {
          admin.setIsEditModalOpen(false);
          admin.setEditingItem(null);
        }}
        editingItem={admin.editingItem}
        setEditingItem={admin.setEditingItem}
        onSubmit={admin.handleEditSubmit}
        tvShows={admin.tvShows}
        showToast={admin.showToast}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={admin.isSettingsOpen}
        onClose={() => admin.setIsSettingsOpen(false)}
        ghToken={admin.ghToken}
        setGhToken={admin.setGhToken}
        ghOwner={admin.ghOwner}
        setGhOwner={admin.setGhOwner}
        ghRepo={admin.ghRepo}
        setGhRepo={admin.setGhRepo}
        ghBranch={admin.ghBranch}
        setGhBranch={admin.setGhBranch}
        onSave={admin.saveSettings}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(admin.deleteTarget)}
        onClose={() => admin.setDeleteTarget(null)}
        onConfirm={admin.handleDeleteConfirm}
        title={admin.deleteTarget?.title || ''}
        path={admin.deleteTarget?.path || ''}
        isBatch={admin.deleteTarget?.isBatch}
        count={admin.deleteTarget?.count}
      />
    </div>
  );
}
