import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { readAdminSession, requestIsSameOrigin } from './admin-auth';
import {
  clearStudioPendingChanges,
  deleteStudioPendingChange,
  getStudioGithubToken,
  getStudioPendingChange,
  listStudioPendingChanges,
  stageStudioPendingChange,
} from './admin-db';
// The local Content Studio server is reused behind an authenticated same-origin proxy.
// @ts-ignore The implementation is an ESM script shared with `npm run admin`.
import { studioRequestHandler } from '../../scripts/admin-server.mjs';

const workRoot = path.resolve(process.env.STUDIO_ROOT || process.cwd());
const studioRoot = process.env.STUDIO_ROOT
  ? workRoot
  : fs.existsSync(path.join(workRoot, 'src'))
    ? workRoot
    : fs.existsSync(path.join(workRoot, 'dist', 'src'))
      ? path.join(workRoot, 'dist')
      : workRoot;
const trackedRoots = [
  'src/content',
  'src/data',
  'src/assets',
  'public/images',
  'public/db/saints/images',
];

type FileState = { size: number; mtimeMs: number };
let mutationQueue: Promise<unknown> = Promise.resolve();

const json = (data: unknown, status: number) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function walkFiles(root: string, output: Map<string, FileState>) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, output);
    else if (entry.isFile()) {
      const stat = fs.statSync(absolute);
      output.set(path.relative(studioRoot, absolute).replace(/\\/g, '/'), { size: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
}

function snapshot() {
  const state = new Map<string, FileState>();
  for (const relative of trackedRoots) walkFiles(path.join(studioRoot, relative), state);
  return state;
}

function changedFiles(before: Map<string, FileState>, after: Map<string, FileState>) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((file) => {
    const oldState = before.get(file);
    const newState = after.get(file);
    return !oldState || !newState || oldState.size !== newState.size || oldState.mtimeMs !== newState.mtimeMs;
  });
}

function trackedFile(file: string) {
  return trackedRoots.some(root => file === root || file.startsWith(`${root}/`));
}

function studioFile(file: string) {
  if (!trackedFile(file)) throw new Error(`Đường dẫn Content Studio không hợp lệ: ${file}`);
  const absolute = path.resolve(studioRoot, ...file.split('/'));
  const prefix = `${path.resolve(studioRoot)}${path.sep}`;
  if (!absolute.startsWith(prefix)) throw new Error(`Đường dẫn Content Studio không hợp lệ: ${file}`);
  return absolute;
}

function writeStudioFile(file: string, content: Buffer | null, deleted: boolean) {
  const absolute = studioFile(file);
  if (deleted) {
    fs.rmSync(absolute, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content || Buffer.alloc(0));
}

async function applyPendingChanges() {
  const pending = await listStudioPendingChanges();
  for (const change of pending) writeStudioFile(change.path, change.content, change.deleted);
  return pending;
}

async function githubJson(url: string, init: RequestInit, token: string) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'osa-vietnam-content-studio',
      'x-github-api-version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub HTTP ${response.status}`);
  return data;
}

async function githubFile(file: string, token: string) {
  const repository = process.env.STUDIO_GITHUB_REPO || '';
  const branch = process.env.STUDIO_GITHUB_BRANCH || 'main';
  const encodedPath = file.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'osa-vietnam-content-studio',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (response.status === 404) return { content: null, deleted: true };
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `GitHub HTTP ${response.status}`);
  if (data.type !== 'file' || !data.sha) throw new Error(`Không thể đọc file gốc từ GitHub: ${file}`);
  if (data.encoding === 'base64' && data.content) {
    return { content: Buffer.from(String(data.content).replace(/\s/g, ''), 'base64'), deleted: false };
  }
  const blob = await githubJson(`https://api.github.com/repos/${repository}/git/blobs/${data.sha}`, { method: 'GET' }, token);
  return { content: Buffer.from(String(blob.content || '').replace(/\s/g, ''), 'base64'), deleted: false };
}

async function stageChanges(files: string[], token: string) {
  for (const file of files) {
    const existing = await getStudioPendingChange(file);
    const original = existing || await githubFile(file, token);
    const absolute = studioFile(file);
    const deleted = !fs.existsSync(absolute);
    const content = deleted ? null : fs.readFileSync(absolute);
    const originalContent = existing ? existing.originalContent : original.content;
    const originalDeleted = existing ? existing.originalDeleted : original.deleted;
    const reverted = deleted === originalDeleted
      && (deleted || Buffer.compare(content || Buffer.alloc(0), originalContent || Buffer.alloc(0)) === 0);
    if (reverted) await deleteStudioPendingChange(file);
    else await stageStudioPendingChange({ path: file, content, deleted, originalContent, originalDeleted });
  }
  return listStudioPendingChanges();
}

