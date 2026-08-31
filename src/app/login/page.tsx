import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginPageClient from './LoginPageClient';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Masuk atau Daftar - ${siteConfig.name}`,
  description: `Masuk ke akun ${siteConfig.name} Anda untuk menyimpan watchlist, melanjutkan tontonan, dan menikmati film serta serial favorit.`,
};

function LoginLoadingFallback() {
  return (
    <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center px-4 py-8 sm:py-12">
      <div
        className="w-full rounded-3xl p-6 sm:p-8"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '460px',
          boxSizing: 'border-box',
          background: 'rgba(9, 14, 32, 0.94)',
          backdropFilter: 'blur(30px) saturate(190%)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          className="animate-spin text-cyan-400"
          style={{
            width: '28px',
            height: '28px',
            minWidth: '28px',
            minHeight: '28px',
            maxWidth: '28px',
            maxHeight: '28px',
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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
