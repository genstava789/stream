import React from 'react';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import { getGenres } from '@/lib/tmdb';
import { getEnrichedFeaturedMovies } from '@/lib/featured';
import { getResolvedSections } from '@/lib/sections';
import siteConfig from '@/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const [genresData, featuredItems, sections] = await Promise.all([
    getGenres().catch(() => []),
    getEnrichedFeaturedMovies({ maxItems: siteConfig.featuredLimit || 7 }),
    getResolvedSections('home'),
  ]);

  const genreList = genresData || [];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip overflow-x-hidden" style={{ background: '#050816' }}>
      {/* Hero with Enriched Custom Featured Items Carousel */}
      {featuredItems.length > 0 && (
        <Hero
          genres={genreList}
          customFeaturedItems={featuredItems}
        />
      )}

      {/* Content sections */}
      <div className="relative z-10 space-y-8 sm:space-y-10 md:space-y-12 pb-12 sm:pb-16 pt-8 sm:pt-12 md:pt-16 lg:pt-20">
        {/* Dynamic Custom & Fallback Sections ordered by weight */}
        {sections.map((section) => (
          <MovieRow
            key={section.id}
            title={section.title}
            items={section.items}
            type={section.type}
            seeAllHref={section.seeAllHref}
          />
        ))}
      </div>
    </div>
  );
}

