import React from 'react';
import { BookOpen } from 'lucide-react';

interface MarkdownRendererProps {
  contentHtml: string;
  title?: string;
}

export default function MarkdownRenderer({ contentHtml, title }: MarkdownRendererProps) {
  if (!contentHtml) return null;

  return (
    <section className="w-full">
      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: 'rgba(12, 18, 36, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-center gap-2.5 pb-4 mb-6 border-b border-white/10">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(124, 58, 237, 0.2)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              color: '#a78bfa',
            }}
          >
            <BookOpen size={16} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              {title ? `${title} - Catatan & Informasi Kustom` : 'Catatan & Sinopsis Tambahan'}
            </h2>
            <p className="text-xs text-neo-text-muted">Konten ter-render langsung dari file markdown statis</p>
          </div>
        </div>

        {/* Rendered HTML Container */}
        <div
          className="custom-markdown-content"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>
    </section>
  );
}
