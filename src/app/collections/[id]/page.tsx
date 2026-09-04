import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCollectionByIdOrSlug } from '@/lib/mongodb/collectionService';
import CollectionDetailClient from './CollectionDetailClient';
import { getServerBaseUrl, getServerAbsoluteUrl } from '@/lib/serverUrls';
import siteConfig from '@/config';
import { getImageUrl } from '@/lib/tmdb';

export const dynamicParams = true;
// ISR with On-Demand Revalidation (Optimized for Vercel Free Tier)
export const revalidate = 3600;

interface PageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const collection = await getCollectionByIdOrSlug(params.id).catch(() => null);

  if (!collection) {
    return {
      title: `Koleksi Tidak Ditemukan - ${siteConfig.name}`,
    };
  }

  const siteUrl = getServerBaseUrl();
  const itemCount = collection.itemCount || (collection.items || []).length;
  const yearSpan =
    collection.yearStart && collection.yearEnd
      ? collection.yearStart === collection.yearEnd
        ? ` (${collection.yearStart})`
        : ` (${collection.yearStart} - ${collection.yearEnd})`
      : '';

  const title = `${collection.title}${yearSpan} - Koleksi ${siteConfig.name}`;
  const description =
    collection.description ||
    `Lihat koleksi "${collection.title}" berisi ${itemCount} film & series pilihan oleh ${collection.authorName} di ${siteConfig.name}.`;

  const image = collection.featuredBackdrop
    ? getImageUrl(collection.featuredBackdrop, 'w1280')
    : collection.featuredPoster
    ? getImageUrl(collection.featuredPoster, 'w780')
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: getServerAbsoluteUrl(`/collections/${collection.slug || params.id}`),
      siteName: siteConfig.name,
      images: image ? [{ url: image, width: 1280, height: 720, alt: collection.title }] : undefined,
      type: 'video.other',
    },
  };
}

import { getAuthenticatedUser } from '@/lib/auth/session';

export default async function CollectionDetailPage({ params }: PageProps) {
  const user = await getAuthenticatedUser().catch(() => null);
  const collection = await getCollectionByIdOrSlug(params.id, user?.id).catch(() => null);

  if (!collection) {
    notFound();
  }

  return <CollectionDetailClient collection={collection} />;
}
