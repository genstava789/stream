import { NextRequest, NextResponse } from 'next/server';

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
  cuesByTrack: Map<number, string[]>;
  isComplete: boolean;
}

// In-memory cache stored in RAM across requests
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

  // Ensure default track (Indonesian preferred) is first
  formatted.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  return formatted;
}

/**
 * Universal fast header reader: reads first 5MB using HTTP Range
 * to detect MKV subtitle tracks in <300ms without downloading the full video.
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
    const timeoutId = setTimeout(() => abortController.abort(), 4000);

    const rangeRes = await fetch(videoUrl, {
      headers: { Range: 'bytes=0-5242880' },
      cache: 'no-store',
      signal: abortController.signal,
    }).catch(() => null);

    if (rangeRes && (rangeRes.status === 200 || rangeRes.status === 206) && rangeRes.body) {
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
        new Promise<TrackMeta[]>((res) => setTimeout(() => res([]), 3500)),
      ]);

      clearTimeout(timeoutId);
      reader.cancel().catch(() => {});

      if (tracks.length > 0) {
        if (!inMemoryCache.has(videoUrl)) {
          inMemoryCache.set(videoUrl, {
            tracks,
            cuesByTrack: new Map(),
            isComplete: false,
          });
        } else {
          inMemoryCache.get(videoUrl)!.tracks = tracks;
        }
        return tracks;
      }
    }
  } catch (e) {
    console.warn('[subtitles] Track scan error:', e);
  }

  return [];
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

  // 1. If metadata (tracks) is requested: read header dynamically via HTTP Range
  if (infoRequested) {
    const tracks = await getTracksHeader(videoUrl);
    return NextResponse.json({ tracks });
  }

  // 2. If subtitle VTT cues are requested:
  // Check if complete in-memory cache exists
  const cacheEntry = inMemoryCache.get(videoUrl);
  if (cacheEntry && cacheEntry.isComplete) {
    const cues = requestedTrack !== null
      ? cacheEntry.cuesByTrack.get(requestedTrack) || []
      : Array.from(cacheEntry.cuesByTrack.values())[0] || [];

    const fullVtt = 'WEBVTT\n\n' + cues.join('\n\n') + '\n';
    return new NextResponse(fullVtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 3. Dynamic Real-Time Streaming of WebVTT cues from MKV container
  // Respond immediately with WEBVTT header and stream cues as they are decoded
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send WEBVTT header instantly within <50ms
      controller.enqueue(encoder.encode('WEBVTT\n\n'));

      let isClosed = false;
      const abortController = new AbortController();

      try {
        const { SubtitleParser } = await import('matroska-subtitles');
        const parser = new SubtitleParser();

        let resolvedTrackNumber = requestedTrack;
        let cueIndex = 1;

        if (!inMemoryCache.has(videoUrl)) {
          inMemoryCache.set(videoUrl, {
            tracks: [],
            cuesByTrack: new Map(),
            isComplete: false,
          });
        }
        const currentCache = inMemoryCache.get(videoUrl)!;

        // Determine target track from metadata if track number not specified
        parser.once('tracks', (parsedTracks: any[]) => {
          if (!currentCache.tracks || currentCache.tracks.length === 0) {
            currentCache.tracks = parseTracksFromMetadata(parsedTracks);
          }
          if (resolvedTrackNumber === null) {
            const match = currentCache.tracks.find(
              (t) => t.language === lang || (lang === 'id' && t.isDefault)
            );
            resolvedTrackNumber = match ? match.trackNumber : parsedTracks[0]?.number;
          }
        });

        // Whenever a subtitle cue is decoded from the container, stream it immediately
        parser.on('subtitle', (sub: any, trackNumber: number) => {
          if (isClosed) return;

          const cleanText = (sub.text || '')
            .replace(/\{[^}]+\}/g, '')
            .replace(/\\N/g, '\n')
            .replace(/\\n/g, '\n')
            .trim();

          if (!cleanText) return;

          const startStr = formatVttTime(sub.time);
          const endStr = formatVttTime(sub.time + (sub.duration || 3000));
          const cueText = `${startStr} --> ${endStr}\n${cleanText}`;

          // Save cue into in-memory cache for this track
          if (!currentCache.cuesByTrack.has(trackNumber)) {
            currentCache.cuesByTrack.set(trackNumber, []);
          }
          currentCache.cuesByTrack.get(trackNumber)!.push(`${cueIndex}\n${cueText}`);

          // If this cue is for the requested track, stream it directly to browser
          if (resolvedTrackNumber === null || trackNumber === resolvedTrackNumber) {
            try {
              controller.enqueue(encoder.encode(`${cueIndex}\n${cueText}\n\n`));
              cueIndex++;
            } catch (e) {
              isClosed = true;
              abortController.abort();
            }
          }
        });

        // Start fetching video stream with no-store to prevent Next.js memory buffering
        const videoRes = await fetch(videoUrl, {
          cache: 'no-store',
          signal: abortController.signal,
        }).catch(() => null);

        if (videoRes && videoRes.ok && videoRes.body) {
          const reader = videoRes.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done || isClosed) break;
              if (value) {
                parser.write(Buffer.from(value));
              }
            }
          } finally {
            reader.cancel().catch(() => {});
          }
        }

        currentCache.isComplete = true;
      } catch (err) {
        console.warn('[subtitles] Stream parsing error:', err);
      } finally {
        if (!isClosed) {
          try {
            controller.close();
          } catch (e) {}
        }
      }
    },
    cancel() {
      // Browser disconnected / switched tracks
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
