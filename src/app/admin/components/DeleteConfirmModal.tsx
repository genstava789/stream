import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  path: string;
  isBatch?: boolean;
  count?: number;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  path,
  isBatch = false,
  count = 1,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0e1424] border border-red-500/30 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <h2 className="text-base font-bold text-white">
              {isBatch ? `Hapus ${count} Konten?` : 'Konfirmasi Hapus Konten'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-300">
            Apakah Anda yakin ingin menghapus{' '}
            <strong className="text-white font-bold">{title}</strong>?
          </p>
          <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20 text-[11px] text-red-300 font-mono break-all">
            {path}
          </div>
          <p className="text-[11px] text-slate-400">
            Tindakan ini akan menghapus file Markdown secara permanen dari repository/folder.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Trash2 size={14} />
            <span>Hapus Permanen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
