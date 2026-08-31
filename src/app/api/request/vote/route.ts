import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { voteMediaRequest } from '@/lib/mongodb/requestService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu untuk memberikan vote' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { requestId } = body;

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ID Request wajib disertakan' },
        { status: 400 }
      );
    }

    const result = await voteMediaRequest(requestId, user.id);

    return NextResponse.json({
      success: true,
      votes: result.votes,
      hasVoted: result.hasVoted,
      message: result.hasVoted
        ? 'Vote Anda berhasil ditambahkan!'
        : 'Vote Anda berhasil dibatalkan',
    });
  } catch (err: any) {
    console.error('[API request/vote POST] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memproses vote' },
      { status: 500 }
    );
  }
}
