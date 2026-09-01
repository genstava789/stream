import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getMovieDetailsWithCustomOverride,
  getAllCustomMovieSlugs,
} from '@/lib/markdownMovies';
import VideoPlayer from '@/components/VideoPlayer';
import { getImageUrl } from '@/lib/tmdb';
import { getBaseUrl, getAbsoluteUrl } from '@/lib/urls';
import siteConfig from '@/config';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

interface PageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const movie = await getMovieDetailsWithCustomOverride(params.id).catch(() => null);

  if (!movie) {
    return {
      title: `Movie Not Found - ${siteConfig.name}`,
    };
  }

  const siteUrl = getBaseUrl();
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const yearStr = year ? ` (${year})` : '';
  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = `${movie.title}${yearStr}${creditSuffix}`;
  const title = `${movie.title}${yearStr} - ${siteConfig.name}`;
  const description = movie.overview ? movie.overview.slice(0, 160) : `Watch movies on ${siteConfig.name}.`;
  const videoUrl = movie.customVideoUrl || null;
  const pageUrl = getAbsoluteUrl(`/movie/${params.id}`);
  const embedUrl = getAbsoluteUrl(`/embed/movie/${params.id}`);

  const image = movie.customImageUrl
    ? getImageUrl(movie.customImageUrl, 'w1280')
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
              type: 'video/mp4',
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
          'twitter:player:stream:content_type': 'video/mp4',
          'video_src': embedUrl,
        }
      : {
          'og:site_name': siteConfig.name,
          'application-name': siteConfig.name,
        },
  };
}

export default async function MovieEmbedPage({ params }: PageProps) {
  const movie = await getMovieDetailsWithCustomOverride(params.id).catch(() => null);

  if (!movie || !movie.customVideoUrl) {
    notFound();
  }

  const siteUrl = getBaseUrl();
  const videoUrl = movie.customVideoUrl;
  const defaultBackdrop = movie.backdrop_path
    ? getImageUrl(movie.backdrop_path, 'original')
    : undefined;
  const thumbnailImage = movie.customImageUrl
    ? getImageUrl(movie.customImageUrl, 'w1280')
    : defaultBackdrop || (movie.poster_path ? getImageUrl(movie.poster_path, 'w500') : '');
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const yearStr = year ? ` (${year})` : '';
  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = `${movie.title}${yearStr}${creditSuffix}`;
  const videoDescription = movie.overview || `Streaming film ${movie.title} sub indo kualitas HD.`;
  const uploadDate = movie.release_date ? `${movie.release_date}T00:00:00+07:00` : '2026-08-24T00:00:00+07:00';

  const pageUrl = getAbsoluteUrl(`/movie/${params.id}`);
  const embedUrl = getAbsoluteUrl(`/embed/movie/${params.id}`);

  const videoObjectSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: videoTitle,
    description: videoDescription,
    thumbnailUrl: [thumbnailImage],
    uploadDate: uploadDate,
    contentUrl: pageUrl,
    embedUrl: embedUrl,
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: getAbsoluteUrl('/logo.png'),
      },
    },
    provider: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteUrl,
    },
    author: {
      '@type': 'Organization',
      name: siteConfig.name,
    },
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden flex items-center justify-center m-0 p-0">
      {/* Schema.org & Meta */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObjectSchema, null, 2) }}
      />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta name="application-name" content={siteConfig.name} />
      <meta name="apple-mobile-web-app-title" content={siteConfig.name} />
      <link rel="video_src" href={embedUrl} />
      <meta property="og:video" content={embedUrl} />
      <meta property="og:video:type" content="text/html" />

      <div className="w-full h-full">
        <VideoPlayer
          videoUrl={videoUrl}
          title={videoTitle}
          poster={thumbnailImage}
          subtitles={movie.customSubtitles}
        />
      </div>
    </div>
  );
}
