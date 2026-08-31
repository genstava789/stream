'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogIn,
  LogOut,
  Home,
  Film,
  Tv,
  Search,
  Sparkles,
  MessageSquarePlus,
  Heart,
  Flame,
  Clapperboard,
  Star,
  Clock,
  TrendingUp,
  LayoutGrid,
  ShieldCheck,
  Crown,
  User as UserIcon,
} from 'lucide-react';
import { Genre } from '@/types/tmdb';
import { useAuth } from '@/context/AuthContext';
import siteConfig from '@/config';

interface MobileHeaderProps {
  genres?: Genre[];
}

export default function MobileHeader({ genres = [] }: MobileHeaderProps) {
  const { user, isLoggedIn, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const [genreTab, setGenreTab] = useState<'movie' | 'tv'>('movie');

  const navCards = [
    {
      href: '/',
      icon: Home,
      title: 'Home',
      desc: 'Trending & curated',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
    },
    {
      href: '/movie',
      icon: Film,
      title: 'Movies',
      desc: 'Browse movie catalog',
      color: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.12)',
      border: 'rgba(167, 139, 250, 0.3)',
    },
    {
      href: '/tv',
      icon: Tv,
      title: 'TV Shows',
      desc: 'Series & episodes',
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.12)',
      border: 'rgba(236, 72, 153, 0.3)',
    },
    {
      href: '/collections',
      icon: LayoutGrid,
      title: 'Koleksi',
      desc: 'Koleksi kurasi film & series',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.12)',
      border: 'rgba(56, 189, 248, 0.3)',
    },
  ];

  const movieGenresList = [
    { id: 28, label: 'Action' },
    { id: 12, label: 'Adventure' },
    { id: 16, label: 'Animation' },
    { id: 35, label: 'Comedy' },
    { id: 80, label: 'Crime' },
    { id: 99, label: 'Documentary' },
    { id: 18, label: 'Drama' },
    { id: 10751, label: 'Family' },
    { id: 14, label: 'Fantasy' },
    { id: 36, label: 'History' },
    { id: 27, label: 'Horror' },
    { id: 10402, label: 'Music' },
    { id: 9648, label: 'Mystery' },
    { id: 10749, label: 'Romance' },
    { id: 878, label: 'Sci-Fi' },
    { id: 53, label: 'Thriller' },
    { id: 10752, label: 'War' },
    { id: 37, label: 'Western' },
  ];

  const tvGenresList = [
    { id: 10759, label: 'Action & Adventure' },
    { id: 16, label: 'Animation' },
    { id: 35, label: 'Comedy' },
    { id: 80, label: 'Crime' },
    { id: 99, label: 'Documentary' },
    { id: 18, label: 'Drama' },
    { id: 10751, label: 'Family' },
    { id: 10762, label: 'Kids' },
    { id: 9648, label: 'Mystery' },
    { id: 10763, label: 'News' },
    { id: 10764, label: 'Reality' },
    { id: 10765, label: 'Sci-Fi & Fantasy' },
    { id: 10766, label: 'Soap' },
    { id: 10767, label: 'Talk' },
    { id: 10768, label: 'War & Politics' },
    { id: 37, label: 'Western' },
  ];

  return (
    <header className="lg:hidden relative w-full z-40" ref={menuRef}>
      {/* ── Frosted Glassmorphism Header Bar (Non-fixed) ── */}
      <div
        className="w-full h-16 px-4 sm:px-6 flex items-center justify-between transition-all duration-300"
        style={{
          background: 'rgba(6, 10, 26, 0.72)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Left: Site Title (No Logo) */}
        <Link href="/" className="flex items-center group">
          <span
            className="text-lg sm:text-xl font-black tracking-wider uppercase transition-opacity duration-200 group-hover:opacity-80"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {siteConfig.nameUpper || siteConfig.name}
          </span>
        </Link>

        {/* Right: Login / Profile Button FIRST, followed by Hamburger Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Zero-Flicker Glassmorphic Login / Profile Button */}
          {!mounted ? (
            <div
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold opacity-0 pointer-events-none flex items-center gap-1.5"
              style={{ minWidth: '70px' }}
            >
              <span>Login</span>
            </div>
          ) : isLoggedIn && user ? (
            <Link
              href="/profile"
              className="px-2.5 py-1.5 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2 group min-h-[38px] max-w-[130px] sm:max-w-[150px]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(124, 58, 237, 0.16) 100%)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                boxShadow: '0 0 12px rgba(6, 182, 212, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden border border-cyan-400/50 bg-slate-800 flex-shrink-0 shadow-[0_0_6px_rgba(6,182,212,0.3)]"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
              >
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.username)}`}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col items-start justify-center min-w-0">
                <span className="w-full truncate text-slate-100 group-hover:text-cyan-300 font-extrabold text-[11px] leading-tight capitalize transition-colors">
                  {user.username}
                </span>
                {user.role === 'owner' ? (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[7px] font-black bg-gradient-to-r from-amber-500/25 to-yellow-500/25 border border-amber-500/40 text-amber-300 leading-none mt-0.5 shadow-[0_0_6px_rgba(245,158,11,0.2)]">
                    <Crown size={7} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                    <span>OWNER</span>
                  </span>
                ) : user.role === 'admin' ? (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[7px] font-black bg-gradient-to-r from-cyan-500/25 to-sky-500/25 border border-cyan-500/40 text-cyan-300 leading-none mt-0.5 shadow-[0_0_6px_rgba(6,182,212,0.2)]">
                    <ShieldCheck size={7} className="text-cyan-400 flex-shrink-0" />
                    <span>ADMIN</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[7px] font-bold bg-white/10 border border-white/15 text-slate-300 leading-none mt-0.5">
                    <span>MEMBER</span>
                  </span>
                )}
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-cyan-300 bg-white/[0.06] hover:bg-white/10 border border-white/10 transition-all duration-200 active:scale-95 flex items-center gap-1.5"
            >
              <LogIn size={13} className="text-cyan-400" />
              <span>Login</span>
            </Link>
          )}

          {/* Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{
              background: menuOpen ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: menuOpen
                ? '1px solid rgba(6, 182, 212, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: menuOpen ? '#06b6d4' : '#94a3b8',
              boxShadow: menuOpen ? '0 0 15px rgba(6, 182, 212, 0.3)' : 'none',
            }}
            aria-label="Toggle Navigation Menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ── Modern Floating Glassmorphism Mobile Menu ── */}
      {menuOpen && (
        <div
          className="absolute top-full left-0 right-0 p-4 sm:p-5 rounded-b-3xl border-b border-x transition-all duration-300 animate-in fade-in slide-in-from-top-4"
          style={{
            background: 'rgba(8, 12, 28, 0.96)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow:
              '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Section 0: User Profile Header Card in Mobile Drawer */}
          {isLoggedIn && user && (
            <div className="mb-3.5 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between gap-3 font-outfit">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden border border-cyan-400/50 shadow-md flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.username)}`}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-black text-sm sm:text-base text-white capitalize block truncate tracking-tight font-outfit">
                    {user.username}
                  </span>
                  <p className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] font-medium font-outfit">
                    {user.email}
                  </p>
                  <div className="mt-1">
                    {user.role === 'owner' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-500/25 to-yellow-500/25 border border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)] font-outfit">
                        <Crown size={9} className="text-amber-400 fill-amber-400" />
                        OWNER
                      </span>
                    ) : user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-gradient-to-r from-cyan-500/25 to-sky-500/25 border border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)] font-outfit">
                        <ShieldCheck size={9} className="text-cyan-400" />
                        ADMINISTRATOR
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-white/10 border border-white/15 text-slate-300 font-outfit">
                        <ShieldCheck size={9} className="text-slate-400" />
                        MEMBER
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 font-outfit">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wide uppercase bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all active:scale-95 font-outfit"
                >
                  Profil
                </Link>
                {(user.role === 'owner' || user.role === 'admin') && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-wider uppercase bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 transition-all active:scale-95 shadow-[0_0_10px_rgba(168,85,247,0.15)] font-outfit"
                  >
                    CMS
                  </Link>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-wider uppercase bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all active:scale-95 flex items-center gap-1 font-outfit"
                  title="Keluar Akun"
                >
                  <LogOut size={12} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Primary Navigation Cards (2x2 Grid, Clean & Simple) */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {navCards.map((card) => {
              const active = isActive(card.href);
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  onClick={() => setMenuOpen(false)}
                  className="p-3 sm:p-3.5 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between group"
                  style={{
                    background: active ? card.bg : 'rgba(255, 255, 255, 0.03)',
                    border: active ? `1px solid ${card.border}` : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div className="flex items-center mb-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                      style={{
                        background: active ? card.bg : 'rgba(255, 255, 255, 0.06)',
                        color: active ? card.color : '#94a3b8',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                  </div>
                  <div>
                    <h3
                      className="font-bold text-sm transition-colors"
                      style={{ color: active ? card.color : '#f1f5f9' }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">{card.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Section 2: Categorized Genre Browser (Movie & TV Series) */}
          <div className="pt-3 border-t border-white/[0.08]" id="mobile-menu-genres">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Kategori Genre
                </span>
              </div>

              {/* Movie vs TV Toggle Tabs */}
              <div className="flex items-center p-0.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-bold shadow-sm">
                <button
                  type="button"
                  onClick={() => setGenreTab('movie')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold ${
                    genreTab === 'movie'
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film size={11} />
                  <span>Movie</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGenreTab('tv')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold ${
                    genreTab === 'tv'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Tv size={11} />
                  <span>TV Series</span>
                </button>
              </div>
            </div>

            {/* Genre Pills Grid */}
            <div className="flex flex-wrap gap-1.5 max-h-[175px] overflow-y-auto pr-0.5">
              {(genreTab === 'movie' ? movieGenresList : tvGenresList).map((genre) => {
                const targetHref = genreTab === 'movie' ? `/genre/${genre.id}` : `/genre/${genre.id}?type=tv`;
                const active = pathname === targetHref;
                return (
                  <Link
                    key={genre.id}
                    href={targetHref}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95 text-slate-300 hover:text-white"
                    style={{
                      background: active
                        ? genreTab === 'movie'
                          ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(124, 58, 237, 0.3))'
                          : 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(124, 58, 237, 0.3))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: active
                        ? genreTab === 'movie'
                          ? '1px solid rgba(6, 182, 212, 0.55)'
                          : '1px solid rgba(236, 72, 153, 0.55)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: active
                        ? genreTab === 'movie'
                          ? '#06b6d4'
                          : '#ec4899'
                        : '#cbd5e1',
                    }}
                  >
                    <span>{genre.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 3: Action Buttons (Request Film & Donasi) */}
          <div className="pt-3 mt-3 border-t border-white/[0.08] flex items-center justify-between gap-2.5">
            {/* Request Film Button */}
            <Link
              href="/request"
              onClick={() => setMenuOpen(false)}
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold text-slate-200 hover:text-cyan-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(124, 58, 237, 0.15))',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
              }}
            >
              <MessageSquarePlus size={14} className="text-cyan-400" />
              <span>Request</span>
            </Link>

            {/* Donasi Button */}
            <button
              type="button"
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold text-slate-200 hover:text-rose-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(236, 72, 153, 0.15))',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                boxShadow: '0 0 15px rgba(244, 63, 94, 0.15)',
              }}
            >
              <Heart size={14} className="text-rose-400" />
              <span>Donasi</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
