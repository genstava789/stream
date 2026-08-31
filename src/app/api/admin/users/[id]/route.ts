import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { deleteUserAccount, resolveUserRole } from '@/lib/mongodb/userService';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
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

    const role = resolveUserRole(user);
    if (role !== 'owner') {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Hanya Owner yang berhak menghapus akun pengguna' },
        { status: 403 }
      );
    }

    const targetUserId = params.id;
    const result = await deleteUserAccount(user.id, targetUserId);

    return NextResponse.json({
      success: true,
      message: `Akun @${result.deletedUsername} beserta seluruh datanya berhasil dihapus permanen`,
      deletedUsername: result.deletedUsername,
    });
  } catch (err: any) {
    console.error('[API admin/users/[id] DELETE] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal menghapus akun pengguna' },
      { status: 500 }
    );
  }
}
