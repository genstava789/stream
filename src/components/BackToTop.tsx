'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollY.current;
      const pastThreshold = currentScrollY > 250;

      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }

      if (pastThreshold && isScrollingUp) {
        setVisible(true);
        // Auto-hide after 3.5 seconds of no scrolling activity
        idleTimer.current = setTimeout(() => {
          setVisible(false);
        }, 3500);
      } else {
        // Scrolling down or near top -> hide
        setVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setVisible(false);
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:bottom-24 lg:bottom-8 right-4 sm:right-6 lg:right-8 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all duration-300 focus:outline-none shadow-xl ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto hover:scale-110 active:scale-90'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{
        background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
        boxShadow: '0 0 20px rgba(6, 182, 212, 0.45), 0 4px 15px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      }}
    >
      <ChevronUp size={20} className="text-white drop-shadow" />
    </button>
  );
}
