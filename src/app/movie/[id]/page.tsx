import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { Calendar, Clock, Globe, Clapperboard, Users, ChevronLeft, Sparkles, AlertTriangle } from 'lucide-react';
import { getImageUrl } from '@/lib/tmdb';
import {
  getMovieDetailsWithCustomOverride,
  getAllCustomMovieSlugs,
} from '@/lib/markdownMovies';
import MovieCard from '@/components/MovieCard';
import CastCard from '@/components/CastCard';
import RatingBadge from '@/components/RatingBadge';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import MovieDetailClient from '@/components/MovieDetailClient';
import VideoPlayer from '@/components/VideoPlayer';
import NonLocalWarning from '@/components/NonLocalWarning';
import DynamicVideoSchema from '@/components/DynamicVideoSchema';
import { getServerBaseUrl, getServerAbsoluteUrl } from '@/lib/serverUrls';
import siteConfig from '@/config';

export const dynamicParams = true;
export const revalidate = 3600;

interface PageProps {
  params: {
    id: string;
  };
}

/**
 * Dynamic metadata generation for SEO & OpenGraph
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const movie = await getMovieDetailsWithCustomOverride(params.id).catch(() => null);

  if (!movie) {
    return {
      title: `Movie Not Found - ${siteConfig.name}`,
    };
  }

  const siteUrl = getServerBaseUrl();
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const yearStr = year ? ` (${year})` : '';
  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = `${movie.title}${yearStr}${creditSuffix}`;
  const title = `${movie.title}${yearStr} - ${siteConfig.name}`;
  const description = movie.overview ? movie.overview.slice(0, 160) : `Watch movies and stream online on ${siteConfig.name}.`;
  const videoUrl = movie.customVideoUrl || null;
  const videoType = videoUrl && videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
  const pageUrl = getServerAbsoluteUrl(`/movie/${params.id}`);
  const embedUrl = getServerAbsoluteUrl(`/embed/movie/${params.id}`);

  const image = movie.customImageUrl
    ? (movie.customImageUrl.startsWith('http') ? movie.customImageUrl : getImageUrl(movie.customImageUrl, 'w1280'))
    : movie.backdrop_path
    ? getImageUrl(movie.backdrop_path, 'w1280')
    : movie.poster_path
    ? getImageUrl(movie.poster_path, 'w500')
    : undefined;

  return {
    title,
    description,
    openGraph: {
      siteName: siteConfig.name,
      title: videoTitle,
      description,
      type: 'video.movie',
      images: image ? [image] : [],
      videos: videoUrl
        ? [
            {
              url: embedUrl,
              secureUrl: embedUrl,
              type: 'text/html',
              width: 1920,
              height: 1080,
            },
            {
              url: videoUrl,
              secureUrl: videoUrl,
              type: videoType,
              width: 1920,
              height: 1080,
            },
          ]
        : [],
    },
    other: videoUrl
      ? {
          'og:site_name': siteConfig.name,
          'application-name': siteConfig.name,
          'apple-mobile-web-app-title': siteConfig.name,
          'og:type': 'video.other',
          'og:video': embedUrl,
          'og:video:url': embedUrl,
          'og:video:secure_url': embedUrl,
          'og:video:type': 'text/html',
          'og:video:width': '1920',
          'og:video:height': '1080',
          'twitter:card': 'player',
          'twitter:site': `@${siteConfig.name}`,
          'twitter:creator': `@${siteConfig.name}`,
          'twitter:player': embedUrl,
          'twitter:player:width': '1920',
          'twitter:player:height': '1080',
          'twitter:player:stream': videoUrl,
          'twitter:player:stream:content_type': videoType,
          'video_src': embedUrl,
        }
      : {
          'og:site_name': siteConfig.name,
          'application-name': siteConfig.name,
        },
  };
}

function formatIsoDuration(duration?: string | number | null): string {
  if (!duration) return 'PT1H30M';
  if (typeof duration === 'number') {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours > 0 && minutes > 0) return `PT${hours}H${minutes}M`;
    if (hours > 0) return `PT${hours}H`;
    return `PT${minutes}M`;
  }
  const str = String(duration).trim().toLowerCase();
  const matchH = str.match(/(\d+)\s*h/);
  const matchM = str.match(/(\d+)\s*m/);
  const hours = matchH ? parseInt(matchH[1], 10) : 0;
  const minutes = matchM ? parseInt(matchM[1], 10) : 0;
  if (hours > 0 && minutes > 0) return `PT${hours}H${minutes}M`;
  if (hours > 0) return `PT${hours}H`;
  if (minutes > 0) return `PT${minutes}M`;
  const plainNum = parseInt(str, 10);
  if (!isNaN(plainNum) && plainNum > 0) return `PT${plainNum}M`;
  return 'PT1H30M';
}

export default async function MovieDetailPage({ params }: PageProps) {
  const movie = await getMovieDetailsWithCustomOverride(params.id).catch(() => null);

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050816' }}>
        <div className="text-center px-4">
          <h2 className="text-2xl font-bold text-white mb-2">Film Tidak Ditemukan</h2>
          <p className="text-neo-text-secondary text-sm mb-6">
            Data untuk movie ID atau file markdown &ldquo;{params.id}&rdquo; tidak ditemukan.
          </p>
          <Link
            href="/movie"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-lg hover:shadow-cyan-500/25"
          >
            <ChevronLeft size={18} />
            <span>Kembali ke Katalog Film</span>
          </Link>
        </div>
      </div>
    );
  }

  const siteUrl = getServerBaseUrl();
  const director = movie.credits?.crew?.find((c) => c.job === 'Director');
  const cast = (movie.credits?.cast || []).slice(0, 10);
  const similarMovies = movie.similar?.results?.slice(0, 14) || [];
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const trailer = movie.videos?.results?.find(
    (v: { type: string; site: string }) => v.type === 'Trailer' && v.site === 'YouTube'
  );
  const trailerKey = trailer ? trailer.key : null;
  const videoUrl = movie.customVideoUrl || null;
  const videoType = videoUrl && videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';

  // 1. Poster for detail hero card / display (Own official data source from TMDB)
  const posterImage = movie.poster_path
    ? getImageUrl(movie.poster_path, 'w500')
    : (movie.backdrop_path ? getImageUrl(movie.backdrop_path, 'w780') : '/placeholder-poster.svg');

  // 2. Backdrop for ambient background
  const heroBackdrop = movie.backdrop_path
    ? getImageUrl(movie.backdrop_path, 'original')
    : posterImage;

  // 3. Dedicated image for Player & JSON-LD thumbnailUrl (generic content)
  const defaultBackdrop = movie.backdrop_path
    ? getImageUrl(movie.backdrop_path, 'original')
    : undefined;
  const thumbnailImage =
    (movie.customImageUrl ? (movie.customImageUrl.startsWith('http') ? movie.customImageUrl : getImageUrl(movie.customImageUrl, 'w1280')) : null) ||
    defaultBackdrop ||
    posterImage;

  const yearStr = year ? ` (${year})` : '';
  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = `${movie.title}${yearStr}${creditSuffix}`;
  const videoDescription = movie.overview || `Streaming film ${movie.title} full movie sub indo.`;
  const uploadDate = movie.release_date ? `${movie.release_date}T00:00:00+07:00` : '2026-08-24T00:00:00+07:00';
  const durationIso = formatIsoDuration(movie.runtime || '120m');

  return (
    <div className="min-h-screen pb-12" style={{ background: '#050816' }}>
      {/* OpenGraph Video & Schema.org VideoObject */}
      {videoUrl && (
        <DynamicVideoSchema
          title={videoTitle}
          description={videoDescription}
          thumbnailUrl={thumbnailImage}
          uploadDate={uploadDate}
          duration={durationIso}
          urlPath={`/movie/${params.id}`}
          embedPath={`/embed/movie/${params.id}`}
          videoUrl={videoUrl}
          siteName={siteConfig.name}
          initialBaseUrl={siteUrl}
        />
      )}

      {/* ── 1. CUSTOM VIDEO PLAYER (IF CUSTOM CONTENT) OR CINEMATIC POSTER HERO BANNER ── */}
      {videoUrl ? (
        <>
          <div className="w-full bg-black mb-5">
            <VideoPlayer
              videoUrl={videoUrl}
              title={videoTitle}
              poster={thumbnailImage}
              subtitles={movie.customSubtitles}
            />
          </div>

          {/* Metadata Section below Player */}
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 pt-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-3 tracking-tight text-white">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <RatingBadge rating={movie.vote_average} size="md" />
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider"
                style={{
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  color: '#06b6d4',
                }}
              >
                HD
              </span>
              {year && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400">
                  <Calendar size={14} />
                  {year}
                </div>
              )}
              {runtime && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400">
                  <Clock size={14} />
                  {runtime}
                </div>
              )}
              {movie.original_language && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400">
                  <Globe size={14} />
                  {movie.original_language.toUpperCase()}
                </div>
              )}
            </div>

            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/genre/${genre.id}`}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105"
                    style={{
                      background: 'rgba(124,58,237,0.15)',
                      border: '1px solid rgba(124,58,237,0.35)',
                      color: '#a78bfa',
                    }}
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}

            <p className="text-xs sm:text-sm sm:leading-relaxed leading-normal mb-5 max-w-4xl text-slate-300">
              {movie.overview}
            </p>

            {director && (
              <p className="text-xs sm:text-sm mb-5 text-slate-400">
                <span className="text-white font-semibold">Director: </span>
                {director.name}
              </p>
            )}

            <MovieDetailClient
              movieTitle={movie.title}
              movieId={movie.id}
              posterPath={movie.poster_path}
              trailerKey={trailerKey}
              homepage={movie.homepage}
              hasCustomVideo={Boolean(movie.customVideoUrl)}
              rating={movie.vote_average}
              releaseDate={movie.release_date}
            />
          </div>
        </>
      ) : (
        /* Non-Custom Movie: Replace Player with Cinematic Poster Hero Banner */
        <div className="relative w-full overflow-hidden bg-[#050816] border-b border-white/10 mb-6">
          {/* Ambient Blurred Backdrop Background */}
          <div className="absolute inset-0 z-0 overflow-hidden opacity-35 pointer-events-none">
            <Image
              src={heroBackdrop}
              alt={movie.title}
              fill
              priority
              className="object-cover object-center blur-2xl scale-110"
              sizes="100vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, #050816 0%, rgba(5,8,22,0.85) 50%, rgba(5,8,22,0.65) 100%)',
              }}
            />
          </div>

          {/* Hero Content with Poster + Details Grid */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 py-8 sm:py-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
              {/* Poster Image Card */}
              <div className="relative w-44 sm:w-56 md:w-64 rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 aspect-[2/3] bg-slate-900 group">
                <Image
                  src={posterImage}
                  alt={movie.title}
                  fill
                  priority
                  className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 176px, 256px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Metadata & Actions */}
              <div className="flex-1 min-w-0 text-center md:text-left">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-3 tracking-tight text-white">
                  {movie.title}
                </h1>

                {/* Badges Row */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 mb-4">
                  <RatingBadge rating={movie.vote_average} size="md" />
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider"
                    style={{
                      background: 'rgba(6, 182, 212, 0.15)',
                      border: '1px solid rgba(6, 182, 212, 0.4)',
                      color: '#06b6d4',
                    }}
                  >
                    HD
                  </span>
                  {year && (
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300">
                      <Calendar size={14} />
                      {year}
                    </div>
                  )}
                  {runtime && (
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300">
                      <Clock size={14} />
                      {runtime}
                    </div>
                  )}
                  {movie.original_language && (
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300">
                      <Globe size={14} />
                      {movie.original_language.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                    {movie.genres.map((genre) => (
                      <Link
                        key={genre.id}
                        href={`/genre/${genre.id}`}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105"
                        style={{
                          background: 'rgba(124,58,237,0.15)',
                          border: '1px solid rgba(124,58,237,0.35)',
                          color: '#a78bfa',
                        }}
                      >
                        {genre.name}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Overview / Sinopsis */}
                <p className="text-xs sm:text-sm sm:leading-relaxed leading-normal mb-5 text-slate-300 max-w-3xl">
                  {movie.overview}
                </p>

                {/* Director */}
                {director && (
                  <p className="text-xs sm:text-sm mb-5 text-slate-400">
                    <span className="text-white font-semibold">Director: </span>
                    {director.name}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center md:justify-start">
                  <MovieDetailClient
                    movieTitle={movie.title}
                    movieId={movie.id}
                    posterPath={movie.poster_path}
                    trailerKey={trailerKey}
                    homepage={movie.homepage}
                    hasCustomVideo={Boolean(movie.customVideoUrl)}
                    rating={movie.vote_average}
                    releaseDate={movie.release_date}
                  />
                </div>

                {/* Non-local Warning Notice */}
                {!movie.isCustomMarkdown && (
                  <div className="mt-5 max-w-xl">
                    <NonLocalWarning type="movie" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. CUSTOM MARKDOWN BODY CONTENT ── */}
      {movie.customContentHtml && (
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 mt-8">
          <MarkdownRenderer
            contentHtml={movie.customContentHtml}
            title={movie.title}
          />
        </div>
      )}

      {/* ── 4. CAST SECTION (Large Circular Profile Avatars) ── */}
      {cast.length > 0 && (
        <section className="mt-10 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Top Cast & Characters
            </h2>
          </div>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto hide-scrollbar pb-3">
            {cast.map((member) => (
              <CastCard key={member.id} cast={member} />
            ))}
          </div>
        </section>
      )}

      {/* ── 5. RECOMMENDED MOVIES (GRID LAYOUT WITH ATTRACTIVE ICON) ── */}
      {similarMovies.length > 0 && (
        <section className="mt-12 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(124, 58, 237, 0.2))',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)',
              }}
            >
              <Sparkles size={16} className="text-cyan-400" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Recommended Movies
            </h2>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
            {similarMovies.map((item) => (
              <MovieCard key={item.id} item={item} type="movie" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Pre-generates static params for all custom markdown movies in video/
 */
export async function generateStaticParams() {
  const customMovieSlugs = getAllCustomMovieSlugs();
  return customMovieSlugs.map((slug) => ({
    id: slug,
  }));
}
