import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { updateUserRole, resolveUserRole } from '@/lib/mongodb/userService';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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
        { success: false, message: 'Akses ditolak: Hanya Owner yang berhak mengubah role pengguna' },
        { status: 403 }
      );
    }

    const targetUserId = params.id;
    const body = await req.json().catch(() => ({}));
    const newRole = body.role === 'admin' ? 'admin' : 'member';

    const result = await updateUserRole(user.id, targetUserId, newRole);

    return NextResponse.json({
      success: true,
      message: `Role pengguna berhasil diubah menjadi ${newRole.toUpperCase()}`,
      user: result.user,
    });
  } catch (err: any) {
    console.error('[API admin/users/[id]/role PUT] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mengubah role pengguna' },
      { status: 500 }
    );
  }
}
