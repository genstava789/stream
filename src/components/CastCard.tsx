import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { Cast } from '@/types/tmdb';
import { getImageUrl } from '@/lib/tmdb';

interface CastCardProps {
  cast: Cast;
}

export default function CastCard({ cast }: CastCardProps) {
  return (
    <div
      className="flex flex-col items-center text-center p-3 rounded-3xl min-w-[115px] sm:min-w-[135px] max-w-[125px] sm:max-w-[145px] transition-all duration-300 hover:scale-105 active:scale-95 group/cast flex-shrink-0"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Avatar (Circular, borderless/no outline, soft ambient shadow) */}
      <div
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2.5 flex-shrink-0 transition-transform duration-300 group-hover/cast:scale-105"
        style={{
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(124, 58, 237, 0.15))',
        }}
      >
        {cast.profile_path ? (
          <Image
            src={getImageUrl(cast.profile_path, 'w200')}
            alt={cast.name}
            fill
            className="object-cover transition-transform duration-300 group-hover/cast:scale-110"
            sizes="(max-width: 640px) 80px, 96px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800/60">
            <User size={30} className="text-slate-400" />
          </div>
        )}
      </div>

      {/* Name & Character */}
      <div className="w-full px-1">
        <p className="text-xs sm:text-sm font-bold text-white leading-tight line-clamp-1 group-hover/cast:text-cyan-300 transition-colors">
          {cast.name}
        </p>
        <p className="text-[11px] sm:text-xs text-slate-400 leading-tight mt-1 line-clamp-1">
          {cast.character || 'Cast'}
        </p>
      </div>
    </div>
  );
}
