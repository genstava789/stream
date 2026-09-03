/**
 * GitHub REST API Client for Serverless / Vercel Live CMS operations.
 * Bypasses EROFS (Read-only filesystem) by committing directly to the GitHub repository.
 */

const DEFAULT_OWNER = process.env.GITHUB_BACKUP_OWNER || process.env.GITHUB_OWNER || 'genstava789';
const DEFAULT_REPO = process.env.GITHUB_BACKUP_REPO || (process.env.GITHUB_REPO !== 'stream' ? process.env.GITHUB_REPO : null) || 'filmes-content';
const DEFAULT_BRANCH = process.env.GITHUB_BACKUP_BRANCH || process.env.GITHUB_BRANCH || 'main';

export interface GitHubOptions {
  owner?: string;
  repo?: string;
  branch?: string;
  token?: string | null;
}

/**
 * Sanitizes and splits user-provided GitHub repository input.
 * Handles:
 * - Full URLs: https://github.com/owner/repo or https://github.com/owner/repo.git
 * - Slugs: owner/repo
 * - Clean names: repo (uses defaultOwner)
 */
export function parseGitHubRepoInput(
  input?: string,
  defaultOwner: string = 'genstava789'
): { owner: string; repo: string } {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { owner: defaultOwner, repo: 'filmes-content' };
  }

  let clean = input.trim();
  // Remove git+https:// or https:// or http:// or github.com/
  clean = clean.replace(/^(?:git\+)?https?:\/\/github\.com\//i, '');
  clean = clean.replace(/^github\.com\//i, '');
  clean = clean.replace(/\.git$/i, '');
  clean = clean.replace(/^\/+|\/+$/g, '');

  if (clean.includes('/')) {
    const parts = clean.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  return { owner: defaultOwner, repo: clean || 'filmes-content' };
}

export function getEffectiveToken(customToken?: string | null): string | null {
  return customToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

/**
 * Resolves and protects GitHub options to ensure content is never pushed to the code repository.
 */
export function resolveGitHubOptions(options: GitHubOptions = {}): {
  owner: string;
  repo: string;
  branch: string;
  token: string | null;
} {
  const token = getEffectiveToken(options.token);
  const parsed = parseGitHubRepoInput(options.repo, options.owner || DEFAULT_OWNER);
  const owner = parsed.owner || options.owner || DEFAULT_OWNER;
  let repo = parsed.repo || DEFAULT_REPO;
  const branch = (options.branch || DEFAULT_BRANCH).trim() || 'main';

  // Explicit safety block: never push content files to source code repository ('stream')
  if (repo.toLowerCase() === 'stream' && !process.env.ALLOW_PUSH_TO_STREAM_REPO) {
    console.warn(`[githubStorage] Attempted to push content to main code repository '${repo}'. Diverting to 'filmes-content' to protect codebase.`);
    repo = process.env.GITHUB_BACKUP_REPO || 'filmes-content';
  }

  return { owner, repo, branch, token };
}

/**
 * Gets a file metadata (including current SHA and content) from GitHub repository.
 * Always fetches fresh content without caching to ensure accurate SHA for edits.
 */
export async function getGitHubFile(filePath: string, options: GitHubOptions = {}) {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);
  if (!token) throw new Error('GitHub token is required on Vercel to access files via API');

  const cleanPath = filePath.replace(/^\/+/, '');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}&_t=${Date.now()}`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'LeviStream-CMS',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    return {
      isDirectory: true,
      items: data,
      path: cleanPath,
    } as any;
  }

  const content = data.content ? Buffer.from(data.content, 'base64').toString('utf8') : '';

  return {
    sha: data.sha,
    content,
    path: data.path,
    isDirectory: false,
  };
}

/**
 * Creates or updates a file in GitHub repository with automatic conflict resolution.
 */
export async function saveGitHubFile(
  filePath: string,
  fileContent: string,
  commitMessage: string,
  options: GitHubOptions = {}
) {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);
  if (!token) throw new Error('GitHub token is required on Vercel to save content');

  const cleanPath = filePath.replace(/^\/+/, '');

  const putFile = async (currentSha?: string) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
    const base64Content = Buffer.from(fileContent, 'utf8').toString('base64');

    const bodyPayload: any = {
      message: commitMessage || `cms: update ${cleanPath}`,
      content: base64Content,
      branch,
    };

    if (currentSha) {
      bodyPayload.sha = currentSha;
    }

    return await fetch(url, {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'LeviStream-CMS',
      },
      body: JSON.stringify(bodyPayload),
    });
  };

  // 1. Get existing file SHA if it exists (fresh lookup)
  let sha: string | undefined;
  try {
    const existing = await getGitHubFile(cleanPath, options);
    if (existing && !existing.isDirectory) {
      sha = existing.sha;
    }
  } catch {
    // If not found or error, sha remains undefined (new file)
  }

  // 2. Put file to GitHub API
  let res = await putFile(sha);

  // 3. Auto-retry on 409 conflict (stale SHA) by fetching fresh SHA
  if (res.status === 409) {
    try {
      const freshExisting = await getGitHubFile(cleanPath, options);
      if (freshExisting?.sha && !freshExisting.isDirectory) {
        res = await putFile(freshExisting.sha);
      }
    } catch {}
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err.message || `HTTP ${res.status}`;
    throw new Error(
      `Gagal menyimpan ke GitHub (${errMsg}). Pastikan token memiliki izin 'repo' dan akses tulis ke '${owner}/${repo}' branch '${branch}'.`
    );
  }

  return await res.json();
}

/**
 * Recursively deletes all files in a folder on GitHub repository.
 */
export async function deleteGitHubFolder(
  folderPath: string,
  commitMessage: string,
  options: GitHubOptions = {}
) {
  const token = getEffectiveToken(options.token);
  if (!token) throw new Error('GitHub token is required on Vercel to delete content');

  const cleanFolder = folderPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const prefix = `${cleanFolder}/`;

  // Get full tree to find all files in this folder
  const tree = await getGitHubTree(options);
  const filesToDelete = tree.filter(
    (item) => item.type === 'blob' && (item.path === cleanFolder || item.path.startsWith(prefix))
  );

  if (filesToDelete.length === 0) {
    return { success: true, count: 0 };
  }

  for (const file of filesToDelete) {
    try {
      await deleteGitHubFile(file.path, commitMessage || `cms: delete ${file.path}`, options);
    } catch (e) {
      console.warn(`[deleteGitHubFolder] Warning deleting ${file.path}:`, e);
    }
  }

  return { success: true, count: filesToDelete.length };
}

/**
 * Deletes a file or directory in GitHub repository
 */
export async function deleteGitHubFile(
  filePath: string,
  commitMessage: string,
  options: GitHubOptions = {}
) {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);
  if (!token) throw new Error('GitHub token is required on Vercel to delete content');

  const cleanPath = filePath.replace(/^\/+/, '');

  // 1. Get fresh file SHA
  const existing = await getGitHubFile(cleanPath, options);
  if (!existing) {
    // Already deleted or not found
    return { success: true, message: 'File already deleted or not found' };
  }

  // If it's a directory, delegate to recursive delete
  if (existing.isDirectory) {
    return await deleteGitHubFolder(cleanPath, commitMessage, options);
  }

  // 2. Delete file via GitHub API
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

  let res = await fetch(url, {
    method: 'DELETE',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'LeviStream-CMS',
    },
    body: JSON.stringify({
      message: commitMessage || `cms: delete ${cleanPath}`,
      sha: existing.sha,
      branch,
    }),
  });

  // Retry on conflict
  if (res.status === 409) {
    try {
      const freshExisting = await getGitHubFile(cleanPath, options);
      if (freshExisting && !freshExisting.isDirectory) {
        res = await fetch(url, {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'LeviStream-CMS',
          },
          body: JSON.stringify({
            message: commitMessage || `cms: delete ${cleanPath}`,
            sha: freshExisting.sha,
            branch,
          }),
        });
      }
    } catch {}
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err.message || `HTTP ${res.status}`;
    throw new Error(
      `Gagal menghapus di GitHub (${errMsg}). Pastikan token memiliki izin 'repo' dan akses tulis ke '${owner}/${repo}' branch '${branch}'.`
    );
  }

  return await res.json();
}

/**
 * Reads a raw text/markdown file from GitHub directly with live cache busting.
 * Works seamlessly on Vercel runtime to load latest CMS edits immediately.
 */
export async function getGitHubRawFile(filePath: string, options: GitHubOptions = {}): Promise<string | null> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const { owner, repo, branch, token } = resolveGitHubOptions(options);

  // 1. Primary: Use GitHub REST API with Accept: application/vnd.github.v3.raw (Bypasses Fastly CDN cache completely)
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}&_t=${Date.now()}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.raw',
      'User-Agent': 'LeviStream-CMS',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(apiUrl, {
      headers,
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('---')) {
        return text;
      }
    }
  } catch {}

  // 2. Secondary Fallback: public GitHub raw URL with timestamp cache buster
  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}?_t=${Date.now()}`;
    const res = await fetch(rawUrl, {
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('---')) {
        return text;
      }
    }
  } catch {}

  return null;
}

