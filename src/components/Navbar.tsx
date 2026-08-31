'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Search, Menu, X, ChevronDown, Tv, MessageSquarePlus } from 'lucide-react';
import SearchBar from './SearchBar';
import { Genre } from '@/types/tmdb';
import siteConfig from '@/config';

interface NavbarProps {
  genres?: Genre[];
}

export default function Navbar({ genres = [] }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const pathname = usePathname();
  const genreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) {
        setGenreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setGenreDropdownOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? 'rgba(5,8,22,0.95)'
            : 'linear-gradient(to bottom, rgba(5,8,22,0.9), transparent)',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
          boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div
                className="p-1.5 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
              >
                <Film size={18} className="text-white" />
              </div>
              <span
                className="text-xl font-black tracking-wider hidden sm:block uppercase"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {siteConfig.nameUpper || siteConfig.name}
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive('/') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                Home
              </Link>
              <Link
                href="/movie"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive('/movie') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/movie') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                Movies
              </Link>
              <Link
                href="/tv"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1"
                style={{
                  color: isActive('/tv') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/tv') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                <Tv size={14} />
                TV Shows
              </Link>
              <Link
                href="/request"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
                style={{
                  color: isActive('/request') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/request') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                <MessageSquarePlus size={14} />
                Request
              </Link>

              {/* Genre Dropdown */}
              {genres.length > 0 && (
                <div ref={genreRef} className="relative">
                  <button
                    onClick={() => setGenreDropdownOpen(!genreDropdownOpen)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{ color: '#94a3b8' }}
                  >
                    Genres
                    <ChevronDown
                      size={14}
                      className="transition-transform duration-200"
                      style={{ transform: genreDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>

                  {genreDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 w-56 rounded-xl overflow-hidden z-50"
                      style={{
                        background: '#0B1020',
                        border: '1px solid rgba(6,182,212,0.3)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        maxHeight: '400px',
                        overflowY: 'auto',
                      }}
                    >
                      <div className="p-2 grid grid-cols-2 gap-1">
                        {genres.map((genre) => (
                          <Link
                            key={genre.id}
                            href={`/genre/${genre.id}`}
                            className="px-3 py-2 rounded-lg text-sm transition-all duration-150 hover:bg-white/5"
                            style={{ color: '#94a3b8' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.color = '#06b6d4';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                            }}
                          >
                            {genre.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Search + Mobile controls */}
            <div className="flex items-center gap-2">
              {/* Desktop search */}
              <div className="hidden md:block w-56 lg:w-72">
                <SearchBar />
              </div>

              {/* Mobile search toggle */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="md:hidden p-2 rounded-lg transition-all duration-200"
                style={{
                  background: searchOpen ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: searchOpen ? '#06b6d4' : '#94a3b8',
                }}
                aria-label="Toggle search"
              >
                <Search size={18} />
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg transition-all duration-200"
                style={{
                  background: mobileOpen ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: mobileOpen ? '#06b6d4' : '#94a3b8',
                }}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Mobile search bar */}
          {searchOpen && (
            <div className="md:hidden pb-3">
              <SearchBar autoFocus onClose={() => setSearchOpen(false)} />
            </div>
          )}
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="md:hidden"
            style={{
              background: 'rgba(5,8,22,0.98)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="w-full px-4 py-4 space-y-1">
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive('/') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                Home
              </Link>
              <Link
                href="/movie"
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive('/movie') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/movie') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                <Film size={16} />
                Movies
              </Link>
              <Link
                href="/tv"
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive('/tv') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/tv') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                <Tv size={16} />
                TV Shows
              </Link>
              <Link
                href="/request"
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive('/request') ? '#06b6d4' : '#94a3b8',
                  background: isActive('/request') ? 'rgba(6,182,212,0.1)' : 'transparent',
                }}
              >
                <MessageSquarePlus size={16} />
                Request Film / Series
              </Link>

              {genres.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neo-text-muted">
                    Genres
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {genres.map((genre) => (
                      <Link
                        key={genre.id}
                        href={`/genre/${genre.id}`}
                        className="px-4 py-2.5 rounded-xl text-sm transition-all duration-150"
                        style={{ color: '#94a3b8' }}
                      >
                        {genre.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
