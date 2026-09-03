import { NextRequest, NextResponse } from 'next/server';
import { getGitHubConfigFromRequest, syncAllToGitHub, importAllFromGitHub } from '@/lib/admin/cmsService';
import { getStoredGitHubSettings, saveStoredGitHubSettings } from '@/lib/mongodb/service';
import { testGitHubConnection, resolveGitHubOptions } from '@/lib/githubStorage';

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
  repo: string | null;
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
      repo: null,
    };
  }
  return global._globalSyncJobState;
}

/**
 * GET: Returns sync status, saved content repo settings, and last sync timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const job = getJobState();
    const stored = await getStoredGitHubSettings().catch(() => null);

    const effectiveOwner = stored?.owner || process.env.GITHUB_BACKUP_OWNER || process.env.GITHUB_OWNER || 'genstava789';
    const effectiveRepo = stored?.repo || process.env.GITHUB_BACKUP_REPO || 'filmes-content';
    const effectiveBranch = stored?.branch || process.env.GITHUB_BACKUP_BRANCH || 'main';
    const hasToken = Boolean(stored?.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN);

    return NextResponse.json({
      job,
      settings: {
        owner: effectiveOwner,
        repo: effectiveRepo,
        branch: effectiveBranch,
        token: stored?.token ? `${stored.token.slice(0, 6)}...` : '',
        hasToken,
        lastExportAt: stored?.lastExportAt || null,
        lastImportAt: stored?.lastImportAt || null,
        lastSyncedCount: stored?.lastSyncedCount || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch status' }, { status: 500 });
  }
}

/**
 * POST: Exports all MongoDB content to the dedicated GitHub repository (Atomic Git Trees commit).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ghConfig = await getGitHubConfigFromRequest(request, body);

    if (!ghConfig.token) {
      return NextResponse.json(
        { error: 'Token GitHub diperlukan untuk melakukan sinkronisasi ke repository.', requiresToken: true },
        { status: 401 }
      );
    }

    // Save/update settings in MongoDB if provided in body
    if (body.owner || body.repo || body.branch || body.token) {
      await saveStoredGitHubSettings({
        owner: ghConfig.owner,
        repo: ghConfig.repo,
        branch: ghConfig.branch,
        token: ghConfig.token || undefined,
      }).catch(() => null);
    }

    const job = getJobState();
    job.status = 'in_progress';
    job.startedAt = Date.now();
    job.finishedAt = null;
    job.syncedCount = 0;
    job.error = null;
    job.repo = `${ghConfig.owner}/${ghConfig.repo}`;
    job.message = `Menyinkronkan konten ke repository '${ghConfig.owner}/${ghConfig.repo}'...`;

    // Execute atomic sync
    const result = await syncAllToGitHub(ghConfig);

    job.status = 'completed';
    job.finishedAt = Date.now();
    job.syncedCount = result.syncedCount;
    job.commitSha = result.commitSha || null;
    job.message = `Berhasil! ${result.syncedCount} file dipush ke repository '${result.repo}'.`;

    return NextResponse.json({
      success: true,
      message: job.message,
      syncedCount: result.syncedCount,
      commitSha: result.commitSha,
      repo: result.repo,
    });
  } catch (error: any) {
    console.error('[API github-sync POST] Error:', error);
    const job = getJobState();
    job.status = 'error';
    job.finishedAt = Date.now();
    job.error = error.message || 'Gagal menyinkronkan ke GitHub';
    job.message = job.error;

    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to sync to GitHub', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}

/**
 * PUT: Imports all Markdown content from GitHub repository into MongoDB (Bulk Upsert).
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ghConfig = await getGitHubConfigFromRequest(request, body);

    if (!ghConfig.token) {
      return NextResponse.json(
        { error: 'Token GitHub diperlukan untuk melakukan import dari repository.', requiresToken: true },
        { status: 401 }
      );
    }

    // Save/update settings in MongoDB if provided in body
    if (body.owner || body.repo || body.branch || body.token) {
      await saveStoredGitHubSettings({
        owner: ghConfig.owner,
        repo: ghConfig.repo,
        branch: ghConfig.branch,
        token: ghConfig.token || undefined,
      }).catch(() => null);
    }

    const result = await importAllFromGitHub(ghConfig);

    return NextResponse.json({
      success: true,
      message: `Import berhasil! ${result.importedMovies} film, ${result.importedShows} serial, dan ${result.importedEpisodes} episode diimpor ke MongoDB dari '${result.repo}'.`,
      ...result,
    });
  } catch (error: any) {
    console.error('[API github-sync PUT] Error:', error);
    const requiresToken = error.message?.includes('Token GitHub diperlukan');
    return NextResponse.json(
      { error: error.message || 'Failed to import from GitHub', requiresToken },
      { status: requiresToken ? 401 : 500 }
    );
  }
}

/**
 * PATCH: Tests connection or saves settings to MongoDB without performing a full sync.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ghConfig = await getGitHubConfigFromRequest(request, body);

    if (body.action === 'test') {
      const testResult = await testGitHubConnection(ghConfig);
      return NextResponse.json(testResult);
    }

    // Default action: Save settings to MongoDB
    const saved = await saveStoredGitHubSettings({
      owner: ghConfig.owner,
      repo: ghConfig.repo,
      branch: ghConfig.branch,
      token: ghConfig.token || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Pengaturan repository '${ghConfig.owner}/${ghConfig.repo}' berhasil disimpan ke database!`,
      settings: saved,
    });
  } catch (error: any) {
    console.error('[API github-sync PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