/**
 * Lists all files in a directory on GitHub repository
 */
export async function listGitHubDir(dirPath: string, options: GitHubOptions = {}): Promise<string[]> {
  const cleanPath = dirPath.replace(/^\/+/, '');
  const { owner, repo, branch, token } = resolveGitHubOptions(options);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeviStream-CMS',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}&_t=${Date.now()}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        return items.map((item: any) => item.name);
      }
    }
  } catch {}

  return [];
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

/**
 * Gets full repository tree (all files and directories) recursively in a single fast API call.
 */
export async function getGitHubTree(options: GitHubOptions = {}): Promise<GitHubTreeItem[]> {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeviStream-CMS',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1&_t=${Date.now()}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.tree)) {
        return data.tree as GitHubTreeItem[];
      }
    }
  } catch (err) {
    console.warn('getGitHubTree notice:', err);
  }

  return [];
}

/**
 * Reads a git blob by its SHA directly from GitHub API.
 */
export async function getGitHubBlob(sha: string, options: GitHubOptions = {}): Promise<string | null> {
  const { owner, repo, token } = resolveGitHubOptions(options);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'LeviStream-CMS',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}?_t=${Date.now()}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      return await res.text();
    }
  } catch {}

  return null;
}

/**
 * Ensures the target GitHub repository exists. If it does not exist (404),
 * automatically attempts to create the repository under the authenticated user's account or organization.
 */