async function commitChanges(files: string[], message: string, token: string) {
  if (!files.length) return null;
  const repository = process.env.STUDIO_GITHUB_REPO || '';
  const branch = process.env.STUDIO_GITHUB_BRANCH || 'main';
  if (!token || !repository) throw new Error('Hostinger chưa được cấu hình quyền ghi GitHub cho Content Studio.');

  const api = `https://api.github.com/repos/${repository}`;
  const ref = await githubJson(`${api}/git/ref/heads/${encodeURIComponent(branch)}`, { method: 'GET' }, token);
  const parent = await githubJson(`${api}/git/commits/${ref.object.sha}`, { method: 'GET' }, token);
  const tree = [];
  for (const file of files) {
    const absolute = path.join(studioRoot, ...file.split('/'));
    if (!fs.existsSync(absolute)) {
      tree.push({ path: file, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await githubJson(`${api}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: fs.readFileSync(absolute).toString('base64'), encoding: 'base64' }),
    }, token);
    tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const nextTree = await githubJson(`${api}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  }, token);
  const commit = await githubJson(`${api}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: nextTree.sha, parents: [ref.object.sha] }),
  }, token);
  await githubJson(`${api}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  }, token);
  return commit.sha as string;
}

class StudioResponse extends Writable {
  statusCode = 200;
  headers = new Headers();
  chunks: Buffer[] = [];
  setHeader(name: string, value: string) { this.headers.set(name, value); return this; }
  getHeader(name: string) { return this.headers.get(name) || undefined; }
  writeHead(status: number, headers?: Record<string, string>) {
    this.statusCode = status;
    if (headers) for (const [name, value] of Object.entries(headers)) this.headers.set(name, value);
    return this;
  }
  _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }
}

async function forward(request: Request, upstreamPath: string, body?: ArrayBuffer) {
  const sourceUrl = new URL(request.url);
  const nodeRequest = Readable.from(body && body.byteLength ? [Buffer.from(body)] : []) as Readable & {
    method: string; url: string; headers: Record<string, string>;
  };
  nodeRequest.method = request.method === 'POST' && sourceUrl.searchParams.get('_method') === 'DELETE' ? 'DELETE' : request.method;
  nodeRequest.url = `${upstreamPath}${sourceUrl.search}`;
  nodeRequest.headers = Object.fromEntries([...request.headers.entries()].map(([name, value]) => [name.toLowerCase(), value]));
  const nodeResponse = new StudioResponse();
  const completed = finished(nodeResponse);
  await studioRequestHandler(nodeRequest, nodeResponse);
  await completed;
  return {
    response: { ok: nodeResponse.statusCode >= 200 && nodeResponse.statusCode < 300, status: nodeResponse.statusCode, headers: nodeResponse.headers },
    responseBody: Buffer.concat(nodeResponse.chunks),
  };
}

async function handleMutation(request: Request, upstreamPath: string) {
  const token = await getStudioGithubToken();
  if (!token || !process.env.STUDIO_GITHUB_REPO) {
    return json({ error: 'Content Studio chưa được cấu hình quyền xuất bản GitHub.' }, 503);
  }
  const body = await request.arrayBuffer();
  const before = snapshot();
  const { response, responseBody } = await forward(request, upstreamPath, body);
  if (!response.ok) return new Response(responseBody, { status: response.status, headers: response.headers });
  const after = snapshot();
  const changes = changedFiles(before, after);
  try {
    const pending = await stageChanges(changes, token);
    const headers = new Headers(response.headers);
    headers.set('x-studio-staged', String(pending.length));
    return new Response(responseBody, { status: response.status, headers });
  } catch (error) {
    console.error('[studio] staging failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Không thể đồng bộ GitHub.' }, 502);
  }
}

function queueMutation<T>(operation: () => Promise<T>) {
  const task = mutationQueue.then(operation, operation);
  mutationQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function studioPendingStatus() {
  const pending = await listStudioPendingChanges();
  return {
    count: pending.length,
    files: pending.map((change) => ({
      path: change.path,
      deleted: change.deleted,
      size: change.content?.byteLength ?? 0,
      updatedAt: change.updatedAt,
    })),
  };
}

export function publishStudioPendingChanges() {
  return queueMutation(async () => {
    const token = await getStudioGithubToken();
    if (!token) throw new Error('Chưa cấu hình GitHub token.');

    process.env.STUDIO_GITHUB_REPO ||= 'osavietnam/osavietnam';
    process.env.STUDIO_GITHUB_BRANCH ||= 'main';
    const pending = await applyPendingChanges();
    if (pending.length === 0) return { count: 0, commit: null };

    const commit = await commitChanges(
      pending.map((change) => change.path),
      `content: publish ${pending.length} staged change${pending.length === 1 ? '' : 's'}`,
      token,
    );
    await clearStudioPendingChanges();
    return { count: pending.length, commit };
  });
}

export function discardStudioPendingChanges() {
  return queueMutation(async () => {
    const pending = await listStudioPendingChanges();
    for (const change of pending) {
      await writeStudioFile(change.path, change.originalContent, change.originalDeleted);
    }
    await clearStudioPendingChanges();
    return { count: pending.length };
  });
}

export async function proxyStudio(request: Request, upstreamPath: string) {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  const storedToken = await getStudioGithubToken().catch(() => '');
  if (storedToken && !process.env.STUDIO_GITHUB_TOKEN) process.env.STUDIO_GITHUB_TOKEN = storedToken;
  process.env.STUDIO_GITHUB_REPO ||= 'osavietnam/osavietnam';
  process.env.STUDIO_GITHUB_BRANCH ||= 'main';
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (mutation && !requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  await applyPendingChanges();
  if (!mutation) {
    const { response, responseBody } = await forward(request, upstreamPath);
    return new Response(responseBody, { status: response.status, headers: response.headers });
  }
  return queueMutation(() => handleMutation(request, upstreamPath));
}
