'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TopProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trickleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Complete and hide progress bar on path or query param changes
  useEffect(() => {
    if (trickleIntervalRef.current) {
      clearInterval(trickleIntervalRef.current);
      trickleIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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
        if (trickleIntervalRef.current) clearInterval(trickleIntervalRef.current);

        setLoading(true);
        setProgress(25);

        // Smooth trickle progression while page is loading
        trickleIntervalRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev;
            const step = Math.max(1, (90 - prev) * 0.12);
            return Math.min(90, prev + step);
          });
        }, 150);

        // Extended fallback safety timeout (prevents hanging if navigation fails or is aborted)
        timeoutRef.current = setTimeout(() => {
          if (trickleIntervalRef.current) clearInterval(trickleIntervalRef.current);
          setProgress(100);
          setTimeout(() => {
            setLoading(false);
            setProgress(0);
          }, 200);
        }, 10000);
      }
    };

    document.addEventListener('click', handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleAnchorClick, { capture: true });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (trickleIntervalRef.current) clearInterval(trickleIntervalRef.current);
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

