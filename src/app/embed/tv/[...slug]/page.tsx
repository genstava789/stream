import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getTVShowDetailsWithCustomOverride,
  getAllCustomTVSlugPaths,
} from '@/lib/markdownTV';
import VideoPlayer from '@/components/VideoPlayer';
import { getImageUrl } from '@/lib/tmdb';
import { getServerBaseUrl, getServerAbsoluteUrl } from '@/lib/serverUrls';
import siteConfig from '@/config';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

interface PageProps {
  params: {
    slug: string[];
  };
}

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
    : data.overview || `Watch TV shows on ${siteConfig.name}.`;

  const image = isEpisodePage && activeEpisode?.imageUrl
    ? activeEpisode.imageUrl
    : data.customImageUrl ||
      (data.backdrop_path ? getImageUrl(data.backdrop_path, 'w1280') : data.poster_path ? getImageUrl(data.poster_path, 'w500') : undefined);

  const videoUrl = activeEpisode?.videoUrl || null;
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

export default async function TVEpisodeEmbedPage({ params }: PageProps) {
  const data = await getTVShowDetailsWithCustomOverride(params.slug).catch(() => null);

  if (!data) {
    notFound();
  }

  const activeEpisode = data.activeEpisode || null;
  if (!activeEpisode || !activeEpisode.videoUrl) {
    notFound();
  }

  const siteUrl = getServerBaseUrl();
  const videoUrl = activeEpisode.videoUrl;
  const defaultBackdrop = data.backdrop_path
    ? getImageUrl(data.backdrop_path, 'original')
    : undefined;
  const thumbnailImage =
    (activeEpisode.imageUrl ? getImageUrl(activeEpisode.imageUrl, 'w1280') : null) ||
    (data.customImageUrl ? getImageUrl(data.customImageUrl, 'w1280') : null) ||
    defaultBackdrop ||
    (data.poster_path ? getImageUrl(data.poster_path, 'w500') : '');

  const creditSuffix = siteConfig.useCreditTitleForRave && siteConfig.name ? ` | ${siteConfig.name}` : '';
  const videoTitle = `${data.name} - ${activeEpisode.episodeLabel}: ${activeEpisode.title}${creditSuffix}`;
  const videoDescription = activeEpisode.overview || data.overview || `Streaming ${data.name} full episode sub indo.`;
  const uploadDate = data.first_air_date ? `${data.first_air_date}T00:00:00+07:00` : '2026-08-24T00:00:00+07:00';

  const pageUrl = getServerAbsoluteUrl(`/tv/${params.slug.join('/')}`);
  const embedUrl = getServerAbsoluteUrl(`/embed/tv/${params.slug.join('/')}`);

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
        url: getServerAbsoluteUrl('/logo.png'),
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
          subtitles={activeEpisode.subtitles}
        />
      </div>
    </div>
  );
}