export async function ensureGitHubRepository(options: GitHubOptions = {}): Promise<{
  created: boolean;
  repoFullName: string;
  defaultBranch: string;
}> {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);
  if (!token) throw new Error('GitHub token is required to access or create repository');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeviStream-CMS',
  };

  // 1. Check if repo exists
  const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}?_t=${Date.now()}`, {
    headers,
    cache: 'no-store',
  });

  if (checkRes.ok) {
    const data = await checkRes.json();
    return {
      created: false,
      repoFullName: data.full_name,
      defaultBranch: data.default_branch || branch,
    };
  }

  // 401 Unauthorized
  if (checkRes.status === 401) {
    throw new Error('Token GitHub tidak valid atau telah kedaluwarsa.');
  }

  // Other HTTP error (not 404)
  if (checkRes.status !== 404) {
    const err = await checkRes.json().catch(() => ({}));
    throw new Error(err.message || `Gagal memeriksa repository di GitHub (HTTP ${checkRes.status})`);
  }

  // 2. Repo does not exist (404). Attempt automatic creation!
  console.log(`[githubStorage] Repository '${owner}/${repo}' tidak ditemukan. Mencoba membuat repositori baru secara otomatis di GitHub...`);

  const userRes = await fetch('https://api.github.com/user', { headers, cache: 'no-store' });
  if (!userRes.ok) {
    const userErr = await userRes.json().catch(() => ({}));
    throw new Error(
      `Repository '${owner}/${repo}' tidak ditemukan di GitHub, dan gagal memverifikasi token pengguna (${userErr.message || userRes.statusText}). Pastikan token memiliki izin 'repo'.`
    );
  }

  const userData = await userRes.json();
  const authUsername = userData.login || '';
  const isPersonal = !owner || owner.toLowerCase() === authUsername.toLowerCase();

  const createUrl = isPersonal
    ? 'https://api.github.com/user/repos'
    : `https://api.github.com/orgs/${owner}/repos`;

  const createBody = {
    name: repo,
    private: true,
    description: 'LeviStream Content Storage - Backup Repository',
    auto_init: true,
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const createErr = await createRes.json().catch(() => ({}));
    const reason = createErr.message || createRes.statusText;
    throw new Error(
      `Repository '${owner}/${repo}' tidak ditemukan di GitHub, dan pembuatan otomatis gagal (${reason}). Pastikan Personal Access Token memiliki izin 'repo'.`
    );
  }

  const newRepoData = await createRes.json();
  console.log(`[githubStorage] Berhasil membuat repository baru '${newRepoData.full_name}'. Menginisialisasi...`);

  // Wait 1.5s for GitHub to initialize branch
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    created: true,
    repoFullName: newRepoData.full_name,
    defaultBranch: newRepoData.default_branch || branch || 'main',
  };
}

