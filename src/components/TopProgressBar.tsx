'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TopProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Complete and hide progress bar on path or query param changes
  useEffect(() => {
    setProgress(100);
    const timer = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Intercept anchor clicks to start progress bar instantly
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (
        target &&
        target.href &&
        target.href.startsWith(window.location.origin) &&
        !target.hasAttribute('download') &&
        target.target !== '_blank' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        const url = new URL(target.href);
        const isCurrent =
          url.pathname === window.location.pathname && url.search === window.location.search;

        if (isCurrent) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        setLoading(true);
        setProgress(30);
        setTimeout(() => setProgress(70), 100);

        // Auto-complete safety timeout (prevents hanging progress bar on client-filtered state changes)
        timeoutRef.current = setTimeout(() => {
          setProgress(100);
          setTimeout(() => {
            setLoading(false);
            setProgress(0);
          }, 200);
        }, 500);
      }
    };

    document.addEventListener('click', handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleAnchorClick, { capture: true });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2.5px] z-[99999] pointer-events-none transition-all duration-300 ease-out"
      style={{
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #06b6d4 0%, #ec4899 50%, #8b5cf6 100%)',
        boxShadow: '0 0 12px rgba(6, 182, 212, 0.8), 0 0 20px rgba(236, 72, 153, 0.6)',
        opacity: progress === 100 ? 0 : 1,
      }}
    />
  );
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarContent />
    </Suspense>
  );
}

