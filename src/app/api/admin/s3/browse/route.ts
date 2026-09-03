import { NextRequest, NextResponse } from 'next/server';
import { listS3Objects } from '@/lib/s3/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get('bucket') || undefined;
  const prefix = searchParams.get('prefix') || '';
  const search = (searchParams.get('search') || '').trim().toLowerCase();

  try {
    const result = await listS3Objects(bucket, prefix);

    let { folders, files } = result;

    if (search) {
      folders = folders.filter((f) => f.toLowerCase().includes(search));
      files = files.filter(
        (file) =>
          file.name.toLowerCase().includes(search) ||
          file.key.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      folders,
      files,
    });
  } catch (error: any) {
    console.error('[API s3/browse] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Gagal menjelajahi bucket S3',
      },
      { status: 500 }
    );
  }
}
