import { NextRequest, NextResponse } from 'next/server';
import { getGitHubConfigFromRequest, createAdminContent } from '@/lib/admin/cmsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    const body = await request.json();
    const result = await createAdminContent(body, ghConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Create] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to create content', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}
