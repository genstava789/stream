import { NextRequest, NextResponse } from 'next/server';
import { getGitHubConfigFromRequest, syncAllToGitHub } from '@/lib/admin/cmsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface SyncJobState {
  status: 'idle' | 'in_progress' | 'completed' | 'error';
  startedAt: number | null;
  finishedAt: number | null;
  syncedCount: number;
  message: string | null;
  error: string | null;
  commitSha: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _globalSyncJobState: SyncJobState | undefined;
}

function getJobState(): SyncJobState {
  if (!global._globalSyncJobState) {
    global._globalSyncJobState = {
      status: 'idle',
      startedAt: null,
      finishedAt: null,
      syncedCount: 0,
      message: null,
      error: null,
      commitSha: null,
    };
  }
  return global._globalSyncJobState;
}

/**
 * GET: Returns current server-side Push to GitHub status
 */
export async function GET() {
  const job = getJobState();
  return NextResponse.json(job);
}

/**
 * POST: Initiates Push to GitHub as a persistent background server job
 */
export async function POST(request: NextRequest) {
  try {
    const ghConfig = getGitHubConfigFromRequest(request);
    if (!ghConfig.token) {
      return NextResponse.json(
        { error: 'Token GitHub diperlukan untuk melakukan sinkronisasi ke repository.', requiresToken: true },
        { status: 401 }
      );
    }

    const job = getJobState();

    // If job is already running within the last 60 seconds, return current in-progress state
    if (job.status === 'in_progress' && job.startedAt && Date.now() - job.startedAt < 60000) {
      return NextResponse.json(job);
    }

    // Set job state to in_progress
    job.status = 'in_progress';
    job.startedAt = Date.now();
    job.finishedAt = null;
    job.syncedCount = 0;
    job.error = null;
    job.message = 'Menyinkronkan konten ke GitHub di background server...';

    // Execute push in background (does not block or fail on client refresh/navigation)
    (async () => {
      try {
        const result = await syncAllToGitHub(ghConfig);
        job.status = 'completed';
        job.finishedAt = Date.now();
        job.syncedCount = result.syncedCount;
        job.message = `Sinkronisasi berhasil! ${result.syncedCount} file dipush ke GitHub.`;
      } catch (err: any) {
        console.error('[Background GitHub Sync] Error:', err);
        job.status = 'error';
        job.finishedAt = Date.now();
        job.error = err.message || 'Gagal menyinkronkan ke GitHub';
        job.message = job.error;
      }
    })();

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('[API github-sync] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to start GitHub sync', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}
