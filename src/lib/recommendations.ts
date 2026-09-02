import { Movie, MovieDetail } from '@/types/tmdb';
import { getTMDBCollection } from '@/lib/tmdb';
import { getAllCustomMoviesForList } from '@/lib/markdownMovies';

/**
 * Extracts the base franchise root keyword from a movie title.
 * Examples:
 * - "Transformers: The Last Knight" -> "transformers"
 * - "Transformers: Dark of the Moon" -> "transformers"
 * - "Toy Story 5" -> "toy story"
 * - "The Conjuring: Last Rites" -> "the conjuring"
 * - "Evil Dead Burn" -> "evil dead"
 * - "Jurassic World Rebirth" -> "jurassic"
 * - "Spider-Man" -> "spider-man"
 */
export function extractFranchiseRoot(title?: string): string {
  if (!title) return '';
  let clean = title.trim();

  // 1. If contains colon or dash with subtitle, take the prefix before colon
  if (clean.includes(':')) {
    clean = clean.split(':')[0].trim();
  } else if (clean.includes(' - ')) {
    clean = clean.split(' - ')[0].trim();
  }

  // 2. Remove trailing numbers or roman numerals (e.g. "Toy Story 5" -> "Toy Story", "Rocky IV" -> "Rocky")
  clean = clean.replace(/\s+(?:[0-9]+|[IVXLCDMivxlcdm]+|\bpart\b.*|\bchapter\b.*)$/i, '').trim();

  // 3. Remove common sequel suffixes (e.g. "Rebirth", "Returns", "Reloaded", "Burn", "Last Rites", etc.) if prefix is substantial
  const words = clean.split(/\s+/);
  if (words.length > 1) {
    const lastWord = words[words.length - 1].toLowerCase();
    const sequelKeywords = ['rebirth', 'returns', 'reloaded', 'burn', 'rising', 'awakens', 'forever', 'origins', 'legacy', 'revolution'];
    if (sequelKeywords.includes(lastWord)) {
      words.pop();
      clean = words.join(' ');
    }
  }

  return clean.toLowerCase().trim();
}

/**
 * Determines whether two movie titles or slugs belong to the same franchise / sequel / prequel series.
 */
export function isSequelOrFranchiseMatch(
  currentTitle: string,
  targetTitle: string,
  currentSlug?: string,
  targetSlug?: string,
  collectionName?: string
): boolean {
  const rootA = extractFranchiseRoot(currentTitle);
  const rootB = extractFranchiseRoot(targetTitle);

  if (rootA && rootB) {
    if (rootA === rootB) return true;
    if (rootA.length >= 4 && rootB.includes(rootA)) return true;
    if (rootB.length >= 4 && rootA.includes(rootB)) return true;
  }

  if (collectionName) {
    const colRoot = extractFranchiseRoot(collectionName.replace(/\bcollection\b/i, '').trim());
    if (colRoot && (rootB === colRoot || (rootB.length >= 4 && rootB.includes(colRoot)))) {
      return true;
    }
  }

  // Check slug patterns (e.g. transformers-dark-of-the-moon vs transformers)
  if (currentSlug && targetSlug) {
    const slugRootA = currentSlug.split('-')[0];
    const slugRootB = targetSlug.split('-')[0];
    if (slugRootA && slugRootB && slugRootA.length >= 4 && slugRootA === slugRootB) {
      return true;
    }
  }

  return false;
}

/**
 * Loads movie recommendations with strict priority given to:
 * 1. Sequels, Prequels & Franchise Universe movies available in local/custom catalog.
 * 2. Official TMDB collection parts (e.g. Transformers Collection, Toy Story Collection).
 * 3. Similar franchise movies from TMDB similar API.
 * 4. Custom catalog movies in the same genre.
 * 5. TMDB similar recommendations.
 */
