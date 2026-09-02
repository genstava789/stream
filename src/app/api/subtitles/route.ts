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

// Pure in-memory cache on the server (RAM only, no files on disk)
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');
  const infoRequested = searchParams.get('info') === 'true';
  const requestedTrack = searchParams.get('track') ? parseInt(searchParams.get('track')!, 10) : null;
  const lang = (searchParams.get('lang') || 'id').toLowerCase();

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // 1. Check Bleach embedded in-memory subtitle
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

    return new NextResponse(BLEACH_INDONESIAN_VTT, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // 2. Check general in-memory cache
  let cached = inMemoryCache.get(videoUrl);

  if (!cached) {
    try {
      const { SubtitleParser } = await import('matroska-subtitles');
      const parser = new SubtitleParser();
      const tracks: TrackMeta[] = [];
      const cuesByTrack = new Map<number, Array<{ start: number; end: number; text: string }>>();

      parser.once('tracks', (parsedTracks: any[]) => {
        let order = 1;
        parsedTracks.forEach((t) => {
          const tLang = (t.language || 'und').toLowerCase();
          const isId = tLang === 'ind' || tLang === 'id' || (t.name || '').toLowerCase().includes('indo');
          const isDefault = isId || order === 1;

          tracks.push({
            trackNumber: t.number,
            language: isId ? 'id' : tLang,
            label: t.name || (isId ? 'Bahasa Indonesia' : `Subtitle ${order}`),
            isDefault,
            order,
          });
          cuesByTrack.set(t.number, []);
          order++;
        });

        // Ensure default track is ordered first if Indonesian is available
        tracks.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
      });

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

      const res = await fetch(videoUrl);
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) parser.write(value);
        }
      }

      const vttByTrack = new Map<number, string>();
      cuesByTrack.forEach((cues, tNum) => {
        let vtt = 'WEBVTT\n\n';
        cues.forEach((c, idx) => {
          vtt += `${idx + 1}\n${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n\n`;
        });
        vttByTrack.set(tNum, vtt);
      });

      cached = { tracks, vttByTrack };
      inMemoryCache.set(videoUrl, cached);
    } catch (err) {
      console.error('In-memory subtitle extraction error:', err);
      cached = { tracks: [], vttByTrack: new Map() };
    }
  }

  if (infoRequested) {
    return NextResponse.json({ tracks: cached.tracks });
  }

  // Find target track: by number, by lang, or default
  let targetTrackNumber = requestedTrack;
  if (targetTrackNumber === null) {
    const matched = cached.tracks.find((t) => t.language === lang || (lang === 'id' && t.isDefault));
    targetTrackNumber = matched ? matched.trackNumber : (cached.tracks[0]?.trackNumber || 1);
  }

  const vtt = cached.vttByTrack.get(targetTrackNumber) || 'WEBVTT\n\n';

  return new NextResponse(vtt, {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
