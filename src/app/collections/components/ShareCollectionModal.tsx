'use client';

import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Send,
  Twitter,
  Facebook,
  Sparkles,
} from 'lucide-react';

interface ShareCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemCount: number;
}

export default function ShareCollectionModal({
  isOpen,
  onClose,
  title,
  itemCount,
}: ShareCollectionModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Lihat koleksi "${title}" (${itemCount} judul) di Filmes!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const socialLinks = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${currentUrl}`)}`,
    },
    {
      name: 'Telegram',
      icon: Send,
      color: 'hover:bg-sky-500/20 text-sky-400 border-sky-500/30',
      url: `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'X (Twitter)',
      icon: Twitter,
      color: 'hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(currentUrl)}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'hover:bg-blue-500/20 text-blue-400 border-blue-500/30',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#090e21] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)] p-6 sm:p-7 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Bagikan Koleksi</h3>
              <p className="text-[11px] text-slate-400">Bagikan daftar kurasi ini ke teman-temanmu</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Collection Title Snippet */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 mb-5">
          <p className="text-xs text-slate-400 mb-0.5">Judul Koleksi:</p>
          <p className="text-sm font-bold text-white line-clamp-1">{title}</p>
          <span className="text-[10px] text-cyan-400 font-bold">{itemCount} Judul Film & Series</span>
        </div>

        {/* Copy Link Input Section */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Link Halaman:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-slate-300 text-xs font-mono select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 flex-shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 scale-105'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Social Share Grid */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2">Bagikan Langsung:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/[0.03] border transition-all duration-200 hover:scale-105 active:scale-95 ${social.color}`}
                >
                  <Icon size={18} className="mb-1" />
                  <span className="text-[11px] font-bold text-slate-300">{social.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
