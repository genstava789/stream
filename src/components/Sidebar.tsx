'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Film, Home, Tv, Search, ChevronDown, ChevronRight,
  TrendingUp, Star, Clock, Clapperboard, Flame, Menu, X, LogIn, User, LayoutGrid
} from 'lucide-react';
import { Genre } from '@/types/tmdb';
import { useAuth } from '@/context/AuthContext';
import siteConfig from '@/config';

interface SidebarProps {
  genres?: Genre[];
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ genres = [], isOpen, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [genreExpanded, setGenreExpanded] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const mainNav = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/movie', icon: Film, label: 'Movies' },
    { href: '/tv', icon: Tv, label: 'TV Shows' },
    { href: '/collections', icon: LayoutGrid, label: 'Koleksi' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  const movieNav = [
    { href: '/genre/28', icon: Flame, label: 'Action' },
    { href: '/genre/35', icon: Clapperboard, label: 'Comedy' },
    { href: '/genre/18', icon: Star, label: 'Drama' },
    { href: '/genre/27', icon: Clock, label: 'Horror' },
    { href: '/genre/878', icon: TrendingUp, label: 'Sci-Fi' },
  ];

  return (
    <aside
      className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40"
      style={{
        width: isOpen ? '240px' : '72px',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(11, 16, 32, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: isOpen
          ? '4px 0 30px rgba(0,0,0,0.3)'
          : '2px 0 15px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ── */}
      <div
        className="flex items-center h-16 border-b border-white/[0.06] flex-shrink-0"
        style={{
          padding: isOpen ? '0 12px 0 16px' : '0',
          justifyContent: isOpen ? 'space-between' : 'center',
        }}
      >
        {/* Logo icon */}
        <Link
          href="/"
          title={siteConfig.name}
          className="flex items-center gap-3"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
              boxShadow: '0 0 14px rgba(6,182,212,0.35)',
            }}
          >
            <Film size={18} className="text-white" />
          </div>

          {isOpen && (
            <span
              className="text-base font-extrabold tracking-wider whitespace-nowrap overflow-hidden text-ellipsis uppercase"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {siteConfig.nameUpper || siteConfig.name}
            </span>
          )}
        </Link>

        {/* Close X button (only shown when sidebar is open) */}
        {isOpen && (
          <button
            onClick={onToggle}
            title="Tutup menu"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 text-slate-400 hover:text-cyan-400 hover:bg-white/10"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── SCROLLABLE NAVIGATION LIST ── */}
      <div className="flex-1 overflow-y-auto py-3 hide-scrollbar">

        {/* Hamburger Toggle Button when collapsed */}
        {!isOpen && (
          <div className="flex justify-center mb-2">
            <button
              onClick={onToggle}
              title="Buka menu"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] hover:border hover:border-white/10"
            >
              <Menu size={18} />
            </button>
          </div>
        )}

        {/* Main Section Label (only when open) */}
        {isOpen && (
          <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Menu
          </p>
        )}

        {/* Main Navigation */}
        <nav className={`space-y-1.5 mb-5 ${isOpen ? 'px-3' : 'px-0 flex flex-col items-center'}`}>
          {mainNav.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);

            if (!isOpen) {
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    active
                      ? 'text-cyan-400 border border-cyan-500/40 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                      : 'text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] hover:border hover:border-white/10 border border-transparent'
                  }`}
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.2))'
                      : 'transparent',
                  }}
                >
                  <Icon
                    size={18}
                    className={active ? 'drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]' : ''}
                  />
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? 'text-cyan-400 border border-cyan-500/25 bg-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon
                  size={18}
                  className={active ? 'drop-shadow-[0_0_6px_rgba(6,182,212,0.7)]' : ''}
                />
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                  {label}
                </span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Movies Section Label (only when open) */}
        {isOpen && (
          <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Movies
          </p>
        )}

        {/* Movie Genres Navigation */}
        <nav className={`space-y-1.5 mb-4 ${isOpen ? 'px-3' : 'px-0 flex flex-col items-center'}`}>
          {movieNav.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);

            if (!isOpen) {
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    active
                      ? 'text-cyan-400 border border-cyan-500/40 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                      : 'text-slate-400 hover:text-cyan-400 hover:bg-white/[0.06] hover:border hover:border-white/10 border border-transparent'
                  }`}
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(124,58,237,0.2))'
                      : 'transparent',
                  }}
                >
                  <Icon size={18} />
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? 'text-cyan-400 border border-cyan-500/25 bg-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1">
                  {label}
                </span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* All Genres Accordion (only when open) with Smooth Scroll Behavior */}
        {isOpen && genres.length > 0 && (
          <div className="px-3 mb-4">
            <button
              onClick={() => setGenreExpanded(!genreExpanded)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-slate-200 hover:bg-white/5"
            >
              <Film size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium flex-1 text-left">All Genres</span>
              {genreExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {genreExpanded && (
              <div
                className="mt-1 ml-3 pl-3 space-y-0.5 border-l border-cyan-500/20 max-h-52 overflow-y-auto scroll-smooth hide-scrollbar pr-1"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(6,182,212,0.3) transparent',
                }}
              >
                {genres.map((genre) => {
                  const active = pathname === `/genre/${genre.id}`;
                  return (
                    <Link
                      key={genre.id}
                      href={`/genre/${genre.id}`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-150 text-xs ${
                        active
                          ? 'text-cyan-400 font-semibold bg-cyan-500/10'
                          : 'text-slate-400 hover:text-cyan-400 hover:bg-white/5'
                      }`}
                    >
                      {genre.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SIDEBAR FOOTER (DESKTOP LOGIN & ACCOUNT) ── */}
      <div
        className="border-t border-white/[0.06] flex-shrink-0"
        style={{
          padding: isOpen ? '12px' : '10px 0',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        {!isOpen ? (
          <div className="flex justify-center">
            <Link
              href={user ? '/profile' : '/login'}
              title={user ? user.username : 'Masuk / Akun'}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 text-cyan-400 hover:scale-105 active:scale-95 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(124, 58, 237, 0.22))',
                border: '1px solid rgba(6, 182, 212, 0.45)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)',
              }}
            >
              {user ? (
                user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-black text-xs text-white">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                )
              ) : (
                <LogIn size={18} />
              )}
            </Link>
          </div>
        ) : (
          <Link
            href={user ? '/profile' : '/login'}
            className="w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background:
                'linear-gradient(135deg, rgba(6, 182, 212, 0.16) 0%, rgba(124, 58, 237, 0.22) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.45)',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.15)',
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm text-white overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                boxShadow: '0 0 12px rgba(6, 182, 212, 0.35)',
              }}
            >
              {user ? (
                user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )
              ) : (
                <LogIn size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {user ? user.username : 'Masuk / Daftar'}
              </p>
              <p className="text-[10px] font-medium text-cyan-300 truncate">
                {user ? 'Profil & Watchlist' : 'Buka Akses Watchlist'}
              </p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}
