import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getUserWatchlist,
  toggleUserWatchlist,
  removeUserWatchlist,
} from '@/lib/mongodb/userService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu' },
        { status: 401 }
      );
    }

    const watchlist = await getUserWatchlist(user.id);
    return NextResponse.json({ success: true, watchlist });
  } catch (err: any) {
    console.error('[API user/watchlist GET] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mengambil watchlist' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu untuk menyimpan ke Watchlist' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { contentId, type, title, posterPath, backdropPath, rating, releaseDate, urlPath } = body;

    if (!contentId || !title) {
      return NextResponse.json(
        { success: false, message: 'Parameter contentId dan title wajib diisi' },
        { status: 400 }
      );
    }

    const result = await toggleUserWatchlist(user.id, {
      contentId,
      type: type === 'tv' ? 'tv' : 'movie',
      title,
      posterPath,
      backdropPath,
      rating: Number(rating) || 0,
      releaseDate,
      urlPath,
    });

    return NextResponse.json({
      success: true,
      added: result.added,
      watchlist: result.watchlist,
      message: result.added
        ? `"${title}" berhasil ditambahkan ke Watchlist`
        : `"${title}" dihapus dari Watchlist`,
    });
  } catch (err: any) {
    console.error('[API user/watchlist POST] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memperbarui watchlist' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const contentId = searchParams.get('contentId');

    if (!contentId) {
      return NextResponse.json(
        { success: false, message: 'Parameter contentId wajib diisi' },
        { status: 400 }
      );
    }

    const watchlist = await removeUserWatchlist(user.id, contentId);
    return NextResponse.json({
      success: true,
      watchlist,
      message: 'Item berhasil dihapus dari Watchlist',
    });
  } catch (err: any) {
    console.error('[API user/watchlist DELETE] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal menghapus dari watchlist' },
      { status: 500 }
    );
  }
}
