import React from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getGenres,
  getTVGenres,
  getGenreById,
  getTVGenreById,
} from '@/lib/tmdb';
import { getAllCustomMoviesForList } from '@/lib/markdownMovies';
import { getAllCustomTVShowsForList } from '@/lib/markdownTV';
import GenrePageClient from './GenrePageClient';
import siteConfig from '@/config';

interface PageProps {
  params: { id: string };
  searchParams: { page?: string; sort?: string; type?: string; lang?: string };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const isTV = searchParams.type === 'tv';
  const isAll = params.id.toLowerCase() === 'all';
  const genreId = isAll ? 0 : Number(params.id);
  const genre = isAll
    ? { id: 0, name: 'All' }
    : isTV
    ? await getTVGenreById(genreId).catch(() => null)
    : await getGenreById(genreId).catch(() => null);

  const mediaLabel = isTV ? 'TV Series' : 'Movies';

  return {
    title: genre ? `${genre.name} ${mediaLabel} - ${siteConfig.name}` : `Genre - ${siteConfig.name}`,
    description: genre
      ? `Browse ${genre.name} ${mediaLabel.toLowerCase()} on ${siteConfig.name}.`
      : `Browse ${mediaLabel.toLowerCase()} by genre.`,
  };
}

export const revalidate = 15;

export default async function GenrePage({ params, searchParams }: PageProps) {
  const isTV = searchParams.type === 'tv';
  const isAll = params.id.toLowerCase() === 'all';
  const genreId = isAll ? 0 : Number(params.id);
  if (!isAll && isNaN(genreId)) notFound();

  const page = Number(searchParams.page) || 1;
  const sort = searchParams.sort || 'popularity.desc';
  const initialLang = (searchParams.lang || 'all').toLowerCase();

  const [genreData, localItemsData, allGenres] = await Promise.allSettled([
    !isAll ? (isTV ? getTVGenreById(genreId) : getGenreById(genreId)) : Promise.resolve({ id: 0, name: 'All' }),
    isTV ? getAllCustomTVShowsForList() : getAllCustomMoviesForList(),
    isTV ? getTVGenres().catch(() => getGenres()) : getGenres(),
  ]);

  const genre = isAll
    ? { id: 0, name: 'All' }
    : genreData.status === 'fulfilled' && genreData.value
    ? genreData.value
    : isTV
    ? await getGenreById(genreId).catch(() => null)
    : null;

  const rawLocalItems = localItemsData.status === 'fulfilled' ? localItemsData.value : [];
  const genres = allGenres.status === 'fulfilled' ? allGenres.value : [];

  if (!genre) notFound();

  return (
    <GenrePageClient
      genre={genre}
      initialGenreId={isAll ? null : genreId}
      allLocalItems={rawLocalItems}
      initialPage={page}
      initialSort={sort}
      initialLanguage={initialLang === 'id' ? 'id' : initialLang === 'en' ? 'en' : 'all'}
      allGenres={genres}
      type={isTV ? 'tv' : 'movie'}
    />
  );
}
