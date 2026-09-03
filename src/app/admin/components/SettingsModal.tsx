import React, { useState } from 'react';
import { Settings, ShieldCheck, X, CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { parseGitHubRepoInput } from '@/lib/githubStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ghToken: string;
  setGhToken: (v: string) => void;
  ghOwner: string;
  setGhOwner: (v: string) => void;
  ghRepo: string;
  setGhRepo: (v: string) => void;
  ghBranch: string;
  setGhBranch: (v: string) => void;
  onSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  ghToken,
  setGhToken,
  ghOwner,
  setGhOwner,
  ghRepo,
  setGhRepo,
  ghBranch,
  setGhBranch,
  onSave,
}) => {
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const isMainCodeRepo = ghRepo.trim().toLowerCase() === 'stream';

  const handleRepoChange = (val: string) => {
    const trimmed = val.trim();
    // If user pasted a URL or owner/repo slug, auto-parse it
    if (trimmed.includes('/') || trimmed.includes('github.com')) {
      const parsed = parseGitHubRepoInput(trimmed, ghOwner);
      if (parsed.owner && parsed.owner !== ghOwner) {
        setGhOwner(parsed.owner);
      }
      setGhRepo(parsed.repo);
    } else {
      setGhRepo(val);
    }
  };

  const handleTestConnection = async () => {
    if (!ghToken.trim()) {
      setTestStatus({
        type: 'error',
        message: 'Masukkan GitHub Personal Access Token (PAT) terlebih dahulu.',
      });
      return;
    }

    setTesting(true);
    setTestStatus(null);

    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          owner: ghOwner.trim(),
          repo: ghRepo.trim(),
          branch: ghBranch.trim(),
          token: ghToken.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus({
          type: 'success',
          message: data.message || `Terhubung ke ${data.repoName}!`,
        });
      } else {
        setTestStatus({
          type: 'error',
          message: data.error || 'Gagal terhubung ke repository GitHub.',
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: 'Gagal menghubungi server untuk mengetes koneksi.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b1329] border border-cyan-500/30 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <Settings size={20} />
            <h2 className="text-base font-bold text-white">Pengaturan Dedicated Content Repository</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-cyan-200 text-xs flex items-start gap-2">
          <ShieldCheck size={18} className="flex-shrink-0 mt-0.5 text-cyan-400" />
          <p>
            Konten Markdown disimpan di <strong>repository terpisah</strong> (misal: <code className="text-white font-mono">filmes-content</code>) agar repository source code utama (<code className="text-amber-300 font-mono">stream</code>) tetap ramping, cepat dideploy, dan tidak penuh dengan riwayat commit konten.
          </p>
        </div>

        {isMainCodeRepo && (
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2 animate-pulse">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <strong className="block text-amber-300">Peringatan: Repository Kode Sumber</strong>
              <p>
                <code className="font-mono text-white">stream</code> adalah repository aplikasi Next.js ini. Untuk mencegah membengkaknya ukuran project utama, buat dan gunakan repository konten baru (contoh: <code className="text-cyan-300 font-mono">filmes-content</code>).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx..."
              className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono min-h-[42px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">GitHub Owner / Akun</label>
              <input
                type="text"
                value={ghOwner}
                onChange={(e) => setGhOwner(e.target.value)}
                placeholder="genstava789"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Content Repository (Terpisah)
              </label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
                placeholder="filmes-content"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Branch Target</label>
            <input
              type="text"
              value={ghBranch}
              onChange={(e) => setGhBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
            />
          </div>
        </div>

        {/* Test Connection Button & Result */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !ghToken.trim()}
            className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {testing ? (
              <>
                <Loader2 size={14} className="animate-spin text-cyan-400" />
                <span>Menghubungi GitHub API...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-cyan-400" />
                <span>Test Koneksi Repository ({ghOwner}/{ghRepo})</span>
              </>
            )}
          </button>

          {testStatus && (
            <div
              className={`mt-2.5 p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                testStatus.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              }`}
            >
              {testStatus.type === 'success' ? (
                <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-rose-400" />
              )}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all min-h-[40px]"
          >
            Batal
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 transition-all active:scale-95 min-h-[40px]"
          >
            Simpan ke Database & Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
