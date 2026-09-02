import { NextRequest, NextResponse } from 'next/server';
import {
  getGitHubConfigFromRequest,
  fetchPaginatedAdminContent,
  createAdminContent,
  updateAdminContent,
  deleteAdminContent,
  selectiveRevalidateAll,
} from '@/lib/admin/cmsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const { searchParams } = new URL(request.url);

    const tab = (searchParams.get('tab') as 'movies' | 'tv') || 'movies';
    const moviePage = Math.max(1, parseInt(searchParams.get('moviePage') || searchParams.get('page') || '1', 10));
    const tvPage = Math.max(1, parseInt(searchParams.get('tvPage') || searchParams.get('page') || '1', 10));
    const search = searchParams.get('search') || '';
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '7', 10));

    const data = await fetchPaginatedAdminContent(ghConfig, {
      tab,
      moviePage,
      tvPage,
      search,
      limit,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API Content GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list content' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const body = await request.json();
    const result = await createAdminContent(body, ghConfig);
    selectiveRevalidateAll();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Content POST] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to create content', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const body = await request.json();
    const result = await updateAdminContent(body, ghConfig);
    selectiveRevalidateAll();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Content PUT] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to update content', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const { searchParams } = new URL(request.url);
    const pathParam = searchParams.get('path');
    let pathsToDelete: string[] = [];

    if (pathParam) {
      pathsToDelete = [pathParam];
    } else {
      try {
        const body = await request.json().catch(() => ({}));
        if (Array.isArray(body.paths)) {
          pathsToDelete = body.paths;
        } else if (body.path) {
          pathsToDelete = [body.path];
        }
      } catch {}
    }

    if (pathsToDelete.length === 0) {
      return NextResponse.json({ error: 'Path parameter or paths array is required' }, { status: 400 });
    }

    const result = await deleteAdminContent(pathsToDelete, ghConfig);
    selectiveRevalidateAll();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Content DELETE] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to delete content', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}
