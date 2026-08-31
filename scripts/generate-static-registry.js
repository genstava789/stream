import fs from 'fs';
import path from 'path';

const VIDEO_DIR = path.resolve('video');
const TV_DIR = path.resolve('tv');
const OUT_FILE = path.resolve('src/lib/staticContentRegistry.ts');

function getMovieFiles() {
  const map = {};
  if (!fs.existsSync(VIDEO_DIR)) return map;

  const files = fs.readdirSync(VIDEO_DIR).filter((f) => /\.(md|markdown)$/i.test(f));
  for (const f of files) {
    const fullPath = path.join(VIDEO_DIR, f);
    const content = fs.readFileSync(fullPath, 'utf8');
    // Store with forward slash as primary, plus backslash alias
    map[`video/${f}`] = content;
    map[`video\\${f}`] = content;
  }
  return map;
}

function getTVFiles() {
  const map = {};
  if (!fs.existsSync(TV_DIR)) return map;

  const shows = fs.readdirSync(TV_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const show of shows) {
    const showDir = path.join(TV_DIR, show.name);
    const entries = fs.readdirSync(showDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const seasonDir = path.join(showDir, entry.name);
        const epFiles = fs.readdirSync(seasonDir).filter((f) => /\.(md|markdown)$/i.test(f));
        for (const ep of epFiles) {
          const content = fs.readFileSync(path.join(seasonDir, ep), 'utf8');
          map[`tv/${show.name}/${entry.name}/${ep}`] = content;
          map[`tv\\${show.name}\\${entry.name}\\${ep}`] = content;
        }
      } else if (/\.(md|markdown)$/i.test(entry.name)) {
        const content = fs.readFileSync(path.join(showDir, entry.name), 'utf8');
        map[`tv/${show.name}/${entry.name}`] = content;
        map[`tv\\${show.name}\\${entry.name}`] = content;
      }
    }
  }
  return map;
}

const movieFiles = getMovieFiles();
const tvFiles = getTVFiles();

const code = `// Auto-generated Embedded Static Registry for Cloudflare Workers & Edge Environments
// Generated on ${new Date().toISOString()}

export const STATIC_MOVIE_FILES: Record<string, string> = ${JSON.stringify(movieFiles, null, 2)};

export const STATIC_TV_FILES: Record<string, string> = ${JSON.stringify(tvFiles, null, 2)};
`;

fs.writeFileSync(OUT_FILE, code, 'utf8');
console.log(`[generate-static-registry]: Successfully generated ${Object.keys(movieFiles).length / 2} movies and ${Object.keys(tvFiles).length / 2} TV files in staticContentRegistry.ts`);
