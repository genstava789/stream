import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getUserHistory,
  addUserHistory,
  removeUserHistory,
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

    const history = await getUserHistory(user.id);
    return NextResponse.json({ success: true, history });
  } catch (err: any) {
    console.error('[API user/history GET] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mengambil riwayat' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    // If not logged in, silently ignore recording to database as requested
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User tidak login, riwayat tidak disimpan' },
        { status: 200 }
      );
    }

    const body = await req.json();
    const { contentId, type, title, episodeTitle, posterPath, backdropPath, rating, urlPath } = body;

    if (!contentId || !title) {
      return NextResponse.json(
        { success: false, message: 'Parameter contentId dan title wajib diisi' },
        { status: 400 }
      );
    }

    const history = await addUserHistory(user.id, {
      contentId,
      type: type === 'tv' ? 'tv' : 'movie',
      title,
      episodeTitle,
      posterPath,
      backdropPath,
      rating: Number(rating) || 0,
      urlPath,
    });

    return NextResponse.json({
      success: true,
      history,
      message: 'Riwayat berhasil dicatat',
    });
  } catch (err: any) {
    console.error('[API user/history POST] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mencatat riwayat' },
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

    const history = await removeUserHistory(user.id, contentId || undefined);
    return NextResponse.json({
      success: true,
      history,
      message: contentId ? 'Item riwayat berhasil dihapus' : 'Seluruh riwayat berhasil dibersihkan',
    });
  } catch (err: any) {
    console.error('[API user/history DELETE] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal menghapus riwayat' },
      { status: 500 }
    );
  }
}
