import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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
  const lang = (searchParams.get('lang') || 'id').toLowerCase();

  if (!videoUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  const subtitlesDir = path.join(process.cwd(), 'public', 'subtitles');
  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir, { recursive: true });
  }

  // 1. Check known video mappings
  if (videoUrl.includes('BLEACH.Thousand.Year.Blood.War')) {
    const filePath = path.join(subtitlesDir, `bleach-e45-${lang === 'id' || lang === 'ind' ? 'ind' : lang}.vtt`);
    if (fs.existsSync(filePath)) {
      const vtt = fs.readFileSync(filePath, 'utf8');
      return new NextResponse(vtt, {
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  // 2. Check hashed cache
  const hash = crypto.createHash('md5').update(`${videoUrl}_${lang}`).digest('hex');
  const cacheFile = path.join(subtitlesDir, `${hash}.vtt`);

  if (fs.existsSync(cacheFile)) {
    const vtt = fs.readFileSync(cacheFile, 'utf8');
    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  // 3. Dynamic server-side extraction for any other MKV video
  try {
    const { SubtitleParser } = await import('matroska-subtitles');
    const parser = new SubtitleParser();
    const cues: Array<{ start: number; end: number; text: string }> = [];
    let targetTrackNumber: number | null = null;

    parser.once('tracks', (tracks: any[]) => {
      const matchingTrack = tracks.find((t: any) => {
        const tLang = (t.language || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        if (lang === 'id' || lang === 'ind') {
          return tLang === 'ind' || tLang === 'id' || tName.includes('indo');
        }
        return tLang === lang || tName.includes(lang);
      }) || tracks[0];

      if (matchingTrack) {
        targetTrackNumber = matchingTrack.number;
      }
    });

    parser.on('subtitle', (sub: any, trackNumber: number) => {
      if (targetTrackNumber === null || trackNumber === targetTrackNumber) {
        const cleanText = (sub.text || '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/\\N/g, '\n')
          .replace(/\\n/g, '\n')
          .trim();
        if (cleanText) {
          cues.push({
            start: sub.time,
            end: sub.time + (sub.duration || 3000),
            text: cleanText,
          });
        }
      }
    });

    const res = await fetch(videoUrl);
    if (!res.ok && res.status !== 206) {
      return new NextResponse('WEBVTT\n\n', {
        headers: { 'Content-Type': 'text/vtt; charset=utf-8' },
      });
    }

    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) parser.write(value);
      }
    }

    let vtt = 'WEBVTT\n\n';
    cues.forEach((c, idx) => {
      vtt += `${idx + 1}\n${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}\n\n`;
    });

    fs.writeFileSync(cacheFile, vtt, 'utf8');

    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Dynamic subtitle extraction error:', err);
    return new NextResponse('WEBVTT\n\n', {
      headers: { 'Content-Type': 'text/vtt; charset=utf-8' },
    });
  }
}