/**
 * Commits multiple files atomically to GitHub in a single commit using GitHub Git Trees API.
 * This is 50x faster, prevents partial syncs, timeouts, or stale race conditions.
 */
export async function commitMultipleGitHubFiles(
  files: { path: string; content: string }[],
  commitMessage: string,
  options: GitHubOptions = {}
): Promise<{ success: boolean; commitSha: string; syncedCount: number; createdRepo?: boolean }> {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);
  if (!token) throw new Error('GitHub token is required to commit to GitHub repository');

  if (!files || files.length === 0) {
    return { success: true, commitSha: '', syncedCount: 0 };
  }

  // 1. Ensure target repository exists, or auto-create it
  const repoStatus = await ensureGitHubRepository(options);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'LeviStream-CMS',
  };

  try {
    // 2. Get the latest commit SHA of the target branch, or initialize empty repository
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}?_t=${Date.now()}`,
      { headers, cache: 'no-store' }
    );

    let latestCommitSha: string = '';
    let baseTreeSha: string = '';

    if (!refRes.ok) {
      if (refRes.status === 404) {
        // Branch is not initialized yet. Initialize branch with a README.md first
        const initRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/README.md`,
          {
            method: 'PUT',
            headers,
            cache: 'no-store',
            body: JSON.stringify({
              message: 'Initialize content repository',
              content: Buffer.from(`# Content Storage for LeviStream\nAuto-initialized content repository.\n`, 'utf8').toString('base64'),
              branch,
            }),
          }
        );
        if (!initRes.ok) {
          const initErr = await initRes.json().catch(() => ({}));
          throw new Error(`Repository '${owner}/${repo}' tidak dapat diinisialisasi (${initErr.message || initRes.statusText}).`);
        }
        const initData = await initRes.json();
        latestCommitSha = initData.commit.sha;
        baseTreeSha = initData.commit.tree.sha;
      } else {
        const err = await refRes.json().catch(() => ({}));
        throw new Error(`Failed to get branch ref: ${err.message || refRes.statusText}`);
      }
    } else {
      const refData = await refRes.json();
      latestCommitSha = refData.object.sha;
      const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}?_t=${Date.now()}`,
        { headers, cache: 'no-store' }
      );
      if (!commitRes.ok) {
        const err = await commitRes.json().catch(() => ({}));
        throw new Error(`Failed to get base commit: ${err.message || commitRes.statusText}`);
      }
      const commitData = await commitRes.json();
      baseTreeSha = commitData.tree.sha;
    }

    // 3. Prepare the tree entries
    const treeEntries = files.map((file) => ({
      path: file.path.replace(/^\/+/, ''),
      mode: '100644',
      type: 'blob',
      content: file.content,
    }));

    // 4. Create the new Git Tree on GitHub
    const createTreeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      }
    );

    if (!createTreeRes.ok) {
      const err = await createTreeRes.json().catch(() => ({}));
      throw new Error(`Failed to create git tree: ${err.message || createTreeRes.statusText}`);
    }

    const treeData = await createTreeRes.json();
    const newTreeSha = treeData.sha;

    // 5. Create a new Git Commit
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
          message: commitMessage || `cms: sync ${files.length} content files`,
          tree: newTreeSha,
          parents: [latestCommitSha],
        }),
      }
    );

    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(`Failed to create git commit: ${err.message || newCommitRes.statusText}`);
    }

    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // 6. Update the branch reference to point to the new commit
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
          sha: newCommitSha,
          force: false,
        }),
      }
    );

    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(`Failed to update branch ref: ${err.message || updateRefRes.statusText}`);
    }

    return {
      success: true,
      commitSha: newCommitSha,
      syncedCount: files.length,
      createdRepo: repoStatus.created,
    };
  } catch (treeErr: any) {
    console.warn('[commitMultipleGitHubFiles] Git Tree API notice, falling back to sequential save:', treeErr);
    // Fallback to sequential saves if Git Trees API encounters an issue
    let count = 0;
    const saveErrors: string[] = [];
    for (const file of files) {
      try {
        await saveGitHubFile(file.path, file.content, `cms: sync ${file.path}`, options);
        count++;
      } catch (saveErr: any) {
        console.warn(`[commitMultipleGitHubFiles] Error saving ${file.path}:`, saveErr);
        saveErrors.push(saveErr?.message || String(saveErr));
      }
    }

    if (count === 0 && files.length > 0) {
      throw new Error(
        `Gagal melakukan push ke repository '${owner}/${repo}': ${saveErrors[0] || treeErr.message || 'Semua file gagal disimpan'}`
      );
    }

    return {
      success: true,
      commitSha: 'sequential-fallback',
      syncedCount: count,
      createdRepo: repoStatus.created,
    };
  }
}

/**
 * Tests connection to the target content repository with current credentials.
 */
export async function testGitHubConnection(options: GitHubOptions = {}): Promise<{
  success: boolean;
  message: string;
  repoName: string;
  isPrivate?: boolean;
  defaultBranch?: string;
}> {
  const { owner, repo, branch, token } = resolveGitHubOptions(options);
  if (!token) {
    throw new Error('Token GitHub diperlukan untuk mengetes koneksi.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LeviStream-CMS',
  };

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository '${owner}/${repo}' tidak ditemukan atau token tidak memiliki akses. Pastikan nama repository benar dan token memiliki izin 'repo'.`);
    }
    if (res.status === 401) {
      throw new Error('Token GitHub tidak valid atau telah kedaluwarsa.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Gagal terhubung ke GitHub (HTTP ${res.status})`);
  }

  const repoData = await res.json();
  return {
    success: true,
    message: `Terhubung dengan sukses ke repository '${repoData.full_name}'!`,
    repoName: repoData.full_name,
    isPrivate: repoData.private,
    defaultBranch: repoData.default_branch || branch,
  };
}

