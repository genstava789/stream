import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cloud,
  Folder,
  Film,
  FileText,
  File,
  Search,
  X,
  ChevronRight,
  ArrowLeft,
  RotateCw,
  Check,
  Copy,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Database,
} from 'lucide-react';
import { S3ItemFile, S3BrowseResult } from '@/lib/s3/client';

interface S3BrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, file: S3ItemFile) => void;
  filterMode?: 'all' | 'video' | 'subtitle';
  targetFieldLabel?: string;
}

export const S3BrowserModal: React.FC<S3BrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  filterMode = 'all',
  targetFieldLabel = 'URL Video Stream',
}) => {
  const [currentBucket, setCurrentBucket] = useState<string>('cloud');
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'subtitle'>(filterMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<S3BrowseResult>({
    buckets: ['cloud', 'my'],
    currentBucket: 'cloud',
    prefix: '',
    folders: [],
    files: [],
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (filterMode) {
      setActiveTab(filterMode);
    }
  }, [filterMode]);

  const fetchS3Content = useCallback(
    async (bucket: string, prefix: string) => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          bucket,
          prefix,
        });
        const res = await fetch(`/api/admin/s3/browse?${queryParams.toString()}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setData(json);
        } else {
          setError(json.error || 'Gagal memuat isi bucket S3');
        }
      } catch (err: any) {
        setError(err.message || 'Gagal menghubungi server storage S3');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      fetchS3Content(currentBucket, currentPrefix);
    }
  }, [isOpen, currentBucket, currentPrefix, fetchS3Content]);

  // Handle Breadcrumb Navigation
  const breadcrumbs = useMemo(() => {
    if (!currentPrefix) return [];
    const parts = currentPrefix.split('/').filter(Boolean);
    let cumulative = '';
    return parts.map((part) => {
      cumulative += `${part}/`;
      return {
        name: part,
        prefix: cumulative,
      };
    });
  }, [currentPrefix]);

  const handleNavigateFolder = (folderPrefix: string) => {
    setSearchQuery('');
    setCurrentPrefix(folderPrefix);
  };

  const handleNavigateUp = () => {
    if (!currentPrefix) return;
    const parts = currentPrefix.split('/').filter(Boolean);
    parts.pop();
    const newPrefix = parts.length > 0 ? `${parts.join('/')}/` : '';
    setSearchQuery('');
    setCurrentPrefix(newPrefix);
  };

  const handleBucketChange = (newBucket: string) => {
    setCurrentBucket(newBucket);
    setCurrentPrefix('');
    setSearchQuery('');
  };

  const handleCopyUrl = (url: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredFiles = useMemo(() => {
    return data.files.filter((file) => {
      // Filter by search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!file.name.toLowerCase().includes(q) && !file.key.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Filter by type tab
      if (activeTab === 'video') return file.isVideo;
      if (activeTab === 'subtitle') return file.isSubtitle;
      return true;
    });
  }, [data.files, searchQuery, activeTab]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return data.folders;
    const q = searchQuery.toLowerCase();
    return data.folders.filter((f) => f.toLowerCase().includes(q));
  }, [data.folders, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0b1021] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-cyan-950/40 via-black/40 to-blue-950/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0 shadow-lg shadow-cyan-500/10">
              <Cloud size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                  Storage Browser (Hugging Face S3)
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Ceph
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Pilih file untuk mengisi <span className="text-cyan-300 font-semibold">{targetFieldLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Bucket Switcher */}
            <div className="relative flex items-center bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-cyan-500">
              <Database size={13} className="text-cyan-400 mr-1.5" />
              <select
                value={currentBucket}
                onChange={(e) => handleBucketChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
                title="Pilih Bucket"
              >
                {(data.buckets || ['cloud', 'my']).map((b) => (
                  <option key={b} value={b} className="bg-[#0b1021] text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
              title="Tutup Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation & Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-white/5 bg-[#080d1a] space-y-3">
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 text-xs text-slate-300 overflow-x-auto py-1 font-mono">
            {currentPrefix && (
              <button
                type="button"
                onClick={handleNavigateUp}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 border border-white/10 flex items-center mr-1"
                title="Ke Folder Sebelumnya"
              >
                <ArrowLeft size={13} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentPrefix('')}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-white/10 transition-colors ${
                !currentPrefix ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-400'
              }`}
            >
              <HardDrive size={13} />
              <span>{currentBucket}</span>
            </button>

            {breadcrumbs.map((bc, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={bc.prefix}>
                  <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />
                  <button
                    type="button"
                    onClick={() => setCurrentPrefix(bc.prefix)}
                    className={`px-2 py-1 rounded-lg hover:bg-white/10 transition-colors truncate max-w-[150px] ${
                      isLast ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-400'
                    }`}
                  >
                    {bc.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Search & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari file atau folder di S3..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                Semua ({data.files.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('video')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'video'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Film size={12} />
                <span>Video ({data.files.filter((f) => f.isVideo).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subtitle')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'subtitle'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <FileText size={12} />
                <span>Subtitle ({data.files.filter((f) => f.isSubtitle).length})</span>
              </button>
              <button
                type="button"
                onClick={() => fetchS3Content(currentBucket, currentPrefix)}
                disabled={loading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
                title="Muat Ulang"
              >
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Content List Area */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchS3Content(currentBucket, currentPrefix)}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-bold"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCw size={24} className="animate-spin text-cyan-400" />
              <p className="text-xs">Menjelajahi berkas dari bucket {currentBucket}...</p>
            </div>
          ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Folder size={32} className="opacity-40" />
              <p className="text-xs font-medium">Tidak ada file atau folder yang sesuai</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-cyan-400 hover:underline mt-1"
                >
                  Hapus filter pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Folders List */}
              {filteredFolders.map((folder) => {
                const folderName = folder.replace(currentPrefix, '').replace(/\/$/, '');
                return (
                  <div
                    key={folder}
                    onClick={() => handleNavigateFolder(folder)}
                    className="group p-3 rounded-xl bg-white/[0.03] hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 flex items-center justify-between gap-3 cursor-pointer transition-all select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Folder size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                          {folderName}
                        </h4>
                        <span className="text-[10px] text-slate-500">Direktori / Folder</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                );
              })}

              {/* Files List */}
              {filteredFiles.map((file) => {
                const isVideo = file.isVideo;
                const isSub = file.isSubtitle;
                const iconColor = isVideo ? 'text-purple-400' : isSub ? 'text-emerald-400' : 'text-slate-400';
                const bgColor = isVideo ? 'bg-purple-500/10 border-purple-500/30' : isSub ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10';

                return (
                  <div
                    key={file.key}
                    className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center ${iconColor} flex-shrink-0`}>
                        {isVideo ? <Film size={16} /> : isSub ? <FileText size={16} /> : <File size={16} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-md" title={file.name}>
                            {file.name}
                          </h4>
                          {isVideo && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                              Video
                            </span>
                          )}
                          {isSub && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                              Subtitle
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span>{file.sizeFormatted}</span>
                          {file.lastModified && (
                            <span>Modifikasi: {new Date(file.lastModified).toLocaleDateString('id-ID')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleCopyUrl(file.streamUrl, file.key, e)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors border border-white/10"
                        title="Salin URL Streaming"
                      >
                        {copiedKey === file.key ? (
                          <>
                            <CheckCircle size={13} className="text-emerald-400" />
                            <span className="text-[11px] text-emerald-300">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span className="text-[11px]">Salin URL</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelect(file.streamUrl, file);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-500/20 active:scale-95"
                      >
                        <Check size={13} />
                        <span>Pilih File</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#080d1a] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="truncate">
              Bucket: <strong className="text-white">{currentBucket}</strong> | Lokasi: <strong className="text-slate-300">/{currentPrefix}</strong>
            </span>
          </div>
          <div className="text-right text-slate-500 text-[10px]">
            Hugging Face S3 Endpoint: <code className="text-slate-400">https://s3.hf.co/nexus33rd</code>
          </div>
        </div>
      </div>
    </div>
  );
};
