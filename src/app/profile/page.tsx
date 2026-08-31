import React from 'react';
import type { Metadata } from 'next';
import ProfilePageClient from '@/app/profile/ProfilePageClient';
import siteConfig from '@/config';

export const metadata: Metadata = {
  title: `Profil Saya - ${siteConfig.name}`,
  description: `Kelola profil, daftar watchlist, dan riwayat tontonan Anda di ${siteConfig.name}.`,
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
