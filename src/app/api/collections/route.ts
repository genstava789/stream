import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getPublicCollections,
  createCollection,
} from '@/lib/mongodb/collectionService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const filterParam = searchParams.get('filter') || 'latest';
    const filter = ['all', 'popular', 'latest', 'my'].includes(filterParam)
      ? (filterParam as any)
      : 'latest';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)));

    const user = await getAuthenticatedUser(req).catch(() => null);
    if (filter === 'my' && !user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login untuk melihat koleksi Anda' },
        { status: 401 }
      );
    }
    const userId = user?.id;

    const { collections, total } = await getPublicCollections({
      search,
      filter,
      userId,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      collections,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err: any) {
    console.error('[API collections GET] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mengambil data koleksi' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu untuk membuat koleksi' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, description, items, isPublic } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, message: 'Judul koleksi wajib diisi' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Koleksi harus memiliki setidaknya 1 judul film atau series' },
        { status: 400 }
      );
    }

    const created = await createCollection({
      userId: user.id,
      authorName: user.username,
      authorAvatar: user.avatar,
      authorRole: user.role || 'member',
      title: title.trim(),
      description: description ? description.trim() : '',
      items,
      isPublic: isPublic !== false,
    });

    return NextResponse.json({
      success: true,
      collection: created,
      message: `Koleksi "${created.title}" berhasil dibuat!`,
    });
  } catch (err: any) {
    console.error('[API collections POST] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal membuat koleksi baru' },
      { status: 500 }
    );
  }
}
