import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getCollectionByIdOrSlug,
  updateCollection,
  deleteCollection,
} from '@/lib/mongodb/collectionService';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID atau Slug koleksi tidak valid' },
        { status: 400 }
      );
    }

    const collection = await getCollectionByIdOrSlug(id);
    if (!collection) {
      return NextResponse.json(
        { success: false, message: 'Koleksi tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      collection,
    });
  } catch (err: any) {
    console.error('[API collections/[id] GET] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memuat detail koleksi' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login untuk mengedit koleksi' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { title, description, items, isPublic } = body;

    const updated = await updateCollection(id, user.id, {
      title,
      description,
      items,
      isPublic,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Koleksi tidak ditemukan atau Anda tidak berwenang' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      collection: updated,
      message: 'Koleksi berhasil diperbarui!',
    });
  } catch (err: any) {
    console.error('[API collections/[id] PUT] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memperbarui koleksi' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu' },
        { status: 401 }
      );
    }

    const { id } = params;
    const deleted = await deleteCollection(id, user.id, user.role);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Koleksi tidak ditemukan atau Anda bukan pemiliknya' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Koleksi berhasil dihapus',
    });
  } catch (err: any) {
    console.error('[API collections/[id] DELETE] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal menghapus koleksi' },
      { status: 500 }
    );
  }
}
