'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, X, Star } from 'lucide-react';
import { Movie } from '@/types/tmdb';
import { searchMovies, getImageUrl } from '@/lib/tmdb';
import { getMovieUrl } from '@/lib/urls';

interface SearchBarProps {
  onClose?: () => void;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
}

export default function SearchBar({ onClose, autoFocus = false, className = '', compact = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await searchMovies(q, 1);
      setResults(data.results.slice(0, 5));
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      onClose?.();
    }
  };

  const handleResultClick = (movie: Movie) => {
    setIsOpen(false);
    setQuery('');
    router.push(getMovieUrl(movie));
    onClose?.();
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: isOpen ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: isOpen ? '0 0 15px rgba(6,182,212,0.15)' : 'none',
          }}
        >
          <Search size={16} className="text-neo-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => query && setIsOpen(true)}
            placeholder="Search movies..."
            className="bg-transparent text-neo-text-primary placeholder-neo-text-muted text-sm flex-1 min-w-0 focus:outline-none"
          />
          {isLoading && (
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 animate-spin"
              style={{
                border: '2px solid transparent',
                borderTopColor: '#06b6d4',
              }}
            />
          )}
          {query && !isLoading && (
            <button type="button" onClick={clearSearch} className="flex-shrink-0">
              <X size={14} className="text-neo-text-muted hover:text-neo-text-primary transition-colors" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            background: '#0B1020',
            border: '1px solid rgba(6,182,212,0.3)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(6,182,212,0.1)',
          }}
        >
          {results.map((movie) => (
            <button
              key={movie.id}
              onClick={() => handleResultClick(movie)}
              className="w-full flex items-center gap-3 p-3 text-left transition-colors duration-150 hover:bg-white/5"
            >
              <div className="relative w-10 h-14 rounded-md overflow-hidden flex-shrink-0"
                style={{ background: '#0f172a' }}>
                {movie.poster_path ? (
                  <Image
                    src={getImageUrl(movie.poster_path, 'w200')}
                    alt={movie.title}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Search size={14} className="text-neo-text-muted" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-neo-text-primary text-sm font-medium truncate">{movie.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-neo-text-muted text-xs">
                    {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs" style={{ color: '#eab308' }}>
                    <Star size={10} fill="currentColor" />
                    {movie.vote_average.toFixed(1)}
                  </span>
                </div>
              </div>
            </button>
          ))}
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="w-full p-3 text-center text-sm font-medium transition-colors duration-150"
            style={{
              color: '#06b6d4',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            See all results for &quot;{query}&quot;
          </button>
        </div>
      )}
    </div>
  );
}
