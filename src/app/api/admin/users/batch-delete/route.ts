import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { batchDeleteUserAccounts, resolveUserRole } from '@/lib/mongodb/userService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu' },
        { status: 401 }
      );
    }

    const role = resolveUserRole(user);
    if (role !== 'owner') {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Hanya Owner yang berhak menghapus akun pengguna' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    if (userIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Pilih setidaknya satu akun untuk dihapus' },
        { status: 400 }
      );
    }

    const result = await batchDeleteUserAccounts(user.id, userIds);

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${result.deletedCount} akun pengguna beserta seluruh datanya secara permanen`,
      deletedCount: result.deletedCount,
    });
  } catch (err: any) {
    console.error('[API admin/users/batch-delete POST] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal menghapus beberapa akun' },
      { status: 500 }
    );
  }
}
