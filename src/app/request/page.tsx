import React from 'react';
import type { Metadata } from 'next';
import RequestPageClient from './RequestPageClient';
import { getGenres, getTVGenres } from '@/lib/tmdb';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Request Film & TV Series - ${siteConfig.name}`,
  description: `Minta film atau serial TV favorit kamu yang belum tersedia di ${siteConfig.name}. Tim kami akan segera meninjau dan menambahkannya.`,
  openGraph: {
    title: `Request Film & TV Series - ${siteConfig.name}`,
    description: `Minta film atau serial TV favorit kamu yang belum tersedia di ${siteConfig.name}.`,
  },
};

export const revalidate = 3600;

export default async function RequestPage() {
  const [movieGenres, tvGenres] = await Promise.all([
    getGenres().catch(() => []),
    getTVGenres().catch(() => []).catch(() => []),
  ]);

  return (
    <RequestPageClient
      movieGenres={movieGenres || []}
      tvGenres={tvGenres || []}
    />
  );
}
