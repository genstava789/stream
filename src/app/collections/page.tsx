import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import CollectionsClient from './CollectionsClient';
import { getPublicCollections } from '@/lib/mongodb/collectionService';
import siteConfig from '@/config';

// ISR with On-Demand Revalidation (Optimized for Vercel Free Tier)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Koleksi Film & Series Komunitas - ${siteConfig.name}`,
  description: `Jelajahi dan temukan daftar koleksi film dan serial TV kurasi komunitas terbaik di ${siteConfig.name}.`,
};

function CollectionsSkeleton() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16" style={{ background: '#050816' }}>
      <div className="max-w-7xl mx-auto">
        <div className="h-44 sm:h-56 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse mb-8" />
        <div className="h-12 w-full max-w-md bg-white/[0.03] rounded-2xl animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function CollectionsPage() {
  const data = await getPublicCollections({ filter: 'latest', limit: 24 }).catch(() => ({
    collections: [],
    total: 0,
  }));

  return (
    <Suspense fallback={<CollectionsSkeleton />}>
      <CollectionsClient
        initialCollections={data.collections}
        initialTotal={data.total}
        initialFilter="latest"
      />
    </Suspense>
  );
}
