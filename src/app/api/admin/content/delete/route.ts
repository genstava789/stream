import { NextRequest, NextResponse } from 'next/server';
import { getGitHubConfigFromRequest, deleteAdminContent } from '@/lib/admin/cmsService';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { resolveUserRole } from '@/lib/mongodb/userService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleDelete(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request).catch(() => null);
    if (user && resolveUserRole(user) !== 'owner') {
      return NextResponse.json(
        {
          error: 'Akses ditolak: Administrator tidak memiliki izin untuk menghapus konten CMS. Hanya Owner yang dapat menghapus konten.',
        },
        { status: 403 }
      );
    }

    let pathsToDelete: string[] = [];
    let body: any = {};
    const { searchParams } = new URL(request.url);
    const pathParam = searchParams.get('path');

    if (pathParam) {
      pathsToDelete = [pathParam];
    } else {
      try {
        body = await request.json().catch(() => ({}));
        if (Array.isArray(body.paths)) {
          pathsToDelete = body.paths;
        } else if (body.path) {
          pathsToDelete = [body.path];
        }
      } catch {}
    }

    const ghConfig = await getGitHubConfigFromRequest(request, body);

    if (pathsToDelete.length === 0) {
      return NextResponse.json({ error: 'Path parameter or paths array is required' }, { status: 400 });
    }

    const result = await deleteAdminContent(pathsToDelete, ghConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Delete] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to delete content', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  return handleDelete(request);
}

export async function POST(request: NextRequest) {
  return handleDelete(request);
}
