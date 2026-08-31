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

  // GitHub Settings
  const [ghToken, setGhToken] = useState('');
  const [ghOwner, setGhOwner] = useState('genstava789');
  const [ghRepo, setGhRepo] = useState('filmes');
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

  // Load GitHub credentials from localStorage
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('gh_token') || '';
      const savedOwner = localStorage.getItem('gh_owner') || 'genstava789';
      const savedRepo = localStorage.getItem('gh_repo') || 'filmes';
      const savedBranch = localStorage.getItem('gh_branch') || 'main';
      if (savedToken) setGhToken(savedToken);
      if (savedOwner) setGhOwner(savedOwner);
      if (savedRepo) setGhRepo(savedRepo);
      if (savedBranch) setGhBranch(savedBranch);
    } catch {}
  }, []);

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('gh_token', ghToken.trim());
      localStorage.setItem('gh_owner', ghOwner.trim());
      localStorage.setItem('gh_repo', ghRepo.trim());
      localStorage.setItem('gh_branch', ghBranch.trim());
      setIsSettingsOpen(false);
      showToast('Pengaturan GitHub berhasil disimpan!');
    } catch {
      showToast('Gagal menyimpan pengaturan ke localStorage', 'error');
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

  // Fetch paginated admin content
  const fetchContent = useCallback(
    async (options: { silent?: boolean; customMoviePage?: number; customTvPage?: number; force?: boolean } = {}) => {
      const mPage = options.customMoviePage !== undefined ? options.customMoviePage : moviePage;
      const tPage = options.customTvPage !== undefined ? options.customTvPage : tvPage;
      const cacheKey = `${mPage}_${tPage}_${debouncedSearch}_${ITEMS_PER_PAGE}`;

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
    [getHeaders, moviePage, tvPage, debouncedSearch, isInitialLoad, showToast]
  );

  const handleMoviePageChange = useCallback(
    (newPage: number) => {
      setMoviePage(newPage);
      const cacheKey = `${newPage}_${tvPage}_${debouncedSearch}_${ITEMS_PER_PAGE}`;
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
    [tvPage, debouncedSearch, fetchContent]
  );

  const handleTvPageChange = useCallback(
    (newPage: number) => {
      setTvPage(newPage);
      const cacheKey = `${moviePage}_${newPage}_${debouncedSearch}_${ITEMS_PER_PAGE}`;
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
    [moviePage, debouncedSearch, fetchContent]
  );

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Filter & Sort state
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'rating' | 'title' | 'weight'>('newest');
  const [filterLanguage, setFilterLanguage] = useState<'all' | 'ID' | 'KR' | 'EN' | 'JP' | 'TH' | 'CN'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'trending' | 'featured'>('all');

  // Handle instant, non-blocking tab switch
  const handleTabSwitch = useCallback((tab: 'movies' | 'tv') => {
    setActiveTab(tab);
  }, []);

  const processedMovies = useMemo(() => {
    let list = [...movies];
    // 1. Filter by language
    if (filterLanguage !== 'all') {
      list = list.filter((m) => (m.frontmatter?.language || 'ID').toUpperCase() === filterLanguage);
    }
    // 2. Filter by status
    if (filterStatus === 'trending') {
      list = list.filter((m) => Boolean(m.frontmatter?.trending));
    } else if (filterStatus === 'featured') {
      list = list.filter((m) => Boolean(m.frontmatter?.featured));
    }
    // 3. Sort
    if (sortOrder === 'oldest') {
      list.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    } else if (sortOrder === 'rating') {
      list.sort((a, b) => Number(b.frontmatter?.rating || b.rating || 0) - Number(a.frontmatter?.rating || a.rating || 0));
    } else if (sortOrder === 'title') {
      list.sort((a, b) => (a.displayTitle || a.frontmatter?.title || '').localeCompare(b.displayTitle || b.frontmatter?.title || ''));
    } else if (sortOrder === 'weight') {
      list.sort((a, b) => {
        const wA = a.frontmatter?.weight !== undefined ? Number(a.frontmatter.weight) : 999999;
        const wB = b.frontmatter?.weight !== undefined ? Number(b.frontmatter.weight) : 999999;
        return wA - wB;
      });
    } else {
      // newest
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return list;
  }, [movies, filterLanguage, filterStatus, sortOrder]);

  const processedTvShows = useMemo(() => {
    let list = [...tvShows];
    // 1. Filter by language
    if (filterLanguage !== 'all') {
      list = list.filter((s) => (s.frontmatter?.language || 'ID').toUpperCase() === filterLanguage);
    }
    // 2. Filter by status
    if (filterStatus === 'trending') {
      list = list.filter((s) => Boolean(s.frontmatter?.trending));
    } else if (filterStatus === 'featured') {
      list = list.filter((s) => Boolean(s.frontmatter?.featured));
    }
    // 3. Sort
    if (sortOrder === 'oldest') {
      list.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    } else if (sortOrder === 'rating') {
      list.sort((a, b) => Number(b.frontmatter?.rating || b.rating || 0) - Number(a.frontmatter?.rating || a.rating || 0));
    } else if (sortOrder === 'title') {
      list.sort((a, b) => (a.displayTitle || a.frontmatter?.title || '').localeCompare(b.displayTitle || b.frontmatter?.title || ''));
    } else if (sortOrder === 'weight') {
      list.sort((a, b) => {
        const wA = a.frontmatter?.weight !== undefined ? Number(a.frontmatter.weight) : 999999;
        const wB = b.frontmatter?.weight !== undefined ? Number(b.frontmatter.weight) : 999999;
        return wA - wB;
      });
    } else {
      // newest
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return list;
  }, [tvShows, filterLanguage, filterStatus, sortOrder]);

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

  const handleManualSyncToGitHub = async () => {
    setSyncingGitHub(true);
    showToast('Menyinkronkan konten ke GitHub di background server...');

    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'POST',
        headers: getHeaders(),
      });

      const result = await res.json();
      if (res.ok) {
        // Start polling server-side progress
        setTimeout(pollSyncStatus, 1000);
      } else {
        setSyncingGitHub(false);
        if (result.requiresToken) setIsSettingsOpen(true);
        showToast(result.error || 'Gagal memulai sinkronisasi ke GitHub', 'error');
      }
    } catch {
      setSyncingGitHub(false);
      showToast('Koneksi ke API sync gagal', 'error');
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
  };
}
