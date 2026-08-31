import { NextRequest, NextResponse } from 'next/server';
import { getGitHubConfigFromRequest, updateAdminContent } from '@/lib/admin/cmsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleEdit(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const body = await request.json();
    const result = await updateAdminContent(body, ghConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Edit] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to update content', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return handleEdit(request);
}

export async function POST(request: NextRequest) {
  return handleEdit(request);
}
