'use client';

import React from 'react';
import siteConfig from '@/config';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="mt-8 sm:mt-10 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-28 lg:pb-8 relative z-20"
      style={{
        background: 'linear-gradient(to bottom, transparent 0%, rgba(6, 10, 24, 0.95) 100%)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 text-center">
        <div className="flex flex-col items-center justify-center gap-1.5">
          <p className="text-xs sm:text-sm font-medium tracking-wide text-slate-400">
            © {currentYear}{' '}
            <span
              className="font-bold tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {siteConfig.copyright || siteConfig.name}
            </span>
            . All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
