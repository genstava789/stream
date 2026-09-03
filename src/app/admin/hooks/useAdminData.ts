import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MovieItem,
  TVShowItem,
  TVEpisodeItem,
  EditingItemState,
  ToastNotification,
} from '../types';

const adminClientCache = new Map<string, any>();

export function useAdminData() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTvShows] = useState<TVShowItem[]>([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState<'movies' | 'tv' | 'users'>('movies');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createContentType, setCreateContentType] = useState<'movie' | 'tv_show' | 'tv_episode'>('movie');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; title: string; isBatch?: boolean; count?: number } | null>(null);

  // Batch selection
  const [selectedBatchPaths, setSelectedBatchPaths] = useState<string[]>([]);

  // Server-side Pagination (7 items per page)
  const ITEMS_PER_PAGE = 7;
  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);
  const [totalMovies, setTotalMovies] = useState(0);
  const [totalTvShows, setTotalTvShows] = useState(0);
  const [totalMoviePages, setTotalMoviePages] = useState(1);
  const [totalTvPages, setTotalTvPages] = useState(1);
  const [totalAllMoviesCount, setTotalAllMoviesCount] = useState(0);
  const [totalAllTvShowsCount, setTotalAllTvShowsCount] = useState(0);
  const [totalEpisodesCount, setTotalEpisodesCount] = useState(0);

  // GitHub Settings (Dedicated Content Repository)
  const [ghToken, setGhToken] = useState('');
  const [ghOwner, setGhOwner] = useState('genstava789');
  const [ghRepo, setGhRepo] = useState('filmes-content');
  const [ghBranch, setGhBranch] = useState('main');

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setMoviePage(1);
      setTvPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load GitHub credentials from MongoDB backend and localStorage fallback
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/github-sync', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            if (data.settings.owner) setGhOwner(data.settings.owner);
            if (data.settings.repo) setGhRepo(data.settings.repo);
            if (data.settings.branch) setGhBranch(data.settings.branch);
          }
        }
      } catch {}

      try {
        const savedToken = localStorage.getItem('gh_token') || '';
        const savedOwner = localStorage.getItem('gh_owner');
        const savedRepo = localStorage.getItem('gh_repo');
        const savedBranch = localStorage.getItem('gh_branch');
        if (savedToken) setGhToken(savedToken);
        if (savedOwner) setGhOwner(savedOwner);
        if (savedRepo && savedRepo !== 'stream') setGhRepo(savedRepo);
        if (savedBranch) setGhBranch(savedBranch);
      } catch {}
    })();
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      localStorage.setItem('gh_token', ghToken.trim());
      localStorage.setItem('gh_owner', ghOwner.trim());
      localStorage.setItem('gh_repo', ghRepo.trim());
      localStorage.setItem('gh_branch', ghBranch.trim());

      // Save to MongoDB backend as well
      await fetch('/api/admin/github-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          owner: ghOwner.trim(),
          repo: ghRepo.trim(),
          branch: ghBranch.trim(),
          token: ghToken.trim() || undefined,
        }),
      });

      setIsSettingsOpen(false);
      showToast('Pengaturan repository konten berhasil disimpan!');
    } catch {
      showToast('Gagal menyimpan pengaturan', 'error');
    }
  }, [ghToken, ghOwner, ghRepo, ghBranch, showToast]);

  const getHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (ghToken) h['x-github-token'] = ghToken.trim();
    if (ghOwner) h['x-github-owner'] = ghOwner.trim();
    if (ghRepo) h['x-github-repo'] = ghRepo.trim();
    if (ghBranch) h['x-github-branch'] = ghBranch.trim();
    return h;
  }, [ghToken, ghOwner, ghRepo, ghBranch]);

  // Filter & Sort state
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'rating' | 'title' | 'weight'>('newest');
  const [filterLanguage, setFilterLanguage] = useState<'all' | 'ID' | 'KR' | 'EN' | 'JP' | 'TH' | 'CN'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'trending' | 'featured'>('all');

  // Fetch paginated admin content
  const fetchContent = useCallback(
    async (options: { silent?: boolean; customMoviePage?: number; customTvPage?: number; force?: boolean } = {}) => {
      const mPage = options.customMoviePage !== undefined ? options.customMoviePage : moviePage;
      const tPage = options.customTvPage !== undefined ? options.customTvPage : tvPage;
      const cacheKey = `${mPage}_${tPage}_${debouncedSearch}_${sortOrder}_${filterLanguage}_${filterStatus}_${ITEMS_PER_PAGE}`;

      if (options.force) {
        adminClientCache.clear();
        setLoading(true);
        setPageLoading(true);
      }

      // Check client cache for instant render only if it contains complete data
      if (adminClientCache.has(cacheKey) && !options.force) {
        const cached = adminClientCache.get(cacheKey);
        if (cached && Array.isArray(cached.movies) && Array.isArray(cached.tvShows)) {
          setMovies(cached.movies);
          setTvShows(cached.tvShows);
          setTotalMovies(cached.totalMovies || 0);
          setTotalTvShows(cached.totalTvShows || 0);
          setTotalMoviePages(cached.totalMoviePages || 1);
          setTotalTvPages(cached.totalTvPages || 1);
          setTotalAllMoviesCount(cached.totalAllMoviesCount !== undefined ? cached.totalAllMoviesCount : (cached.totalMovies || 0));
          setTotalAllTvShowsCount(cached.totalAllTvShowsCount !== undefined ? cached.totalAllTvShowsCount : (cached.totalTvShows || 0));
          setTotalEpisodesCount(cached.totalEpisodesCount || 0);
          setLoading(false);
          setPageLoading(false);
          setIsInitialLoad(false);
          return;
        }
      }

      if (!options.silent) {
        if (isInitialLoad) setLoading(true);
        setPageLoading(true);
      }

      try {
        const queryParams = new URLSearchParams({
          moviePage: String(mPage),
          tvPage: String(tPage),
          search: debouncedSearch,
          limit: String(ITEMS_PER_PAGE),
          sort: sortOrder,
          language: filterLanguage,
          status: filterStatus,
        });

        const res = await fetch(`/api/admin/content?${queryParams.toString()}`, {
          headers: getHeaders(),
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.movies) && Array.isArray(data.tvShows)) {
            adminClientCache.set(cacheKey, data);
            setMovies(data.movies);
            setTvShows(data.tvShows);
            setTotalMovies(data.totalMovies || 0);
            setTotalTvShows(data.totalTvShows || 0);
            setTotalMoviePages(data.totalMoviePages || 1);
            setTotalTvPages(data.totalTvPages || 1);
            setTotalAllMoviesCount(data.totalAllMoviesCount !== undefined ? data.totalAllMoviesCount : (data.totalMovies || 0));
            setTotalAllTvShowsCount(data.totalAllTvShowsCount !== undefined ? data.totalAllTvShowsCount : (data.totalTvShows || 0));
            setTotalEpisodesCount(data.totalEpisodesCount || 0);
            if (options.force) {
              showToast('Data berhasil diperbarui!');
            }
          }
        } else {
          showToast('Gagal memuat konten admin', 'error');
        }
      } catch (err: any) {
        showToast('Koneksi ke API admin gagal', 'error');
      } finally {
        setLoading(false);
        setPageLoading(false);
        setIsInitialLoad(false);
      }
    },
    [getHeaders, moviePage, tvPage, debouncedSearch, sortOrder, filterLanguage, filterStatus, isInitialLoad, showToast]
  );

  const handleMoviePageChange = useCallback(
    (newPage: number) => {
      setMoviePage(newPage);
      const cacheKey = `${newPage}_${tvPage}_${debouncedSearch}_${sortOrder}_${filterLanguage}_${filterStatus}_${ITEMS_PER_PAGE}`;
      if (adminClientCache.has(cacheKey)) {
        const cached = adminClientCache.get(cacheKey);
        setMovies(cached.movies || []);
        setTotalMovies(cached.totalMovies || 0);
        setTotalMoviePages(cached.totalMoviePages || 1);
        setTotalAllMoviesCount(cached.totalAllMoviesCount !== undefined ? cached.totalAllMoviesCount : (cached.totalMovies || 0));
      } else {
        setPageLoading(true);
        fetchContent({ customMoviePage: newPage });
      }
    },
    [tvPage, debouncedSearch, sortOrder, filterLanguage, filterStatus, fetchContent]
  );

  const handleTvPageChange = useCallback(
    (newPage: number) => {
      setTvPage(newPage);
      const cacheKey = `${moviePage}_${newPage}_${debouncedSearch}_${sortOrder}_${filterLanguage}_${filterStatus}_${ITEMS_PER_PAGE}`;
      if (adminClientCache.has(cacheKey)) {
        const cached = adminClientCache.get(cacheKey);
        setTvShows(cached.tvShows || []);
        setTotalTvShows(cached.totalTvShows || 0);
        setTotalTvPages(cached.totalTvPages || 1);
        setTotalAllTvShowsCount(cached.totalAllTvShowsCount !== undefined ? cached.totalAllTvShowsCount : (cached.totalTvShows || 0));
      } else {
        setPageLoading(true);
        fetchContent({ customTvPage: newPage });
      }
    },
    [moviePage, debouncedSearch, sortOrder, filterLanguage, filterStatus, fetchContent]
  );

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // When sorting or filtering changes, reset to page 1 and fetch from server
  useEffect(() => {
    setMoviePage(1);
    setTvPage(1);
    fetchContent({ customMoviePage: 1, customTvPage: 1 });
  }, [sortOrder, filterLanguage, filterStatus]);

  // Handle instant, non-blocking tab switch
  const handleTabSwitch = useCallback((tab: 'movies' | 'tv') => {
    setActiveTab(tab);
  }, []);

  // Server-side sorted and filtered dataset for full database accuracy
  const processedMovies = movies;
  const processedTvShows = tvShows;

  const paginatedMovies = processedMovies;
  const paginatedTvShows = processedTvShows;
  const filteredMovies = processedMovies;
  const filteredTvShows = processedTvShows;

  const parseResponseSafe = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch {}
    }
    const text = await res.text().catch(() => '');
    return { error: text || `HTTP ${res.status} ${res.statusText}` };
  };

  // CRUD Handlers
  const handleCreateSubmit = async (payload: any) => {
    showToast('Menyimpan konten baru...');
    const res = await fetch('/api/admin/content/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await parseResponseSafe(res);
    if (!res.ok) {
      if (result.requiresToken) setIsSettingsOpen(true);
      throw new Error(result.error || 'Gagal membuat konten');
    }

    showToast('Konten berhasil dibuat & live!');
    adminClientCache.clear();
    setPageLoading(true);
    setMoviePage(1);
    setTvPage(1);
    try {
      await fetchContent({ customMoviePage: 1, customTvPage: 1, force: true });
    } finally {
      setPageLoading(false);
    }
  };

  const handleEditSubmit = async (item: any) => {
    showToast('Menyimpan perubahan...');
    const res = await fetch('/api/admin/content/edit', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        relativePath: item.relativePath,
        frontmatter: item.frontmatter,
        content: item.content,
        episodes: item.episodes,
      }),
    });

    const result = await parseResponseSafe(res);
    if (!res.ok) {
      if (result.requiresToken) setIsSettingsOpen(true);
      throw new Error(result.error || 'Gagal menyimpan perubahan');
    }

    showToast('Perubahan berhasil disimpan & live!');
    adminClientCache.clear();
    setPageLoading(true);
    try {
      await fetchContent({ force: true });
    } finally {
      setPageLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { path, isBatch, count } = deleteTarget;
    setDeleteTarget(null);

    showToast(isBatch ? `Menghapus ${count} konten...` : 'Menghapus konten...');

    try {
      const res = await fetch('/api/admin/content/delete', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(isBatch ? { paths: selectedBatchPaths } : { path }),
      });

      const result = await parseResponseSafe(res);
      if (!res.ok) {
        if (result.requiresToken) setIsSettingsOpen(true);
        throw new Error(result.error || 'Gagal menghapus konten');
      }

      showToast(isBatch ? `${count} konten berhasil dihapus!` : 'Konten berhasil dihapus!');
      const targetPaths = isBatch ? [...selectedBatchPaths] : [path];

      // Optimistically remove deleted items from client state immediately
      setMovies((prev) =>
        prev.filter((m) => !targetPaths.some((tp) => tp === m.relativePath || tp.includes(m.slug)))
      );
      setTvShows((prev) =>
        prev.filter((s) => !targetPaths.some((tp) => tp === s.relativePath || tp.includes(s.showSlug)))
      );
      setTotalMovies((prev) => Math.max(0, prev - (isBatch ? count || 1 : 1)));
      setTotalTvShows((prev) => Math.max(0, prev - (isBatch ? count || 1 : 1)));
      setTotalAllMoviesCount((prev) => Math.max(0, prev - (isBatch ? count || 1 : 1)));
      setTotalAllTvShowsCount((prev) => Math.max(0, prev - (isBatch ? count || 1 : 1)));

      setSelectedBatchPaths([]);
      adminClientCache.clear();
      setPageLoading(true);
      try {
        await fetchContent({ force: true });
      } finally {
        setPageLoading(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus', 'error');
    }
  };

  // Background GitHub Sync Polling & Manual Sync
  const [syncingGitHub, setSyncingGitHub] = useState(false);

  const pollSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/github-sync', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'in_progress') {
        setSyncingGitHub(true);
        setTimeout(pollSyncStatus, 1500);
      } else if (data.status === 'completed') {
        setSyncingGitHub(false);
        const lastFinished = data.finishedAt ? Number(data.finishedAt) : 0;
        const lastNotified = Number(sessionStorage.getItem('last_notified_sync') || '0');
        if (lastFinished > lastNotified) {
          sessionStorage.setItem('last_notified_sync', String(lastFinished));
          showToast(data.message || `Sinkronisasi berhasil! ${data.syncedCount || 0} file dipush ke GitHub.`, 'success');
          fetchContent({ silent: true });
        }
      } else if (data.status === 'error') {
        setSyncingGitHub(false);
        const lastFinished = data.finishedAt ? Number(data.finishedAt) : 0;
        const lastNotified = Number(sessionStorage.getItem('last_notified_sync') || '0');
        if (lastFinished > lastNotified) {
          sessionStorage.setItem('last_notified_sync', String(lastFinished));
          showToast(data.error || 'Gagal menyinkronkan ke GitHub', 'error');
        }
      }
    } catch {}
  }, [fetchContent, showToast]);

  // Initial check on mount / refresh
  useEffect(() => {
    pollSyncStatus();
  }, [pollSyncStatus]);

  const [importingGitHub, setImportingGitHub] = useState(false);

  const handleManualSyncToGitHub = async () => {
    setSyncingGitHub(true);
    showToast(`Mengirim seluruh konten MongoDB ke repository '${ghOwner}/${ghRepo}'...`);

    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          owner: ghOwner.trim(),
          repo: ghRepo.trim(),
          branch: ghBranch.trim(),
          token: ghToken.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setSyncingGitHub(false);
        showToast(result.message || `Berhasil dipush! ${result.syncedCount || 0} file tersinkron ke ${result.repo}.`, 'success');
        fetchContent({ silent: true });
      } else {
        setSyncingGitHub(false);
        if (result.requiresToken) setIsSettingsOpen(true);
        showToast(result.error || 'Gagal menyinkronkan ke GitHub', 'error');
      }
    } catch {
      setSyncingGitHub(false);
      showToast('Koneksi ke API sync gagal', 'error');
    }
  };

  const handleImportFromGitHub = async () => {
    if (!window.confirm(`Tarik dan impor seluruh konten Markdown dari repository '${ghOwner}/${ghRepo}' ke MongoDB? Data di MongoDB akan tersinkronisasi sesuai file repository.`)) {
      return;
    }

    setImportingGitHub(true);
    showToast(`Mengimpor file Markdown dari repository '${ghOwner}/${ghRepo}' ke MongoDB...`);

    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          owner: ghOwner.trim(),
          repo: ghRepo.trim(),
          branch: ghBranch.trim(),
          token: ghToken.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setImportingGitHub(false);
        showToast(result.message || `Import sukses! ${result.totalFiles || 0} file diproses.`, 'success');
        adminClientCache.clear();
        fetchContent({ force: true });
      } else {
        setImportingGitHub(false);
        if (result.requiresToken) setIsSettingsOpen(true);
        showToast(result.error || 'Gagal mengimpor dari GitHub', 'error');
      }
    } catch {
      setImportingGitHub(false);
      showToast('Koneksi ke API import gagal', 'error');
    }
  };

  const toggleBatchSelect = (path: string) => {
    setSelectedBatchPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const selectAll = (paths: string[]) => {
    setSelectedBatchPaths(paths);
  };

  const clearSelection = () => {
    setSelectedBatchPaths([]);
  };

  return {
    movies,
    tvShows,
    loading,
    pageLoading,
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
    filteredMovies,
    filteredTvShows,
    paginatedMovies,
    paginatedTvShows,
    totalMovies,
    totalTvShows,
    totalAllMoviesCount,
    totalAllTvShowsCount,
    moviePage,
    setMoviePage: handleMoviePageChange,
    totalMoviePages,
    tvPage,
    setTvPage: handleTvPageChange,
    totalTvPages,
    totalEpisodesCount,
    isCreateModalOpen,
    setIsCreateModalOpen,
    createContentType,
    setCreateContentType,
    isEditModalOpen,
    setIsEditModalOpen,
    editingItem,
    setEditingItem,
    isSettingsOpen,
    setIsSettingsOpen,
    deleteTarget,
    setDeleteTarget,
    selectedBatchPaths,
    setSelectedBatchPaths,
    toggleBatchSelect,
    selectAll,
    clearSelection,
    ghToken,
    setGhToken,
    ghOwner,
    setGhOwner,
    ghRepo,
    setGhRepo,
    ghBranch,
    setGhBranch,
    saveSettings,
    toasts,
    showToast,
    fetchContent,
    handleCreateSubmit,
    handleEditSubmit,
    handleDeleteConfirm,
    handleManualSyncToGitHub,
    syncingGitHub,
    handleImportFromGitHub,
    importingGitHub,
  };
}
