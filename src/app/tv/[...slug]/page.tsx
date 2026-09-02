import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';
import { Calendar, Clock, Sparkles, Users, Folder, ChevronLeft, AlertTriangle } from 'lucide-react';
import { getImageUrl } from '@/lib/tmdb';
import {
  getTVShowDetailsWithCustomOverride,
  getAllCustomTVSlugPaths,
} from '@/lib/markdownTV';
import MovieCard from '@/components/MovieCard';
import CastCard from '@/components/CastCard';
import RatingBadge from '@/components/RatingBadge';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import TVDetailClient, { TVDetailHeaderActions } from '@/components/TVDetailClient';
import TVEpisodeList from '@/components/TVEpisodeList';
import NonLocalWarning from '@/components/NonLocalWarning';
import DynamicVideoSchema from '@/components/DynamicVideoSchema';
import { getServerBaseUrl, getServerAbsoluteUrl } from '@/lib/serverUrls';
import siteConfig from '@/config';

export const dynamicParams = true;
export const revalidate = 3600;

interface PageProps {
  params: {
    slug: string[];
  };
}

/**
 * Dynamic metadata generation for SEO & OpenGraph
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getTVShowDetailsWithCustomOverride(params.slug).catch(() => null);

  if (!data) {
    return {
      title: `TV Show Not Found - ${siteConfig.name}`,
    };
  }

  const isEpisodePage = params.slug.length > 1;
  const activeEpisode = data.activeEpisode || null;
  const siteUrl = getServerBaseUrl();
  const epTitle = isEpisodePage && activeEpisode
    ? ` - ${activeEpisode.episodeLabel}: ${activeEpisode.title}`
    : '';
  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = isEpisodePage && activeEpisode
    ? `${data.name} - ${activeEpisode.episodeLabel}: ${activeEpisode.title}${creditSuffix}`
    : `${data.name}${creditSuffix}`;
  const title = `${data.name}${epTitle} - ${siteConfig.name}`;
  const description = isEpisodePage && activeEpisode?.overview
    ? activeEpisode.overview
    : data.overview || `Watch TV shows and stream episodes online on ${siteConfig.name}.`;

  const image = isEpisodePage && data.activeEpisode?.imageUrl
    ? data.activeEpisode.imageUrl
    : data.customImageUrl ||
      (data.backdrop_path ? getImageUrl(data.backdrop_path, 'w1280') : data.poster_path ? getImageUrl(data.poster_path, 'w500') : undefined);

  const videoUrl = isEpisodePage && data.activeEpisode?.videoUrl ? data.activeEpisode.videoUrl : null;
  const videoType = videoUrl && videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
  const pageUrl = getServerAbsoluteUrl(`/tv/${params.slug.join('/')}`);
  const embedUrl = getServerAbsoluteUrl(`/embed/tv/${params.slug.join('/')}`);

  return {
    title,
    description: description.slice(0, 160),
    openGraph: {
      siteName: siteConfig.name,
      title: videoTitle,
      description: description.slice(0, 160),
      type: isEpisodePage ? 'video.episode' : 'video.tv_show',
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

export default async function TVShowPage({ params }: PageProps) {
  const data = await getTVShowDetailsWithCustomOverride(params.slug).catch(() => null);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050816' }}>
        <div className="text-center px-4">
          <h2 className="text-2xl font-bold text-white mb-2">Serial TV Tidak Ditemukan</h2>
          <p className="text-neo-text-secondary text-sm mb-6">
            Data untuk URL serial TV &ldquo;{params.slug.join('/')}&rdquo; tidak ditemukan.
          </p>
          <Link
            href="/tv"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-lg hover:shadow-cyan-500/25"
          >
            <ChevronLeft size={18} />
            <span>Kembali ke Katalog Serial TV</span>
          </Link>
        </div>
      </div>
    );
  }

  const siteUrl = getServerBaseUrl();
  const isEpisodePage = params.slug.length > 1;
  const activeEpisode = data.activeEpisode || null;
  const showSlug = params.slug[0];
  const videoUrl = activeEpisode?.videoUrl || null;
  const videoType = videoUrl && videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
  const pageUrl = getServerAbsoluteUrl(`/tv/${params.slug.join('/')}`);
  const embedUrl = getServerAbsoluteUrl(`/embed/tv/${params.slug.join('/')}`);

  const cast = data.credits?.cast?.slice(0, 14) || [];
  const similarShows = data.similar?.results?.slice(0, 14) || [];
  const year = data.first_air_date ? new Date(data.first_air_date).getFullYear() : '';
  const runtime = data.episode_run_time?.[0] ? `${data.episode_run_time[0]}m / ep` : null;

  const trailer =
    data.videos?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube' && v.official) ||
    data.videos?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube') ||
    data.videos?.results?.[0];
  const trailerKey = trailer?.key || null;

  // 1. Poster for detail hero card / display (Own official data source from TMDB)
  const posterImage = data.poster_path
    ? getImageUrl(data.poster_path, 'w500')
    : (data.backdrop_path ? getImageUrl(data.backdrop_path, 'w780') : '/placeholder-poster.svg');

  // 2. Backdrop for ambient background
  const heroBackdrop = data.backdrop_path
    ? getImageUrl(data.backdrop_path, 'original')
    : posterImage;

  // 3. Dedicated image for Player & JSON-LD thumbnailUrl (generic content)
  const defaultBackdrop = data.backdrop_path
    ? getImageUrl(data.backdrop_path, 'original')
    : undefined;
  const thumbnailImage =
    (activeEpisode?.imageUrl ? getImageUrl(activeEpisode.imageUrl, 'w1280') : null) ||
    (data.customImageUrl ? getImageUrl(data.customImageUrl, 'w1280') : null) ||
    defaultBackdrop ||
    posterImage;

  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = isEpisodePage && activeEpisode
    ? `${data.name} - ${activeEpisode.episodeLabel}: ${activeEpisode.title}${creditSuffix}`
    : `${data.name}${creditSuffix}`;
  const videoDescription = activeEpisode?.overview || data.overview || `Streaming serial TV ${data.name} full episode sub indo.`;
  const uploadDate = data.first_air_date ? `${data.first_air_date}T00:00:00+07:00` : '2026-08-24T00:00:00+07:00';
  const durationIso = formatIsoDuration(activeEpisode?.duration || data.episode_run_time?.[0] || '45m');

  return (
    <div className="min-h-screen pb-12" style={{ background: '#050816' }}>
      {/* OpenGraph Video & Schema.org VideoObject (Only on Episode page with video) */}
      {isEpisodePage && videoUrl && (
        <DynamicVideoSchema
          title={videoTitle}
          description={videoDescription}
          thumbnailUrl={thumbnailImage}
          uploadDate={uploadDate}
          duration={durationIso}
          urlPath={`/tv/${params.slug.join('/')}`}
          embedPath={`/embed/tv/${params.slug.join('/')}`}
          videoUrl={videoUrl}
          siteName={siteConfig.name}
          initialBaseUrl={siteUrl}
        />
      )}

      {/* ── CASE A: EPISODE PLAYBACK PAGE (slug.length > 1) ── */}
      {isEpisodePage ? (
        <>
          {/* Top Video Player + Bilibili.tv-Style Grid / Pill Episode Selector */}
          <div className="w-full mb-6">
            <TVDetailClient
              showTitle={data.name}
              seasons={data.seasonsList || []}
              hasSeasons={Boolean(data.hasSeasons)}
              initialActiveEpisode={data.activeEpisode || null}
              defaultBackdrop={defaultBackdrop}
            />
          </div>

          {/* Recommended TV Shows */}
          {similarShows.length > 0 && (
            <section className="mt-12 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(124, 58, 237, 0.2))',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    boxShadow: '0 0 15px rgba(236, 72, 153, 0.2)',
                  }}
                >
                  <Sparkles size={16} className="text-pink-400" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Recommended TV
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-4">
                {similarShows.map((item) => (
                  <MovieCard key={item.id} item={item} type="tv" />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* ── CASE B: TV OVERVIEW PAGE (slug.length === 1, NO PLAYER) WITH POSTER ── */
        <>
          <div className="relative w-full overflow-hidden bg-[#050816] border-b border-white/10 mb-6">
            {/* Ambient Blurred Backdrop Background */}
            <div className="absolute inset-0 z-0 overflow-hidden opacity-35 pointer-events-none">
              <Image
                src={heroBackdrop}
                alt={data.name}
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
                    alt={data.name}
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
                    {data.name}
                  </h1>

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3 mb-4">
                    <RatingBadge rating={data.vote_average} size="md" />
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
                    {data.hasSeasons && data.number_of_seasons ? (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                        style={{
                          background: 'rgba(6,182,212,0.12)',
                          border: '1px solid rgba(6,182,212,0.35)',
                          color: '#06b6d4',
                        }}
                      >
                        <Folder size={13} />
                        <span>{data.number_of_seasons} Season{data.number_of_seasons > 1 ? 's' : ''}</span>
                      </div>
                    ) : null}
                    {data.number_of_episodes ? (
                      <div
                        className="px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                        style={{
                          background: 'rgba(124,58,237,0.12)',
                          border: '1px solid rgba(124,58,237,0.35)',
                          color: '#a78bfa',
                        }}
                      >
                        {data.number_of_episodes} Episodes
                      </div>
                    ) : null}
                  </div>

                  {/* Genres */}
                  {data.genres && data.genres.length > 0 && (
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                      {data.genres.map((genre) => (
                        <Link
                          key={genre.id}
                          href={`/genre/${genre.id}?type=tv`}
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
                  <p className="text-xs sm:text-sm sm:leading-relaxed leading-normal mb-6 text-slate-300 max-w-3xl">
                    {data.overview}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex justify-center md:justify-start">
                    <TVDetailHeaderActions
                      activeEpisodeLabel={data.activeEpisode?.episodeLabel}
                      activeEpisodeTitle={data.activeEpisode?.title}
                      hasVideo={Boolean(data.activeEpisode?.videoUrl)}
                      trailerKey={trailerKey}
                      homepage={data.homepage}
                      showTitle={data.name}
                      showId={data.id}
                      posterPath={data.poster_path}
                      rating={data.vote_average}
                      releaseDate={data.first_air_date}
                    />
                  </div>

                  {/* Non-local Warning Notice */}
                  {!data.isCustomTV && (
                    <div className="mt-5 max-w-xl">
                      <NonLocalWarning type="tv" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Show Overview Markdown Content */}
          {data.customContentHtml && (
            <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 mt-8">
              <MarkdownRenderer
                contentHtml={data.customContentHtml}
                title={`${data.name} - Informasi & Sinopsis Serial`}
              />
            </div>
          )}

          {/* Top Cast & Characters */}
          {cast.length > 0 && (
            <section className="mt-10 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-pink-400" />
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

          {/* Episodes List UI (Below Top Cast) */}
          {data.seasonsList && data.seasonsList.length > 0 && (
            <TVEpisodeList
              seasons={data.seasonsList}
              hasSeasons={Boolean(data.hasSeasons)}
              showTitle={data.name}
              showSlug={showSlug}
              defaultBackdrop={defaultBackdrop}
            />
          )}

          {/* Recommended TV Shows (Grid) */}
          {similarShows.length > 0 && (
            <section className="mt-12 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(124, 58, 237, 0.2))',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    boxShadow: '0 0 15px rgba(236, 72, 153, 0.2)',
                  }}
                >
                  <Sparkles size={16} className="text-pink-400" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Recommended TV
                </h2>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5 md:gap-5">
                {similarShows.map((item) => (
                  <MovieCard key={item.id} item={item} type="tv" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Pre-generates static params for all custom TV shows, seasons, and episodes
 */
export async function generateStaticParams() {
  return await getAllCustomTVSlugPaths();
}
