'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-current"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        maxWidth: `${size}px`,
        maxHeight: `${size}px`,
        display: 'inline-block',
        flexShrink: 0,
      }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/profile';

  const { login, register, user } = useAuth();

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

  // Field-specific validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading && !successMsg) {
      router.replace(redirectTarget);
    }
  }, [user, loading, successMsg, redirectTarget, router]);

  const clearFieldError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
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
      if (res.success) {
        setSuccessMsg(res.message || 'Login berhasil! Mengalihkan...');
        setTimeout(() => {
          router.replace(redirectTarget);
        }, 250);
      } else {
        setErrors({ general: res.message || 'Username/Email atau Password salah' });
        setLoading(false);
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'Terjadi kesalahan jaringan' });
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
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
      if (res.success) {
        setSuccessMsg(res.message || 'Akun berhasil dibuat! Mengalihkan...');
        setTimeout(() => {
          router.replace(redirectTarget);
        }, 250);
      } else {
        setErrors({ general: res.message || 'Gagal mendaftar akun' });
        setLoading(false);
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'Terjadi kesalahan jaringan' });
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      newErrors.forgotEmail = 'Masukkan format email yang valid';
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

  // If user is already authenticated or just succeeded logging in, render clean transition
  if (user && successMsg) {
    return (
      <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center px-4 py-8 sm:py-12">
        <div
          className="w-full rounded-3xl p-8 text-center shadow-xl space-y-4"
          style={{
            maxWidth: '420px',
            width: '100%',
            background: 'rgba(9, 14, 32, 0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(6,182,212,0.15)',
          }}
        >
          <div className="flex justify-center text-cyan-400">
            <Spinner size={32} />
          </div>
          <p className="text-xs font-bold text-slate-300">{successMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center px-4 py-8 sm:py-12">
      {/* ── Main Form Card (Fixed max-width and no width transition on mount) ── */}
      <div
        className="relative z-10 w-full"
        style={{
          maxWidth: '420px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{
            width: '100%',
            maxWidth: '420px',
            boxSizing: 'border-box',
            background: 'rgba(9, 14, 32, 0.94)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow:
              '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(6, 182, 212, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* General Error Banner */}
          {errors.general && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-400 flex-shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {forgotPasswordView ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordView(false);
                    setForgotSubmitted(false);
                    setErrors({});
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 className="text-sm font-bold text-white">Lupa Password</h3>
              </div>

              {forgotSubmitted ? (
                <div className="text-center py-3 space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white">Link Pemulihan Terkirim</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Petunjuk reset password telah dikirim ke <span className="text-cyan-400">{forgotEmail}</span> jika email terdaftar.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordView(false);
                      setForgotSubmitted(false);
                      setForgotEmail('');
                    }}
                    className="mt-2 text-xs font-bold text-cyan-400 hover:underline"
                  >
                    Kembali ke Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Email Akun</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          clearFieldError('forgotEmail');
                        }}
                        placeholder="nama@email.com"
                        className={`w-full pl-10 pr-4 py-2.5 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.forgotEmail
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                    </div>
                    {errors.forgotEmail && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.forgotEmail}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.25)',
                    }}
                  >
                    {loading ? (
                      <Spinner size={16} />
                    ) : (
                      <span>Kirim Link Reset</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* ── TAB SWITCHER (Login / Register) ── */}
              <div className="flex items-center p-1 rounded-2xl bg-black/40 border border-white/10 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrors({});
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'login'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20'
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
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'register'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={13} />
                  <span>Daftar</span>
                </button>
              </div>

              {/* ── LOGIN FORM ── */}
              {tab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  {/* Username or Email Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Username atau Email</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => {
                          setLoginIdentifier(e.target.value);
                          clearFieldError('loginIdentifier');
                        }}
                        placeholder="Username atau email Anda"
                        autoComplete="username"
                        className={`w-full pl-10 pr-4 py-2.5 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.loginIdentifier
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                    </div>
                    {errors.loginIdentifier && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.loginIdentifier}</p>
                    )}
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">Password</label>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordView(true)}
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        Lupa Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          clearFieldError('loginPassword');
                        }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className={`w-full pl-10 pr-10 py-2.5 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.loginPassword
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.loginPassword && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.loginPassword}</p>
                    )}
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="rememberMe" className="text-[11px] text-slate-400 cursor-pointer select-none">
                      Ingat saya di perangkat ini
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.25)',
                    }}
                  >
                    {loading ? (
                      <Spinner size={18} />
                    ) : (
                      <span>Masuk ke Akun</span>
                    )}
                  </button>
                </form>
              ) : (
                /* ── REGISTER FORM ── */
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Username</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => {
                          setRegUsername(e.target.value);
                          clearFieldError('regUsername');
                        }}
                        placeholder="Pilih username"
                        autoComplete="username"
                        className={`w-full pl-10 pr-4 py-2 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.regUsername
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                    </div>
                    {errors.regUsername && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.regUsername}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Email</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => {
                          setRegEmail(e.target.value);
                          clearFieldError('regEmail');
                        }}
                        placeholder="nama@email.com"
                        autoComplete="email"
                        className={`w-full pl-10 pr-4 py-2 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.regEmail
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                    </div>
                    {errors.regEmail && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.regEmail}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          clearFieldError('regPassword');
                        }}
                        placeholder="Minimal 6 karakter"
                        autoComplete="new-password"
                        className={`w-full pl-10 pr-10 py-2 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.regPassword
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.regPassword && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.regPassword}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Ulangi Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => {
                          setRegConfirmPassword(e.target.value);
                          clearFieldError('regConfirmPassword');
                        }}
                        placeholder="Ulangi kata sandi"
                        autoComplete="new-password"
                        className={`w-full pl-10 pr-10 py-2 bg-[#060814] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                          errors.regConfirmPassword
                            ? 'border-rose-500/60 focus:border-rose-500'
                            : 'border-white/10 focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.regConfirmPassword && (
                      <p className="text-[11px] text-rose-400 mt-0.5">{errors.regConfirmPassword}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-3"
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
                      boxShadow: '0 0 20px rgba(6, 182, 212, 0.25)',
                    }}
                  >
                    {loading ? (
                      <Spinner size={18} />
                    ) : (
                      <span>Daftar Sekarang</span>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
