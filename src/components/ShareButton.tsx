'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  url?: string;
}

export default function ShareButton({ title, url }: ShareButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const getShareUrl = () => {
    if (url) return url;
    if (typeof window !== 'undefined') return window.location.href;
    return '';
  };

  const shareUrl = getShareUrl();

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCopyLink = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  // Close modal on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setModalOpen(false);
      }
    };
    if (modalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [modalOpen]);

  return (
    <>
      {/* Share Button Trigger */}
      <button
        type="button"
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-200 hover:text-cyan-300 transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
        title="Bagikan Tontonan"
      >
        <Share2 size={16} className="text-cyan-400" />
        <span>Share</span>
      </button>

      {/* Centered Modal with Full-Screen Blurred Backdrop */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <div
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
          />

          {/* Centered Dialog */}
          <div
            ref={modalRef}
            className="relative w-full max-w-md p-5 rounded-3xl border shadow-2xl z-10 animate-in zoom-in-95 duration-200"
            style={{
              background: 'rgba(9, 13, 30, 0.96)',
              backdropFilter: 'blur(30px)',
              borderColor: 'rgba(6, 182, 212, 0.35)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(6, 182, 212, 0.15)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(124, 58, 237, 0.2))',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                  }}
                >
                  <Share2 size={16} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bagikan Link</h3>
                  <p className="text-[11px] text-slate-400">Salin tautan untuk membagikan tontonan ini</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Clean Copy Link Input Bar */}
            <div
              className="flex items-center justify-between p-2 pl-3.5 rounded-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-xs text-slate-200 focus:outline-none flex-1 truncate pr-3 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 flex-shrink-0"
                style={{
                  background: copied
                    ? '#22c55e'
                    : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                  boxShadow: copied
                    ? '0 0 15px rgba(34, 197, 94, 0.6)'
                    : '0 0 12px rgba(6, 182, 212, 0.3)',
                }}
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
        </div>
      )}
    </>
  );
}
