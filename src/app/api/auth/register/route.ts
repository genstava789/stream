import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/mongodb/userService';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, email, password } = body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, message: 'Username minimal 3 karakter' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, message: 'Format email tidak valid' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password minimal 6 karakter' },
        { status: 400 }
      );
    }

    const user = await createUser({ username, email, password });
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
      message: 'Registrasi berhasil! Selamat datang.',
    });

    // Set secure HTTP-only session cookie
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
    console.error('[API auth/register] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal melakukan pendaftaran akun' },
      { status: 400 }
    );
  }
}
