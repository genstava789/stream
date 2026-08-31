import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import {
  IContentProvider,
  MovieRecord,
  TVShowRecord,
  EpisodeRecord,
  QueryParams,
  SaveMoviePayload,
  SaveTVShowPayload,
  SaveEpisodePayload,
  MutationResult,
} from '../types';
import { memoryCache } from '@/lib/cache';
import { slugify } from '@/lib/urls';
import {
  serializeTinaMovie,
  serializeTinaTVShow,
  serializeTinaTVEpisode,
} from '@/lib/tina/schema';
import { STATIC_MOVIE_FILES, STATIC_TV_FILES } from '@/lib/staticContentRegistry';

const VIDEO_DIR = path.join(process.cwd(), 'video');
const TV_DIR = path.join(process.cwd(), 'tv');

/**
 * High-Performance Local Markdown Provider with In-Memory Indexing
 */
export class LocalMarkdownProvider implements IContentProvider {
  readonly name = 'local-markdown';

  private ensureDirs() {
    if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
    if (!fs.existsSync(TV_DIR)) fs.mkdirSync(TV_DIR, { recursive: true });
  }

  // ──────────────────────────────────────────
  // MOVIES
  // ──────────────────────────────────────────

  async getMovies(query?: QueryParams): Promise<MovieRecord[]> {
    const cacheKey = 'content_provider_all_movies';
    const allMovies = await memoryCache.getOrFetch<MovieRecord[]>(
      cacheKey,
      async () => {
        this.ensureDirs();
        try {
          const files = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.markdown'));
          const records: MovieRecord[] = [];

          for (const file of files) {
            try {
              const fullPath = path.join(VIDEO_DIR, file);
              const stats = fs.statSync(fullPath);
              const raw = fs.readFileSync(fullPath, 'utf8');
              const { data, content } = matter(raw);

              const slug = file.replace(/\.(md|markdown)$/i, '');
              records.push({
                id: slug,
                slug,
                title: data.title || slug,
                relativePath: `video/${file}`,
                frontmatter: data,
                content,
                contentHtml: marked.parse(content || '') as string,
                updatedAt: stats.mtimeMs,
              });
            } catch (err) {
              console.error(`[LocalMarkdownProvider] Error reading movie ${file}:`, err);
            }
          }

          if (records.length === 0 && typeof STATIC_MOVIE_FILES === 'object') {
            const seenSlugs = new Set<string>();
            for (const [key, raw] of Object.entries(STATIC_MOVIE_FILES)) {
              const normKey = key.replace(/\\/g, '/');
              const file = path.basename(normKey);
              const slug = file.replace(/\.(md|markdown)$/i, '');
              if (seenSlugs.has(slug)) continue;
              seenSlugs.add(slug);
              try {
                const { data, content } = matter(raw);
                records.push({
                  id: slug,
                  slug,
                  title: data.title || slug,
                  relativePath: `video/${file}`,
                  frontmatter: data,
                  content,
                  contentHtml: marked.parse(content || '') as string,
                  updatedAt: Date.now(),
                });
              } catch {}
            }
          }

          return records;
        } catch (e) {
          console.error('[LocalMarkdownProvider] Error listing video files:', e);
          if (typeof STATIC_MOVIE_FILES === 'object') {
            const seenSlugs = new Set<string>();
            const records: MovieRecord[] = [];
            for (const [key, raw] of Object.entries(STATIC_MOVIE_FILES)) {
              const normKey = key.replace(/\\/g, '/');
              const file = path.basename(normKey);
              const slug = file.replace(/\.(md|markdown)$/i, '');
              if (seenSlugs.has(slug)) continue;
              seenSlugs.add(slug);
              try {
                const { data, content } = matter(raw);
                records.push({
                  id: slug,
                  slug,
                  title: data.title || slug,
                  relativePath: `video/${file}`,
                  frontmatter: data,
                  content,
                  contentHtml: marked.parse(content || '') as string,
                  updatedAt: Date.now(),
                });
              } catch {}
            }
            return records;
          }
          return [];
        }
      },
      60_000, // 60s hard TTL
      30_000  // 30s SWR
    );

    let result = [...allMovies];

    if (query?.featured !== undefined) {
      result = result.filter((m) => Boolean(m.frontmatter.featured) === query.featured);
    }

    if (query?.search) {
      const q = query.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q) ||
          (m.frontmatter.tmdb_id && String(m.frontmatter.tmdb_id).includes(q))
      );
    }

    if (query?.sortBy === 'newest') result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (query?.sortBy === 'oldest') result.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    if (query?.sortBy === 'title_asc') result.sort((a, b) => a.title.localeCompare(b.title));
    if (query?.sortBy === 'title_desc') result.sort((a, b) => b.title.localeCompare(a.title));

    if (query?.limit) {
      const offset = query.offset || 0;
      result = result.slice(offset, offset + query.limit);
    }

    return result;
  }

  async getMovieBySlug(slugOrId: string | number): Promise<MovieRecord | null> {
    const movies = await this.getMovies();
    const key = String(slugOrId).toLowerCase().trim().replace(/\.(md|markdown)$/i, '');

    return (
      movies.find((m) => {
        const idMatch = m.frontmatter.tmdb_id && String(m.frontmatter.tmdb_id) === key;
        const slugMatch = m.slug.toLowerCase() === key || m.relativePath.toLowerCase() === `video/${key}.md`;
        return idMatch || slugMatch;
      }) || null
    );
  }

  async getAllMovieSlugs(): Promise<string[]> {
    const movies = await this.getMovies();
    const slugs = new Set<string>();

    movies.forEach((m) => {
      slugs.add(m.slug);
      slugs.add(`${m.slug}.md`);
      if (m.frontmatter.tmdb_id) slugs.add(String(m.frontmatter.tmdb_id));
      if (m.frontmatter.title) {
        const tSlug = slugify(m.frontmatter.title);
        if (tSlug) {
          slugs.add(tSlug);
          if (m.frontmatter.tmdb_id) slugs.add(`${tSlug}-${m.frontmatter.tmdb_id}`);
        }
      }
    });

    return Array.from(slugs);
  }

  // ──────────────────────────────────────────
  // TV SHOWS & EPISODES
  // ──────────────────────────────────────────

  async getTVShows(query?: QueryParams): Promise<TVShowRecord[]> {
    const cacheKey = 'content_provider_all_tv_shows';
    const allShows = await memoryCache.getOrFetch<TVShowRecord[]>(
      cacheKey,
      async () => {
        this.ensureDirs();
        try {
          const showFolders = fs.readdirSync(TV_DIR).filter((f) => {
            const p = path.join(TV_DIR, f);
            return fs.statSync(p).isDirectory();
          });

          const shows: TVShowRecord[] = [];

          for (const folder of showFolders) {
            try {
              const showPath = path.join(TV_DIR, folder);
              const indexPath = path.join(showPath, '_index.md');
              let frontmatter: any = {};
              let content = '';
              let stats: fs.Stats | null = null;

              if (fs.existsSync(indexPath)) {
                stats = fs.statSync(indexPath);
                const raw = fs.readFileSync(indexPath, 'utf8');
                const parsed = matter(raw);
                frontmatter = parsed.data;
                content = parsed.content;
              }

              // Scan Seasons and Episodes
              const episodes: EpisodeRecord[] = [];
              const subItems = fs.readdirSync(showPath);

              for (const sub of subItems) {
                const subPath = path.join(showPath, sub);
                if (fs.statSync(subPath).isDirectory()) {
                  // Season directory (e.g. "s1", "s2")
                  const epFiles = fs.readdirSync(subPath).filter((f) => f.endsWith('.md'));
                  for (const epFile of epFiles) {
                    try {
                      const epFullPath = path.join(subPath, epFile);
                      const epStats = fs.statSync(epFullPath);
                      const epRaw = fs.readFileSync(epFullPath, 'utf8');
                      const { data: epData, content: epContent } = matter(epRaw);
                      const epSlug = epFile.replace(/\.md$/i, '');
                      const epNum = parseInt(epSlug.replace(/\D/g, '') || '1', 10);

                      episodes.push({
                        id: `${folder}-${sub}-${epSlug}`,
                        showSlug: folder,
                        seasonFolder: sub,
                        episodeNumber: epNum,
                        slug: epSlug,
                        title: epData.title || `Episode ${epNum}`,
                        relativePath: `tv/${folder}/${sub}/${epFile}`,
                        frontmatter: epData,
                        content: epContent,
                        contentHtml: marked.parse(epContent || '') as string,
                        updatedAt: epStats.mtimeMs,
                      });
                    } catch (epErr) {
                      console.error(`[LocalMarkdownProvider] Error reading episode ${epFile}:`, epErr);
                    }
                  }
                }
              }

              // Sort episodes by season and episode number
              episodes.sort((a, b) => {
                const sA = parseInt(a.seasonFolder.replace(/\D/g, '') || '1', 10);
                const sB = parseInt(b.seasonFolder.replace(/\D/g, '') || '1', 10);
                if (sA !== sB) return sA - sB;
                return a.episodeNumber - b.episodeNumber;
              });

              shows.push({
                id: folder,
                showSlug: folder,
                title: frontmatter.title || folder,
                relativePath: `tv/${folder}/_index.md`,
                frontmatter,
                content,
                contentHtml: marked.parse(content || '') as string,
                episodes,
                updatedAt: stats?.mtimeMs || Date.now(),
              });
            } catch (err) {
              console.error(`[LocalMarkdownProvider] Error reading TV show ${folder}:`, err);
            }
          }

          if (shows.length === 0 && typeof STATIC_TV_FILES === 'object') {
            const showsMap = new Map<string, any>();
            for (const [key, raw] of Object.entries(STATIC_TV_FILES)) {
              const normKey = key.replace(/\\/g, '/');
              const parts = normKey.split('/');
              if (parts[0] !== 'tv' || parts.length < 2) continue;
              const showSlug = parts[1];
              if (!showsMap.has(showSlug)) {
                showsMap.set(showSlug, {
                  id: showSlug,
                  showSlug,
                  title: showSlug,
                  relativePath: `tv/${showSlug}/_index.md`,
                  frontmatter: {},
                  content: '',
                  contentHtml: '',
                  episodes: [],
                  updatedAt: Date.now(),
                });
              }
              const show = showsMap.get(showSlug);
              const lastPart = parts[parts.length - 1];
              if (lastPart === '_index.md' || lastPart === 'index.md') {
                try {
                  const { data, content } = matter(raw);
                  show.frontmatter = data || {};
                  show.title = data?.title || showSlug;
                  show.content = content || '';
                  show.contentHtml = marked.parse(content || '') as string;
                } catch {}
              } else if (/\.(md|markdown)$/i.test(lastPart)) {
                try {
                  const { data, content } = matter(raw);
                  const seasonFolder = parts.length > 3 ? parts[2] : 's1';
                  const epSlug = lastPart.replace(/\.(md|markdown)$/i, '');
                  const epNum = parseInt(epSlug.replace(/\D/g, '') || '1', 10);
                  if (!show.episodes.some((e: any) => e.slug === epSlug && e.seasonFolder === seasonFolder)) {
                    show.episodes.push({
                      id: `${showSlug}-${seasonFolder}-${epSlug}`,
                      showSlug,
                      seasonFolder,
                      episodeNumber: epNum,
                      slug: epSlug,
                      title: data?.title || `Episode ${epNum}`,
                      relativePath: `tv/${showSlug}/${seasonFolder}/${lastPart}`,
                      frontmatter: data || {},
                      content: content || '',
                      contentHtml: marked.parse(content || '') as string,
                      updatedAt: Date.now(),
                    });
                  }
                } catch {}
              }
            }
            shows.push(...Array.from(showsMap.values()));
          }

          return shows;
        } catch (e) {
          console.error('[LocalMarkdownProvider] Error scanning TV shows:', e);
          if (typeof STATIC_TV_FILES === 'object') {
            const showsMap = new Map<string, any>();
            for (const [key, raw] of Object.entries(STATIC_TV_FILES)) {
              const normKey = key.replace(/\\/g, '/');
              const parts = normKey.split('/');
              if (parts[0] !== 'tv' || parts.length < 2) continue;
              const showSlug = parts[1];
              if (!showsMap.has(showSlug)) {
                showsMap.set(showSlug, {
                  id: showSlug,
                  showSlug,
                  title: showSlug,
                  relativePath: `tv/${showSlug}/_index.md`,
                  frontmatter: {},
                  content: '',
                  contentHtml: '',
                  episodes: [],
                  updatedAt: Date.now(),
                });
              }
              const show = showsMap.get(showSlug);
              const lastPart = parts[parts.length - 1];
              if (lastPart === '_index.md' || lastPart === 'index.md') {
                try {
                  const { data, content } = matter(raw);
                  show.frontmatter = data || {};
                  show.title = data?.title || showSlug;
                  show.content = content || '';
                  show.contentHtml = marked.parse(content || '') as string;
                } catch {}
              } else if (/\.(md|markdown)$/i.test(lastPart)) {
                try {
                  const { data, content } = matter(raw);
                  const seasonFolder = parts.length > 3 ? parts[2] : 's1';
                  const epSlug = lastPart.replace(/\.(md|markdown)$/i, '');
                  const epNum = parseInt(epSlug.replace(/\D/g, '') || '1', 10);
                  if (!show.episodes.some((e: any) => e.slug === epSlug && e.seasonFolder === seasonFolder)) {
                    show.episodes.push({
                      id: `${showSlug}-${seasonFolder}-${epSlug}`,
                      showSlug,
                      seasonFolder,
                      episodeNumber: epNum,
                      slug: epSlug,
                      title: data?.title || `Episode ${epNum}`,
                      relativePath: `tv/${showSlug}/${seasonFolder}/${lastPart}`,
                      frontmatter: data || {},
                      content: content || '',
                      contentHtml: marked.parse(content || '') as string,
                      updatedAt: Date.now(),
                    });
                  }
                } catch {}
              }
            }
            return Array.from(showsMap.values());
          }
          return [];
        }
      },
      60_000,
      30_000
    );

    let result = [...allShows];

    if (query?.featured !== undefined) {
      result = result.filter((s) => Boolean(s.frontmatter.featured) === query.featured);
    }

    if (query?.search) {
      const q = query.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.showSlug.toLowerCase().includes(q) ||
          (s.frontmatter.tmdb_id && String(s.frontmatter.tmdb_id).includes(q))
      );
    }

    if (query?.sortBy === 'newest') result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (query?.sortBy === 'oldest') result.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    if (query?.sortBy === 'title_asc') result.sort((a, b) => a.title.localeCompare(b.title));
    if (query?.sortBy === 'title_desc') result.sort((a, b) => b.title.localeCompare(a.title));

    if (query?.limit) {
      const offset = query.offset || 0;
      result = result.slice(offset, offset + query.limit);
    }

    return result;
  }

  async getTVShowBySlug(showSlugOrId: string | number): Promise<TVShowRecord | null> {
    const shows = await this.getTVShows();
    const key = String(showSlugOrId).toLowerCase().trim();

    return (
      shows.find((s) => {
        const idMatch = s.frontmatter.tmdb_id && String(s.frontmatter.tmdb_id) === key;
        const slugMatch = s.showSlug.toLowerCase() === key;
        return idMatch || slugMatch;
      }) || null
    );
  }

  async getAllTVShowSlugs(): Promise<string[]> {
    const shows = await this.getTVShows();
    const slugs = new Set<string>();

    shows.forEach((s) => {
      slugs.add(s.showSlug);
      if (s.frontmatter.tmdb_id) slugs.add(String(s.frontmatter.tmdb_id));
      if (s.frontmatter.title) {
        const tSlug = slugify(s.frontmatter.title);
        if (tSlug) {
          slugs.add(tSlug);
          if (s.frontmatter.tmdb_id) slugs.add(`${tSlug}-${s.frontmatter.tmdb_id}`);
        }
      }
    });

    return Array.from(slugs);
  }

  async getEpisode(showSlug: string, seasonFolder: string, episodeSlug: string): Promise<EpisodeRecord | null> {
    const show = await this.getTVShowBySlug(showSlug);
    if (!show) return null;

    const sClean = seasonFolder.toLowerCase().trim();
    const eClean = episodeSlug.toLowerCase().trim().replace(/\.md$/i, '');

    return (
      show.episodes.find(
        (ep) =>
          (ep.seasonFolder.toLowerCase() === sClean || ep.seasonFolder.replace(/\D/g, '') === sClean.replace(/\D/g, '')) &&
          (ep.slug.toLowerCase() === eClean || String(ep.episodeNumber) === eClean.replace(/\D/g, ''))
      ) || null
    );
  }

  // ──────────────────────────────────────────
  // MUTATIONS (Saves & Deletions)
  // ──────────────────────────────────────────

  async saveMovie(payload: SaveMoviePayload): Promise<MutationResult> {
    this.ensureDirs();
    const cleanSlug = payload.slug || slugify(payload.frontmatter.title || `movie-${payload.frontmatter.tmdb_id}`);
    const filePath = path.join(VIDEO_DIR, `${cleanSlug}.md`);
    const isUpdate = fs.existsSync(filePath);

    const fileContent = serializeTinaMovie(payload.frontmatter, payload.content || '');
    fs.writeFileSync(filePath, fileContent, 'utf8');

    this.invalidateCache();
    return { success: true, relativePath: `video/${cleanSlug}.md`, isUpdate };
  }

  async saveTVShow(payload: SaveTVShowPayload): Promise<MutationResult> {
    this.ensureDirs();
    const showDir = path.join(TV_DIR, payload.showSlug);
    if (!fs.existsSync(showDir)) fs.mkdirSync(showDir, { recursive: true });

    const indexPath = path.join(showDir, '_index.md');
    const isUpdate = fs.existsSync(indexPath);

    const fileContent = serializeTinaTVShow(payload.frontmatter, payload.content || '');
    fs.writeFileSync(indexPath, fileContent, 'utf8');

    this.invalidateCache();
    return { success: true, relativePath: `tv/${payload.showSlug}/_index.md`, isUpdate };
  }

  async saveEpisode(payload: SaveEpisodePayload): Promise<MutationResult> {
    this.ensureDirs();
    const seasonDir = path.join(TV_DIR, payload.showSlug, payload.seasonFolder);
    if (!fs.existsSync(seasonDir)) fs.mkdirSync(seasonDir, { recursive: true });

    const epFile = `e${payload.episodeNumber}.md`;
    const epPath = path.join(seasonDir, epFile);
    const isUpdate = fs.existsSync(epPath);

    const fileContent = serializeTinaTVEpisode(payload.frontmatter, payload.content || '');
    fs.writeFileSync(epPath, fileContent, 'utf8');

    this.invalidateCache();
    return { success: true, relativePath: `tv/${payload.showSlug}/${payload.seasonFolder}/${epFile}`, isUpdate };
  }

  async deleteContent(relativePathOrId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanRel = relativePathOrId.replace(/^\/+/, '');
      const fullPath = path.join(process.cwd(), cleanRel);

      if (fs.existsSync(fullPath)) {
        if (fs.statSync(fullPath).isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      }

      this.invalidateCache();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  invalidateCache(): void {
    memoryCache.invalidate('content_provider_');
    memoryCache.invalidate('featured_');
    memoryCache.invalidate('markdown_');
  }
}
