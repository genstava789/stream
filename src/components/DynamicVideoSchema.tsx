'use client';

import React, { useState, useEffect } from 'react';
import siteConfig from '@/config';
import { getBaseUrl, getAbsoluteUrl } from '@/lib/urls';

export interface DynamicVideoSchemaProps {
  title: string;
  description: string;
  thumbnailUrl: string;
  uploadDate?: string;
  duration?: string;
  urlPath: string; // e.g. "/movie/toy-story-5-2026" or "/tv/bleach/s1/e1"
  embedPath: string; // e.g. "/embed/movie/toy-story-5-2026"
  siteName?: string;
  initialBaseUrl?: string;
}

export default function DynamicVideoSchema({
  title,
  description,
  thumbnailUrl,
  uploadDate = '2026-08-24T00:00:00+07:00',
  duration,
  urlPath,
  embedPath,
  siteName = siteConfig.name,
  initialBaseUrl,
}: DynamicVideoSchemaProps) {
  // Use state to allow client-side hydration to automatically update to window.location.origin
  const [activeOrigin, setActiveOrigin] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/+$/, '');
    }
    return (initialBaseUrl || siteConfig.url || 'https://levistream.freebuff.app').replace(/\/+$/, '');
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const liveOrigin = window.location.origin.replace(/\/+$/, '');
      if (liveOrigin !== activeOrigin) {
        setActiveOrigin(liveOrigin);
      }
    }
  }, [activeOrigin]);

  const cleanUrlPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const cleanEmbedPath = embedPath.startsWith('/') ? embedPath : `/${embedPath}`;

  const pageUrl = `${activeOrigin}${cleanUrlPath}`;
  const embedUrl = `${activeOrigin}${cleanEmbedPath}`;
  const logoUrl = `${activeOrigin}/logo.png`;

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description || title,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: uploadDate,
    ...(duration ? { duration } : {}),
    contentUrl: pageUrl,
    embedUrl: embedUrl,
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: activeOrigin,
      logo: {
        '@type': 'ImageObject',
        url: logoUrl,
      },
    },
    provider: {
      '@type': 'Organization',
      name: siteName,
      url: activeOrigin,
    },
    author: {
      '@type': 'Organization',
      name: siteName,
    },
  };

  return (
    <>
      <meta property="og:site_name" content={siteName} />
      <meta name="application-name" content={siteName} />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      <link rel="video_src" href={embedUrl} />
      <meta property="og:video" content={embedUrl} />
      <meta property="og:video:url" content={embedUrl} />
      <meta property="og:video:secure_url" content={embedUrl} />
      <meta property="og:video:type" content="text/html" />
      <meta property="og:video:width" content="1920" />
      <meta property="og:video:height" content="1080" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData, null, 2) }}
      />
    </>
  );
}
