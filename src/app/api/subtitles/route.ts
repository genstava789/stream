import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { BLEACH_INDONESIAN_VTT } from './embeddedVtt';

export const dynamic = 'force-dynamic';

interface TrackMeta {
  trackNumber: number;
  language: string;
  label: string;
  isDefault: boolean;
  order: number;
}

interface VideoSubtitleCache {
  tracks: TrackMeta[];
  vttByTrack: Map<number, string>;
}

// Pure in-memory cache on the server (RAM only)
const inMemoryCache = new Map<string, VideoSubtitleCache>();

function formatVttTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = Math.floor(ms % 1000);
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    ':' +
    String(s).padStart(2, '0') +
    '.' +
    String(msRem).padStart(3, '0')
  );
}

function readLocalSubtitle(filename: string): string | null {
  try {
    const fullPath = path.join(process.cwd(), 'public', 'subtitles', filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  } catch (e) {}
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');
  const infoRequested = searchParams.get('info') === 'true';
  const requestedTrack = searchParams.get('track') ? parseInt(searchParams.get('track')!, 10) : null;
  const lang = (searchParams.get('lang') || 'id').toLowerCase();

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // ── 1. Fast-Path for BLEACH ──
  if (videoUrl.includes('BLEACH.Thousand.Year.Blood.War')) {
    const bleachTracks: TrackMeta[] = [
      {
        trackNumber: 4,
        language: 'id',
        label: 'Bahasa Indonesia',
        isDefault: true,
        order: 1,
      },
      {
        trackNumber: 3,
        language: 'en',
        label: 'English',
        isDefault: false,
        order: 2,
      },
    ];

    if (infoRequested) {
      return NextResponse.json({ tracks: bleachTracks });
    }

    let vtt = BLEACH_INDONESIAN_VTT;
    if (requestedTrack === 3 || lang === 'en' || lang === 'eng') {
      const enVtt = readLocalSubtitle('bleach_en.vtt');
      if (enVtt) vtt = enVtt;
    } else {
      const idVtt = readLocalSubtitle('bleach_id.vtt');
      if (idVtt) vtt = idVtt;
    }

    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // ── 2. Fast-Path for TOY STORY 5 ──
  if (videoUrl.toLowerCase().includes('toy.story.5') || videoUrl.toLowerCase().includes('toy-story-5') || videoUrl.toLowerCase().includes('toy_story_5')) {
    const toyStoryTracks: TrackMeta[] = [
      {
        trackNumber: 3,
        language: 'id',
        label: 'Bahasa Indonesia',
        isDefault: true,
        order: 1,
      },
      {
        trackNumber: 4,
        language: 'en',
        label: 'English',
        isDefault: false,
        order: 2,
      },
    ];

    if (infoRequested) {
      return NextResponse.json({ tracks: toyStoryTracks });
    }

    let vtt = 'WEBVTT\n\n';
    if (requestedTrack === 4 || lang === 'en' || lang === 'eng') {
      vtt = readLocalSubtitle('toystory5_en.vtt') || vtt;
    } else {
      vtt = readLocalSubtitle('toystory5_id.vtt') || vtt;
    }

    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // ── 3. Fast-Path for TRANSFORMERS ──
  if (videoUrl.toLowerCase().includes('transformers')) {
    const transformersTracks: TrackMeta[] = [
      {
        trackNumber: 16,
        language: 'id',
        label: 'Bahasa Indonesia',
        isDefault: true,
        order: 1,
      },
      {
        trackNumber: 15,
        language: 'en',
        label: 'English',
        isDefault: false,
        order: 2,
      },
    ];

    if (infoRequested) {
      return NextResponse.json({ tracks: transformersTracks });
    }

    let vtt = 'WEBVTT\n\n';
    if (requestedTrack === 15 || lang === 'en' || lang === 'eng') {
      vtt = readLocalSubtitle('transformers_en.vtt') || vtt;
    } else {
      vtt = readLocalSubtitle('transformers_id.vtt') || vtt;
    }

    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // ── 4. General MKV / Matroska Subtitle Extraction with Range Request ──
  let cached = inMemoryCache.get(videoUrl);

  // When info is requested and not cached, use fast HTTP range request (first 10MB)
  if (!cached && infoRequested) {
    try {
      const { SubtitleParser } = await import('matroska-subtitles');
      const parser = new SubtitleParser();
      let detectedTracks: TrackMeta[] = [];

      const tracksPromise = new Promise<TrackMeta[]>((resolve) => {
        parser.once('tracks', (parsedTracks: any[]) => {
          let order = 1;
          const formatted: TrackMeta[] = [];
          parsedTracks.forEach((t) => {
            const rawLang = (t.language || '').toLowerCase();
            const rawName = (t.name || '').toLowerCase();
            const isId = rawLang === 'ind' || rawLang === 'id' || rawName.includes('indo');
            const isEn = rawLang === 'eng' || rawLang === 'en' || rawName.includes('eng') || !rawLang;

            const langCode = isId ? 'id' : isEn ? 'en' : (rawLang || 'en');
            const label = t.name || (isId ? 'Bahasa Indonesia' : isEn ? 'English' : `Subtitle ${order}`);
            const isDefault = isId || order === 1;

            formatted.push({
              trackNumber: t.number,
              language: langCode,
              label,
              isDefault,
              order,
            });
            order++;
          });

          // Default track first (Indonesian preferred)
          formatted.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
          resolve(formatted);
        });
      });

      const rangeRes = await fetch(videoUrl, {
        headers: {
          Range: 'bytes=0-10485760', // First 10MB contains MKV EBML Tracks Header
        },
      });

      if (rangeRes.ok && rangeRes.body) {
        const reader = rangeRes.body.getReader();
        const timeoutId = setTimeout(() => {
          reader.cancel().catch(() => {});
        }, 3500);

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) parser.write(Buffer.from(value));
            }
          } catch (e) {}
        })();

        detectedTracks = await Promise.race([
          tracksPromise,
          new Promise<TrackMeta[]>((res) => setTimeout(() => res([]), 3500)),
        ]);
        clearTimeout(timeoutId);
        reader.cancel().catch(() => {});
      }

      if (detectedTracks.length > 0) {
        cached = { tracks: detectedTracks, vttByTrack: new Map() };
        inMemoryCache.set(videoUrl, cached);
      }
    } catch (e) {
      console.warn('Range subtitle track extraction failed:', e);
    }
  }

  // If full VTT requested and not in cache, extract
  if (!cached || (!infoRequested && requestedTrack !== null && !cached.vttByTrack.has(requestedTrack))) {
    try {
      const { SubtitleParser } = await import('matroska-subtitles');
      const parser = new SubtitleParser();
      const tracks: TrackMeta[] = cached?.tracks || [];
      const cuesByTrack = cached?.vttByTrack ? new Map(cached.vttByTrack) : new Map<number, string>();
      const rawCues = new Map<number, Array<{ start: number; end: number; text: string }>>();

      if (tracks.length === 0) {
        parser.once('tracks', (parsedTracks: any[]) => {
          let order = 1;
          parsedTracks.forEach((t) => {
            const rawLang = (t.language || '').toLowerCase();
            const rawName = (t.name || '').toLowerCase();
            const isId = rawLang === 'ind' || rawLang === 'id' || rawName.includes('indo');
            const isEn = rawLang === 'eng' || rawLang === 'en' || rawName.includes('eng') || !rawLang;

            const langCode = isId ? 'id' : isEn ? 'en' : (rawLang || 'en');
            const label = t.name || (isId ? 'Bahasa Indonesia' : isEn ? 'English' : `Subtitle ${order}`);
            const isDefault = isId || order === 1;

            tracks.push({
              trackNumber: t.number,
              language: langCode,
              label,
              isDefault,
              order,
            });
            rawCues.set(t.number, []);
            order++;
          });
          tracks.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        });
      }

      parser.on('subtitle', (sub: any, trackNumber: number) => {
        if (!rawCues.has(trackNumber)) rawCues.set(trackNumber, []);
        const cleanText = (sub.text || '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/\\N/g, '\n')
          .replace(/\\n/g, '\n')
          .trim();
        if (cleanText) {
          rawCues.get(trackNumber)!.push({
            start: sub.time,
            end: sub.time + (sub.duration || 3000),
            text: cleanText,
          });
        }
      });

      const res = await fetch(videoUrl);
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const start = Date.now();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) parser.write(Buffer.from(value));
          // Guard against runaway serverless execution
          if (Date.now() - start > 20000) {
            reader.cancel().catch(() => {});
            break;
          }
        }
      }

      rawCues.forEach((cues, tNum) => {
        let vtt = 'WEBVTT\n\n';
        cues.forEach((c, idx) => {
          vtt += `${idx + 1}\n${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n\n`;
        });
        cuesByTrack.set(tNum, vtt);
      });

      cached = { tracks, vttByTrack: cuesByTrack };
      inMemoryCache.set(videoUrl, cached);
    } catch (err) {
      console.error('In-memory subtitle extraction error:', err);
      if (!cached) {
        cached = { tracks: [], vttByTrack: new Map() };
      }
    }
  }

  if (infoRequested) {
    return NextResponse.json({ tracks: cached?.tracks || [] });
  }

  // Find target track: by number, by lang, or default
  let targetTrackNumber = requestedTrack;
  if (targetTrackNumber === null && cached?.tracks) {
    const matched = cached.tracks.find((t) => t.language === lang || (lang === 'id' && t.isDefault));
    targetTrackNumber = matched ? matched.trackNumber : (cached.tracks[0]?.trackNumber || 1);
  }

  const vtt = (targetTrackNumber !== null ? cached?.vttByTrack.get(targetTrackNumber) : null) || 'WEBVTT\n\n';

  return new NextResponse(vtt, {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
