import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { selectiveRevalidateAll } from '@/lib/admin/cmsService';

export const dynamic = 'force-dynamic';

/**
 * Dedicated On-Demand Revalidation API Route:
 * Can be triggered via webhook, external CMS, MongoDB change stream, or manually:
 * e.g. GET /api/revalidate?secret=...&path=/
 */
export async function GET(request: NextRequest) {
  return handleRevalidation(request);
}

export async function POST(request: NextRequest) {
  return handleRevalidation(request);
}

async function handleRevalidation(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '/';
  const tag = searchParams.get('tag');
  const secret = searchParams.get('secret') || request.headers.get('x-revalidate-secret');

  // Validate secret if configured
  const expectedSecret =
    process.env.REVALIDATE_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Invalid revalidation secret token' },
      { status: 401 }
    );
  }

  try {
    // 1. Invalidate internal in-memory caches
    selectiveRevalidateAll();

    // 2. Invalidate Next.js cache tags if provided
    if (tag) {
      // @ts-ignore
      revalidateTag(tag);
    }

    // 3. Revalidate specific target path
    revalidatePath(path, 'page');
    if (path === '/') {
      revalidatePath('/', 'layout');
    }

    return NextResponse.json({
      revalidated: true,
      path,
      tag: tag || null,
      timestamp: Date.now(),
      message: `Path ${path} successfully revalidated on-demand`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Revalidation error', message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
