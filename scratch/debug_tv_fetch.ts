import { getPaginatedMongoTVShows, getMongoContentCounts, getMongoTVShows, isMongoConfigured } from '@/lib/mongodb/service';
import { fetchPaginatedAdminContent } from '@/lib/admin/cmsService';

async function test() {
  console.log('isMongoConfigured:', isMongoConfigured());
  const counts = await getMongoContentCounts();
  console.log('counts:', counts);
  const pagedTV = await getPaginatedMongoTVShows({ page: 1, limit: 7 });
  console.log('pagedTV:', { total: pagedTV.total, itemsCount: pagedTV.items.length, items: pagedTV.items.map(s => s.showSlug) });
  const allMongo = await getMongoTVShows();
  console.log('allMongo count:', allMongo.length, allMongo.map(s => s.showSlug));

  const adminContent = await fetchPaginatedAdminContent({ owner: 'genstava789', repo: 'filmes', branch: 'main' });
  console.log('adminContent:', {
    moviesCount: adminContent.movies.length,
    tvShowsCount: adminContent.tvShows.length,
    totalAllMoviesCount: adminContent.totalAllMoviesCount,
    totalAllTvShowsCount: adminContent.totalAllTvShowsCount,
    tvSlugs: adminContent.tvShows.map(s => s.showSlug)
  });
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
