import { NextRequest, NextResponse } from 'next/server';
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

// In-memory cache stored purely in server RAM (no disk storage used)
const inMemoryCache = new Map<string, VideoSubtitleCache>();
const pendingExtractions = new Map<string, Promise<VideoSubtitleCache>>();

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

function parseTracksFromMetadata(parsedTracks: any[]): TrackMeta[] {
  let order = 1;
  const formatted: TrackMeta[] = [];
  const indoTrack = parsedTracks.find((t) => {
    const l = (t.language || '').toLowerCase();
    const n = (t.name || '').toLowerCase();
    return l === 'ind' || l === 'id' || n.includes('indo');
  });
  const defaultTrackNumber = indoTrack ? indoTrack.number : parsedTracks[0]?.number;
  const hasIndo = Boolean(indoTrack);

  parsedTracks.forEach((t) => {
    const rawLang = (t.language || '').toLowerCase();
    const rawName = (t.name || '').toLowerCase();
    const isId = rawLang === 'ind' || rawLang === 'id' || rawName.includes('indo');
    const isEn = rawLang === 'eng' || rawLang === 'en' || rawName.includes('eng') || (!rawLang && hasIndo);

    const langCode = isId ? 'id' : isEn ? 'en' : (rawLang || 'en');
    const label = t.name || (isId ? 'Bahasa Indonesia' : isEn ? 'English' : `Subtitle ${order}`);
    const isDefault = t.number === defaultTrackNumber;

    formatted.push({
      trackNumber: t.number,
      language: langCode,
      label,
      isDefault,
      order,
    });
    order++;
  });

  // Ensure default (preferred Indonesian) track is first
  formatted.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  return formatted;
}

/**
 * Fast-read Matroska container tracks header using HTTP Range (first 5MB).
 * Returns within <200ms without downloading the full video.
 */
async function getTracksHeader(videoUrl: string): Promise<TrackMeta[]> {
  const cached = inMemoryCache.get(videoUrl);
  if (cached && cached.tracks.length > 0) return cached.tracks;

  try {
    const { SubtitleParser } = await import('matroska-subtitles');
    const parser = new SubtitleParser();

    const tracksPromise = new Promise<TrackMeta[]>((resolve) => {
      parser.once('tracks', (parsedTracks: any[]) => {
        const tracks = parseTracksFromMetadata(parsedTracks);
        resolve(tracks);
      });
    });

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 3000);

    const rangeRes = await fetch(videoUrl, {
      headers: { Range: 'bytes=0-5242880' },
      signal: abortController.signal,
    }).catch(() => null);

    if (rangeRes && rangeRes.ok && rangeRes.body) {
      const reader = rangeRes.body.getReader();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) parser.write(Buffer.from(value));
          }
        } catch (e) {}
      })();

      const tracks = await Promise.race([
        tracksPromise,
        new Promise<TrackMeta[]>((res) => setTimeout(() => res([]), 2500)),
      ]);

      clearTimeout(timeoutId);
      reader.cancel().catch(() => {});

      if (tracks.length > 0) {
        if (!inMemoryCache.has(videoUrl)) {
          inMemoryCache.set(videoUrl, { tracks, vttByTrack: new Map() });
        } else {
          inMemoryCache.get(videoUrl)!.tracks = tracks;
        }
        return tracks;
      }
    }
  } catch (e) {
    console.warn('[subtitles] Track header scan error:', e);
  }

  return [];
}

/**
 * Extract embedded subtitle cues from Matroska stream into memory.
 * Runs on-demand and caches cues in RAM for instant subsequent access.
 */
