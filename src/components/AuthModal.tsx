'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Bookmark,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalTab,
    authModalMessage,
    closeAuthModal,
    login,
    register,
  } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordView, setForgotPasswordView] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');

  // Field errors for dynamic outline coloring
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const clearFieldError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Sync tab with context when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      setTab(authModalTab);
      setForgotPasswordView(false);
      setForgotSubmitted(false);
      setErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isAuthModalOpen, authModalTab]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!loginIdentifier.trim()) {
      newErrors.loginIdentifier = 'Username atau Email wajib diisi';
    }
    if (!loginPassword) {
      newErrors.loginPassword = 'Password wajib diisi';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const res = await login(loginIdentifier.trim(), loginPassword);
      if (!res.success) {
        setErrors({ general: res.message || 'Username/Email atau Password salah' });
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'Terjadi kesalahan jaringan' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!regUsername.trim()) {
      newErrors.regUsername = 'Username wajib diisi';
    } else if (regUsername.trim().length < 3) {
      newErrors.regUsername = 'Username minimal 3 karakter';
    }

    if (!regEmail.trim()) {
      newErrors.regEmail = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      newErrors.regEmail = 'Format email tidak valid';
    }

    if (!regPassword) {
      newErrors.regPassword = 'Password wajib diisi';
    } else if (regPassword.length < 6) {
      newErrors.regPassword = 'Password minimal 6 karakter';
    }

    if (!regConfirmPassword) {
      newErrors.regConfirmPassword = 'Ulangi password Anda';
    } else if (regPassword && regPassword !== regConfirmPassword) {
      newErrors.regConfirmPassword = 'Password tidak sama';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const res = await register(regUsername.trim(), regEmail.trim(), regPassword);
      if (!res.success) {
        setErrors({ general: res.message || 'Gagal mendaftar akun' });
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'Terjadi kesalahan jaringan' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      newErrors.forgotEmail = 'Masukkan email yang valid';
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setForgotSubmitted(true);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* ── Ambient Backdrop ── */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={closeAuthModal}
      />

      {/* ── Modal Card ── */}
      <div
        className="relative w-full max-w-[390px] rounded-3xl p-5 sm:p-6 z-10 transition-all duration-300 animate-in fade-in zoom-in-95"
        style={{
          background: 'rgba(9, 14, 32, 0.96)',
          backdropFilter: 'blur(30px) saturate(190%)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow:
            '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(6, 182, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150"
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        {/* ── Watchlist / Login Alert Notice (Only when needed) ── */}
        {authModalMessage && (
          <div className="mb-4 pr-8">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-semibold">
              <Bookmark size={14} className="text-cyan-400 flex-shrink-0" />
              <span>{authModalMessage}</span>
            </div>
          </div>
        )}

        {/* ── General Error Banner ── */}
        {errors.general && (
          <div className="mb-4 pr-8">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              <AlertCircle size={14} className="text-rose-400 flex-shrink-0" />
              <span>{errors.general}</span>
            </div>
          </div>
        )}

        {/* ── FORGOT PASSWORD VIEW ── */}
        {forgotPasswordView ? (
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordView(false);
                  setForgotSubmitted(false);
                  setErrors({});
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={15} />
              </button>
              <h3 className="text-xs font-bold text-white">Reset Password</h3>
            </div>

            {forgotSubmitted ? (
              <div className="text-center py-3 space-y-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={18} />
                </div>
                <h4 className="text-xs font-bold text-white">Email Terkirim</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tautan reset password telah dikirim ke <span className="text-cyan-400 font-semibold">{forgotEmail}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordView(false);
                    setForgotSubmitted(false);
                    setTab('login');
                  }}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Kembali Masuk
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <div className="space-y-1">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        clearFieldError('forgotEmail');
                      }}
                      placeholder="Masukkan Email Anda"
                      className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.forgotEmail
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {errors.forgotEmail && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.forgotEmail}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                  }}
                >
                  {loading ? 'Mengirim...' : 'Kirim Tautan'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordView(false);
                    setErrors({});
                  }}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white pt-0.5"
                >
                  Batal
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ── TABS: LOGIN & REGISTER ── */
          <>
            {/* Tab Selector */}
            <div className="flex rounded-2xl p-1 bg-white/[0.05] border border-white/10 mb-4">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrors({});
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                  tab === 'login'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn size={13} />
                <span>Masuk</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrors({});
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                  tab === 'register'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus size={13} />
                <span>Daftar</span>
              </button>
            </div>

            {/* ── TAB 1: LOGIN ── */}
            {tab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="space-y-1">
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => {
                        setLoginIdentifier(e.target.value);
                        clearFieldError('loginIdentifier');
                      }}
                      placeholder="Username/Email"
                      className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.loginIdentifier
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {errors.loginIdentifier && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.loginIdentifier}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        clearFieldError('loginPassword');
                      }}
                      placeholder="Password"
                      className={`w-full pl-8 pr-8 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.loginPassword
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.loginPassword && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.loginPassword}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-0"
                    />
                    <span>Ingat saya</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordView(true);
                      setErrors({});
                    }}
                    className="text-cyan-400 hover:underline font-medium text-[11px]"
                  >
                    Lupa Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2 mt-1"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                  }}
                >
                  <LogIn size={13} />
                  <span>{loading ? 'Memproses...' : 'Masuk'}</span>
                </button>
              </form>
            )}

            {/* ── TAB 2: REGISTER ── */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
                <div className="space-y-0.5">
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => {
                        setRegUsername(e.target.value);
                        clearFieldError('regUsername');
                      }}
                      placeholder="Username"
                      className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.regUsername
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {errors.regUsername && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.regUsername}
                    </p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        clearFieldError('regEmail');
                      }}
                      placeholder="Email"
                      className={`w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.regEmail
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                  </div>
                  {errors.regEmail && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.regEmail}
                    </p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        clearFieldError('regPassword');
                      }}
                      placeholder="Password"
                      className={`w-full pl-8 pr-8 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.regPassword
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.regPassword && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.regPassword}
                    </p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        clearFieldError('regConfirmPassword');
                      }}
                      placeholder="Konfirmasi Password"
                      className={`w-full pl-8 pr-8 py-2 rounded-xl bg-white/[0.06] text-white text-xs placeholder-slate-500 focus:outline-none transition-colors ${
                        errors.regConfirmPassword
                          ? 'border border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5'
                          : 'border border-white/15 focus:border-cyan-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.regConfirmPassword && (
                    <p className="text-[11px] text-rose-400 font-medium pl-1 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.regConfirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center gap-2 mt-1.5"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
                  }}
                >
                  <UserPlus size={13} />
                  <span>{loading ? 'Mendaftarkan...' : 'Daftar Akun'}</span>
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
