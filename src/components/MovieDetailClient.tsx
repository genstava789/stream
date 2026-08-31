'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bookmark, Film } from 'lucide-react';
import TrailerModal from '@/components/TrailerModal';
import ShareButton from '@/components/ShareButton';
import { useAuth } from '@/context/AuthContext';

interface MovieDetailClientProps {
  movieTitle: string;
  movieId?: string | number;
  posterPath?: string | null;
  trailerKey?: string | null;
  homepage?: string | null;
  hasCustomVideo?: boolean;
  rating?: number | string | null;
  releaseDate?: string | null;
}

export default function MovieDetailClient({
  movieTitle,
  movieId,
  posterPath,
  trailerKey,
  rating,
  releaseDate,
}: MovieDetailClientProps) {
  const [showTrailer, setShowTrailer] = useState(false);
  const { toggleWatchlist, isInWatchlist, addToHistory } = useAuth();

  const itemId = movieId || movieTitle;
  const isSaved = isInWatchlist(itemId);
  const hasRecordedRef = useRef(false);

  const numRating = rating !== undefined && rating !== null ? Number(rating) : undefined;

  // Automatically record view to user history once if logged in
  useEffect(() => {
    if (itemId && !hasRecordedRef.current) {
      hasRecordedRef.current = true;
      addToHistory({
        contentId: itemId,
        title: movieTitle,
        posterPath: posterPath || null,
        type: 'movie',
      });
    }
  }, [itemId, movieTitle, posterPath, addToHistory]);

  const handleWatchlistClick = () => {
    toggleWatchlist({
      contentId: itemId,
      title: movieTitle,
      posterPath: posterPath || null,
      type: 'movie',
      rating: numRating,
      releaseDate: releaseDate || undefined,
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {/* Watch Trailer Button */}
        {trailerKey && (
          <button
            onClick={() => setShowTrailer(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
            }}
          >
            <Film size={16} />
            <span>Watch Trailer</span>
          </button>
        )}

        {/* Watchlist Toggle Button */}
        <button
          onClick={handleWatchlistClick}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 hover:scale-105 active:scale-95 border ${
            isSaved
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
              : 'bg-white/5 text-slate-300 border-white/10 hover:text-white hover:bg-white/10'
          }`}
        >
          <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          <span>{isSaved ? 'Di Watchlist' : 'Tambah ke Watchlist'}</span>
        </button>

        {/* Social Share Button */}
        <ShareButton title={movieTitle} />
      </div>

      {/* Trailer Modal */}
      {showTrailer && trailerKey && (
        <TrailerModal
          videoKey={trailerKey}
          title={movieTitle}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </>
  );
}