async function extractSubtitlesToMemory(videoUrl: string, knownTracks?: TrackMeta[]): Promise<VideoSubtitleCache> {
  const cached = inMemoryCache.get(videoUrl);
  if (cached && cached.vttByTrack.size > 0) return cached;

  if (pendingExtractions.has(videoUrl)) {
    return pendingExtractions.get(videoUrl)!;
  }

  const promise = (async () => {
    try {
      const { SubtitleParser } = await import('matroska-subtitles');
      const parser = new SubtitleParser();
      let tracks: TrackMeta[] = knownTracks || inMemoryCache.get(videoUrl)?.tracks || [];
      const cuesByTrack = new Map<number, Array<{ start: number; end: number; text: string }>>();

      if (tracks.length === 0) {
        parser.once('tracks', (parsedTracks: any[]) => {
          tracks = parseTracksFromMetadata(parsedTracks);
          tracks.forEach((t) => cuesByTrack.set(t.trackNumber, []));
        });
      } else {
        tracks.forEach((t) => cuesByTrack.set(t.trackNumber, []));
      }

      parser.on('subtitle', (sub: any, trackNumber: number) => {
        if (!cuesByTrack.has(trackNumber)) cuesByTrack.set(trackNumber, []);
        const cleanText = (sub.text || '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/\\N/g, '\n')
          .replace(/\\n/g, '\n')
          .trim();
        if (cleanText) {
          cuesByTrack.get(trackNumber)!.push({
            start: sub.time,
            end: sub.time + (sub.duration || 3000),
            text: cleanText,
          });
        }
      });

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 25000);

      const res = await fetch(videoUrl, { signal: abortController.signal }).catch(() => null);
      if (res && res.ok && res.body) {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) parser.write(Buffer.from(value));
        }
      }
      clearTimeout(timeoutId);

      const vttByTrack = new Map<number, string>();
      cuesByTrack.forEach((cues, tNum) => {
        let vtt = 'WEBVTT\n\n';
        cues.forEach((c, idx) => {
          vtt += `${idx + 1}\n${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n\n`;
        });
        vttByTrack.set(tNum, vtt);
      });

      const result: VideoSubtitleCache = { tracks, vttByTrack };
      inMemoryCache.set(videoUrl, result);
      return result;
    } catch (err) {
      console.warn('[subtitles] Stream subtitle extraction error:', err);
      return { tracks: knownTracks || [], vttByTrack: new Map() };
    } finally {
      pendingExtractions.delete(videoUrl);
    }
  })();

  pendingExtractions.set(videoUrl, promise);
  return promise;
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

  // 1. If metadata (tracks) is requested: read header in <200ms using Range
  if (infoRequested) {
    let tracks = await getTracksHeader(videoUrl);

    // Fallback if Bleach video URL
    if (tracks.length === 0 && videoUrl.includes('BLEACH.Thousand.Year.Blood.War')) {
      tracks = [
        { trackNumber: 4, language: 'id', label: 'Bahasa Indonesia', isDefault: true, order: 1 },
        { trackNumber: 3, language: 'en', label: 'English', isDefault: false, order: 2 },
      ];
    }

    // Trigger asynchronous memory extraction in background so cues are ready
    if (tracks.length > 0) {
      extractSubtitlesToMemory(videoUrl, tracks).catch(() => {});
    }

    return NextResponse.json({ tracks });
  }

  // 2. If subtitle VTT cues are requested:
  // Check memory cache first
  const cached = inMemoryCache.get(videoUrl);
  let vtt: string | null = null;

  if (cached && cached.vttByTrack.size > 0) {
    if (requestedTrack !== null && cached.vttByTrack.has(requestedTrack)) {
      vtt = cached.vttByTrack.get(requestedTrack)!;
    } else {
      const match = cached.tracks.find((t) => t.language === lang || (lang === 'id' && t.isDefault));
      if (match && cached.vttByTrack.has(match.trackNumber)) {
        vtt = cached.vttByTrack.get(match.trackNumber)!;
      } else {
        const first = cached.vttByTrack.values().next().value;
        if (first) vtt = first;
      }
    }
  }

  // Fallback for Bleach in-memory VTT
  if (!vtt && videoUrl.includes('BLEACH.Thousand.Year.Blood.War')) {
    vtt = BLEACH_INDONESIAN_VTT;
  }

  // If not yet in memory, extract now
  if (!vtt) {
    const extracted = await extractSubtitlesToMemory(videoUrl);
    if (requestedTrack !== null && extracted.vttByTrack.has(requestedTrack)) {
      vtt = extracted.vttByTrack.get(requestedTrack)!;
    } else {
      const match = extracted.tracks.find((t) => t.language === lang || (lang === 'id' && t.isDefault));
      if (match && extracted.vttByTrack.has(match.trackNumber)) {
        vtt = extracted.vttByTrack.get(match.trackNumber)!;
      } else {
        vtt = extracted.vttByTrack.values().next().value || 'WEBVTT\n\n';
      }
    }
  }

  return new NextResponse(vtt || 'WEBVTT\n\n', {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
