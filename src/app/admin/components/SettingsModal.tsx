import React from 'react';
import { Settings, ShieldCheck, X } from 'lucide-react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b1329] border border-cyan-500/30 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <Settings size={20} />
            <h2 className="text-base font-bold text-white">Pengaturan Backup GitHub Terpisah</h2>
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
            Alur backup konten Markdown diarahkan ke <strong>repository terpisah</strong> (misal: <code className="text-white font-mono">filmes-content</code>) agar storage source code inti tetap bersih dan hemat.
          </p>
        </div>

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
              <label className="block text-xs font-bold text-slate-300 mb-1.5">GitHub Owner</label>
              <input
                type="text"
                value={ghOwner}
                onChange={(e) => setGhOwner(e.target.value)}
                placeholder="genstava789"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Backup Repository</label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="filmes-content"
                className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Branch</label>
            <input
              type="text"
              value={ghBranch}
              onChange={(e) => setGhBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3.5 py-2.5 sm:py-3 bg-black/50 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-h-[42px]"
            />
          </div>
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
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