export async function getSequelPrioritizedRecommendations(
  currentMovie: MovieDetail & { customSlug?: string },
  limit: number = 14
): Promise<Movie[]> {
  try {
    const currentId = String(currentMovie.id || '');
    const currentSlug = String(currentMovie.customSlug || '');
    const currentTitle = String(currentMovie.title || '');
    const collectionId = currentMovie.belongs_to_collection?.id;
    const collectionName = currentMovie.belongs_to_collection?.name;

    // 1. Fetch all custom movies from MongoDB / catalog
    const customMovies = await getAllCustomMoviesForList().catch(() => []);

    // Buckets
    const sequelCustomMovies: Movie[] = [];
    const collectionParts: Movie[] = [];
    const genreCustomMovies: Movie[] = [];
    const tmdbSimilarMovies: Movie[] = [];

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    // Mark current movie as seen so it is never recommended to itself
    if (currentId) seenIds.add(currentId);
    if (currentSlug) seenIds.add(currentSlug);
    if (currentTitle) seenTitles.add(currentTitle.toLowerCase().trim());

    // A. Identify Sequels/Prequels and Genre matches from Custom Catalog
    for (const item of customMovies) {
      const itemId = String(item.id || '');
      const itemSlug = String(item.customSlug || '');
      const itemTitle = String(item.title || '');
      const normTitle = itemTitle.toLowerCase().trim();

      if (seenIds.has(itemId) || seenIds.has(itemSlug) || seenTitles.has(normTitle)) {
        continue;
      }

      if (isSequelOrFranchiseMatch(currentTitle, itemTitle, currentSlug, itemSlug, collectionName)) {
        sequelCustomMovies.push(item);
      } else {
        // Check if shares any genre
        const currentGenreIds = currentMovie.genres?.map((g) => g.id) || [];
        const itemGenreIds = item.genre_ids || [];
        const sharesGenre = currentGenreIds.some((gid) => itemGenreIds.includes(gid));
        if (sharesGenre) {
          genreCustomMovies.push(item);
        }
      }
    }

    // Sort custom sequels chronologically or by title
    sequelCustomMovies.sort((a, b) => {
      const relA = new Date(a.release_date || 0).getTime();
      const relB = new Date(b.release_date || 0).getTime();
      if (relA !== relB && relA > 0 && relB > 0) return relA - relB;
      return (a.title || '').localeCompare(b.title || '');
    });

    // B. If movie belongs to an official TMDB Collection, fetch collection parts
    if (collectionId) {
      try {
        const colData = await getTMDBCollection(collectionId);
        if (colData && Array.isArray(colData.parts)) {
          for (const part of colData.parts) {
            const partId = String(part.id);
            const normTitle = (part.title || '').toLowerCase().trim();

            if (seenIds.has(partId) || seenTitles.has(normTitle)) continue;

            // Check if this part exists in custom movies (to use the custom link)
            const matchedCustom = customMovies.find(
              (c) => String(c.id) === partId || (c.title && c.title.toLowerCase().trim() === normTitle)
            );

            if (matchedCustom) {
              if (!sequelCustomMovies.some((s) => String(s.id) === String(matchedCustom.id))) {
                sequelCustomMovies.push(matchedCustom);
              }
            } else {
              collectionParts.push(part);
            }
          }
        }
      } catch (err) {
        console.warn('[recommendations] Collection fetch error:', err);
      }
    }

    // C. Process TMDB Similar Movies
    const tmdbSimilar = currentMovie.similar?.results || [];
    for (const sim of tmdbSimilar) {
      const simId = String(sim.id);
      const normTitle = (sim.title || '').toLowerCase().trim();

      if (seenIds.has(simId) || seenTitles.has(normTitle)) continue;

      // Check if this similar movie is also a sequel/prequel
      if (isSequelOrFranchiseMatch(currentTitle, sim.title || '', currentSlug, undefined, collectionName)) {
        collectionParts.push(sim);
      } else {
        tmdbSimilarMovies.push(sim);
      }
    }

    // Combine in strict order of priority:
    // 1. Custom catalog direct sequels/prequels (e.g. Transformers movies on LeviStream)
    // 2. TMDB collection parts (e.g. other Transformers/Toy Story movies)
    // 3. Custom catalog genre movies
    // 4. TMDB similar recommendations
    const finalRecommendations: Movie[] = [];

    const appendItems = (itemsList: Movie[]) => {
      for (const item of itemsList) {
        if (finalRecommendations.length >= limit) break;
        const idKey = String(item.id || '');
        const slugKey = String((item as any).customSlug || '');
        const titleKey = String(item.title || '').toLowerCase().trim();

        if (seenIds.has(idKey) || (slugKey && seenIds.has(slugKey)) || seenTitles.has(titleKey)) {
          continue;
        }

        seenIds.add(idKey);
        if (slugKey) seenIds.add(slugKey);
        seenTitles.add(titleKey);
        finalRecommendations.push(item);
      }
    };

    appendItems(sequelCustomMovies);
    appendItems(collectionParts);
    appendItems(genreCustomMovies);
    appendItems(tmdbSimilarMovies);

    return finalRecommendations;
  } catch (err) {
    console.warn('[recommendations] getSequelPrioritizedRecommendations error:', err);
    return currentMovie.similar?.results?.slice(0, limit) || [];
  }
}
