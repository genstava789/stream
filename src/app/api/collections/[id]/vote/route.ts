import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { voteCollection } from '@/lib/mongodb/collectionService';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Silakan login terlebih dahulu untuk memberikan Like atau Dislike' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const type = body.type === 'dislike' ? 'dislike' : 'like';

    const result = await voteCollection(id, user.id, type);

    return NextResponse.json({
      success: true,
      likes: result.likes,
      dislikes: result.dislikes,
      userVote: result.userVote,
    });
  } catch (err: any) {
    console.error('[API collections/[id]/vote POST] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memproses vote koleksi' },
      { status: 500 }
    );
  }
}
