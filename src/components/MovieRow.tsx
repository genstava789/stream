'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Movie, TVShow } from '@/types/tmdb';
import MovieCard from './MovieCard';

interface MovieRowProps {
  title: string;
  items: (Movie | TVShow)[];
  seeAllHref?: string;
  type?: 'movie' | 'tv';
  noPadding?: boolean;
}

export default function MovieRow({
  title,
  items,
  seeAllHref,
  type = 'movie',
  noPadding = false,
}: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  // ── Cinematic Ultra-Slow-Motion Peek Teaser Animation on Section View ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length <= 2) return;

    let hasInteracted = false;
    let animFrameId: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let hasAnimated = false;

    const cancelAnimation = () => {
      hasInteracted = true;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    el.addEventListener('touchstart', cancelAnimation, { passive: true, once: true });
    el.addEventListener('mousedown', cancelAnimation, { once: true });
    el.addEventListener('wheel', cancelAnimation, { passive: true, once: true });

    // Silky quadratic ease in-out curve for slow-motion feel
    const easeInOutQuad = (t: number): number => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };

    const animateScroll = (
      start: number,
      target: number,
      duration: number,
      onComplete?: () => void
    ) => {
      const startTime = performance.now();

      const step = (currentTime: number) => {
        if (hasInteracted || !el) return;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutQuad(progress);

        el.scrollLeft = start + (target - start) * easedProgress;

        if (progress < 1) {
          animFrameId = requestAnimationFrame(step);
        } else if (onComplete) {
          onComplete();
        }
      };

      animFrameId = requestAnimationFrame(step);
    };

    const startSlowMotionPeek = () => {
      if (hasAnimated || hasInteracted || !el) return;
      hasAnimated = true;

      const peekDistance = Math.min(140, Math.max(90, el.clientWidth * 0.3));
      const duration = 1600; // 1.6s ultra-smooth slow-motion glide

      // Phase 1: Glide right slowly
      animateScroll(0, peekDistance, duration, () => {
        // Phase 2: Gentle pause at peak
        timeoutId = setTimeout(() => {
          if (hasInteracted || !el) return;
          // Phase 3: Glide back to origin slowly
          animateScroll(peekDistance, 0, duration);
        }, 450);
      });
    };

    // Trigger slow-motion peek when each section enters viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            timeoutId = setTimeout(() => {
              startSlowMotionPeek();
            }, 350);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(el);

    return () => {
      cancelAnimation();
      observer.disconnect();
      if (el) {
        el.removeEventListener('touchstart', cancelAnimation);
        el.removeEventListener('mousedown', cancelAnimation);
        el.removeEventListener('wheel', cancelAnimation);
      }
    };
  }, [items.length]);

  if (!items || items.length === 0) return null;

  const isTV = type === 'tv';

  return (
    <section className="relative w-full max-w-full overflow-hidden">
      {/* Header with section-title style (vertical gradient accent on the left, TV pink-violet theme when isTV) */}
      <div className={`flex items-center justify-between mb-4 ${noPadding ? 'px-0' : 'px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14'}`}>
        <h2 className={`section-title ${isTV ? 'section-title-tv' : ''} text-xl sm:text-2xl font-bold text-neo-text-primary`}>
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className={`text-xs sm:text-sm font-medium transition-colors duration-200 ${isTV ? 'hover:text-pink-400' : 'hover:text-neo-cyan'} flex items-center gap-1 group/link`}
            style={{ color: '#94a3b8' }}
          >
            <span className={`${isTV ? 'group-hover/link:text-pink-400' : 'group-hover/link:text-cyan-400'} transition-colors`}>See All</span>
            <ChevronRight size={16} className="group-hover/link:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>

      {/* Scroll container */}
      <div className="relative group w-full max-w-full">
        {/* Left fade */}
        {canScrollLeft && (
          <div
            className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 md:w-20 z-[5] pointer-events-none"
            style={{
              background: 'linear-gradient(to right, #050816, transparent)',
            }}
          />
        )}

        {/* Right fade */}
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 md:w-20 z-[5] pointer-events-none"
            style={{
              background: 'linear-gradient(to left, #050816, transparent)',
            }}
          />
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ overscrollBehaviorX: 'contain' }}
          className={`flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto hide-scrollbar ${
            noPadding ? 'px-0' : 'px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14'
          } pb-3`}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[160px] xs:w-[178px] sm:w-[195px] md:w-[215px] lg:w-[230px] xl:w-[245px]"
            >
              <MovieCard item={item} type={type} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
