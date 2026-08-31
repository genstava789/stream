import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/mongodb/userService';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: 'Username/Email dan Password wajib diisi' },
        { status: 400 }
      );
    }

    const user = await authenticateUser(identifier, password);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Username/Email atau Password salah' },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      id: user._id!.toString(),
      username: user.username,
      email: user.email,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id!.toString(),
        username: user.username,
        email: user.email,
        role: user.role || 'member',
        avatar: user.avatar,
        watchlist: user.watchlist || [],
        history: user.history || [],
        createdAt: user.createdAt,
      },
      message: `Selamat datang kembali, ${user.username}!`,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (err: any) {
    console.error('[API auth/login] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal masuk ke akun' },
      { status: 500 }
    );
  }
}
