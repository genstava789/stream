import { NextRequest, NextResponse } from 'next/server';
import siteConfig from '@/config';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  createMediaRequest,
  getMediaRequests,
  findDuplicateRequest,
  findCatalogContent,
} from '@/lib/mongodb/requestService';
import { resolveUserRole } from '@/lib/mongodb/userService';

export const dynamic = 'force-dynamic';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get('tab') as 'latest' | 'popular') || 'latest';
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    const currentUser = await getAuthenticatedUser(req);
    const currentUserId = currentUser?.id;

    const result = await getMediaRequests({
      tab,
      q,
      page,
      limit,
      currentUserId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('[API /api/request GET] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memuat daftar permintaan' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu untuk membuat permintaan film/series' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      mediaType = 'movie',
      title,
      tmdbId,
      year,
      posterUrl,
      backdropUrl,
      genres = [],
      season,
      message,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, message: 'Judul film atau serial TV wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanTitle = title.trim();
    const cleanMediaType: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
    const cleanTmdbId = tmdbId ? Number(tmdbId) : null;
    // 0. Check if this content already exists in Filmesia catalog
    const catalogMatch = await findCatalogContent({
      tmdbId: cleanTmdbId,
      title: cleanTitle,
      mediaType: cleanMediaType,
    });

    if (catalogMatch && catalogMatch.exists) {
      return NextResponse.json(
        {
          success: false,
          alreadyInCatalog: true,
          contentTitle: catalogMatch.title,
          targetUrl: catalogMatch.url,
          mediaType: catalogMatch.mediaType,
          message: `"${catalogMatch.title}" sudah tersedia di database Filmesia! Mengarahkan Anda ke halaman tonton...`,
        },
        { status: 200 }
      );
    }

    // 1. Check for duplicates in requests list first
    const duplicate = await findDuplicateRequest({
      tmdbId: cleanTmdbId,
      title: cleanTitle,
      mediaType: cleanMediaType,
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          isDuplicate: true,
          existingRequest: duplicate,
          message: `"${cleanTitle}" sudah pernah direquest sebelumnya! Silakan berikan Vote pada permintaan yang ada agar lebih cepat diproses.`,
        },
        { status: 409 }
      );
    }

    // 2. Save new request to MongoDB
    const userRole = resolveUserRole(user);
    const createdRequest = await createMediaRequest({
      userId: user.id,
      authorName: user.username,
      authorAvatar: user.avatar,
      authorRole: userRole,
      mediaType: cleanMediaType,
      tmdbId: cleanTmdbId,
      title: cleanTitle,
      year: year || null,
      posterUrl: posterUrl || null,
      backdropUrl: backdropUrl || null,
      genres: Array.isArray(genres) ? genres : [],
      season: season ? String(season) : undefined,
      message: message ? String(message).trim() : undefined,
    });

    // 3. Asynchronously trigger Telegram notification if configured
    (async () => {
      try {
        const botToken =
          process.env.TELEGRAM_BOT_TOKEN ||
          siteConfig.telegram?.botToken ||
          '6673058749:AAH0X2vdpEgWNxeDhsZJy77_pXIG-_YCpRU';
        const chatId =
          process.env.TELEGRAM_CHAT_ID ||
          siteConfig.telegram?.chatId ||
          '';

        if (!botToken || !chatId) return;

        const now = new Date();
        const timeFormatted = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(now);

        const formattedGenres =
          Array.isArray(genres) && genres.length > 0 ? genres.join(', ') : 'N/A';
        const tmdbLink = cleanTmdbId
          ? `<a href="https://www.themoviedb.org/${cleanMediaType}/${cleanTmdbId}">TMDB #${cleanTmdbId}</a>`
          : '<i>Manual Entry</i>';

        const messageLines = [
          `🎬 <b>PERMINTAAN KONTEN BARU (${siteConfig.name})</b>`,
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
          `📌 <b>Judul:</b> <b>${escapeHtml(cleanTitle)}</b> ${year ? `(${escapeHtml(String(year))})` : ''}`,
          `📺 <b>Tipe:</b> ${cleanMediaType === 'tv' ? '📺 TV Series / Drama' : '🎬 Movie / Film'}`,
          `🆔 <b>TMDB ID:</b> ${tmdbLink}`,
          `🎭 <b>Genre:</b> ${escapeHtml(formattedGenres)}`,
          season ? `📦 <b>Musim / Episode:</b> ${escapeHtml(String(season))}` : null,
          `👤 <b>Pengirim:</b> @${escapeHtml(user.username)} (${userRole.toUpperCase()})`,
          ``,
          `📝 <b>Pesan / Catatan:</b>`,
          `<i>${escapeHtml(message ? String(message).trim() : 'Tidak ada catatan tambahan.')}</i>`,
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⏰ <i>${escapeHtml(timeFormatted)} WIB</i>`,
        ].filter(Boolean) as string[];

        const messageText = messageLines.join('\n');

        let photoSent = false;
        if (
          posterUrl &&
          typeof posterUrl === 'string' &&
          (posterUrl.startsWith('http://') || posterUrl.startsWith('https://'))
        ) {
          try {
            const photoRes = await fetch(
              `https://api.telegram.org/bot${botToken}/sendPhoto`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: String(chatId),
                  photo: posterUrl,
                  caption:
                    messageText.length > 1024
                      ? messageText.slice(0, 1020) + '...'
                      : messageText,
                  parse_mode: 'HTML',
                }),
              }
            );
            const photoData = await photoRes.json();
            if (photoData.ok) photoSent = true;
          } catch (photoErr) {
            console.warn('[Telegram photo error, falling back to text]:', photoErr);
          }
        }

        if (!photoSent) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: String(chatId),
              text: messageText,
              parse_mode: 'HTML',
              disable_web_page_preview: false,
            }),
          });
        }
      } catch (tgErr) {
        console.warn('[Telegram notification error]:', tgErr);
      }
    })();

    return NextResponse.json({
      success: true,
      request: createdRequest,
      message: 'Permintaan berhasil dikirim dan ditambahkan ke daftar request!',
    });
  } catch (err: any) {
    console.error('[API /api/request POST] error:', err);
    if (err.isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          isDuplicate: true,
          existingRequest: err.existingRequest,
          message: err.message,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mengirim permintaan' },
      { status: 500 }
    );
  }
}
