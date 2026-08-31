import React, { useState } from 'react';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { TMDBBackdropImage } from '../types';

interface BackdropPickerProps {
  backdrops: TMDBBackdropImage[];
  selectedUrl?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
  title?: string;
}

export const BackdropPicker: React.FC<BackdropPickerProps> = ({
  backdrops,
  selectedUrl,
  onSelect,
  onClose,
  title = 'Pilih Backdrop',
}) => {
  const [selectedLang, setSelectedLang] = useState<string>('all');

  const availableLangs = Array.from(new Set(backdrops.map((b) => b.language)));

  const languageTabs = [
    { code: 'all', label: `Semua (${backdrops.length})` },
    ...availableLangs.map((lang) => {
      const count = backdrops.filter((b) => b.language === lang).length;
      const langLabel =
        lang === 'xx' || lang === 'null'
          ? `No Text (${count})`
          : lang.toUpperCase() === 'ID'
          ? `ID (${count})`
          : lang.toUpperCase() === 'EN'
          ? `EN (${count})`
          : `${lang.toUpperCase()} (${count})`;
      return { code: lang, label: langLabel };
    }),
  ];

  const filteredBackdrops = backdrops.filter(
    (b) => selectedLang === 'all' || b.language === selectedLang
  );

  return (
    <div className="mt-2 p-2.5 bg-[#090e1f] border border-cyan-500/30 rounded-lg space-y-2 animate-fade-in shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
          <ImageIcon size={12} />
          {title} ({filteredBackdrops.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-slate-400 hover:text-white"
        >
          Tutup
        </button>
      </div>

      {/* Language filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {languageTabs.map((tab) => (
          <button
            key={tab.code}
            type="button"
            onClick={() => setSelectedLang(tab.code)}
            className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-all ${
              selectedLang === tab.code
                ? 'bg-cyan-500 text-black'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
        {filteredBackdrops.map((b, idx) => {
          const isSelected = selectedUrl === b.url || selectedUrl === b.originalUrl;
          return (
            <div
              key={`${b.filePath}-${idx}`}
              onClick={() => onSelect(b.url)}
              className={`group relative rounded overflow-hidden border cursor-pointer transition-all aspect-video ${
                isSelected
                  ? 'ring-1 ring-cyan-400 border-cyan-400'
                  : 'border-white/10 hover:border-cyan-500/50 bg-black/40'
              }`}
            >
              <div className="relative w-full h-full">
                <Image
                  src={b.thumbUrl || b.url}
                  alt="Backdrop"
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="absolute top-0.5 left-0.5">
                <span className="px-1 py-0.2 rounded text-[7px] font-bold bg-black/80 text-cyan-300">
                  {b.language === 'xx' || b.language === 'null' ? 'No Text' : b.language.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
