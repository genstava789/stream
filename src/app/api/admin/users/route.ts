import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getAllUsers, resolveUserRole } from '@/lib/mongodb/userService';

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

    const role = resolveUserRole(user);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Hanya Administrator dan Owner yang dapat mengakses data ini' },
        { status: 403 }
      );
    }

    const users = await getAllUsers(user.id);

    return NextResponse.json({
      success: true,
      users,
      operatorRole: role,
    });
  } catch (err: any) {
    console.error('[API admin/users GET] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal mengambil data pengguna' },
      { status: 500 }
    );
  }
}
