import fs from 'node:fs';
import path from 'node:path';
import { readAdminSession, requestIsSameOrigin } from './admin-auth';
import { getStudioGithubToken } from './admin-db';
// The local Content Studio server is reused behind an authenticated same-origin proxy.
// @ts-ignore The implementation is an ESM script shared with `npm run admin`.
import { startStudioServer } from '../../scripts/admin-server.mjs';

const studioRoot = path.resolve(process.env.STUDIO_ROOT || process.cwd());
const studioPort = Number(process.env.STUDIO_PORT || 4323);
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

async function forward(request: Request, upstreamPath: string, body?: ArrayBuffer) {
  await startStudioServer();
  const sourceUrl = new URL(request.url);
  const upstream = new URL(`http://127.0.0.1:${studioPort}${upstreamPath}`);
  upstream.search = sourceUrl.search;
  const headers = new Headers(request.headers);
  for (const name of ['host', 'connection', 'content-length', 'cookie', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']) headers.delete(name);
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: body && body.byteLength ? body : undefined,
    redirect: 'manual',
  });
  const responseBody = await response.arrayBuffer();
  return { response, responseBody };
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
    const commit = await commitChanges(changes, `content: update from Studio (${upstreamPath})`, token);
    const headers = new Headers(response.headers);
    if (commit) headers.set('x-studio-commit', commit);
    return new Response(responseBody, { status: response.status, headers });
  } catch (error) {
    console.error('[studio] GitHub sync failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Không thể đồng bộ GitHub.' }, 502);
  }
}

export async function proxyStudio(request: Request, upstreamPath: string) {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  const storedToken = await getStudioGithubToken().catch(() => '');
  if (storedToken && !process.env.STUDIO_GITHUB_TOKEN) process.env.STUDIO_GITHUB_TOKEN = storedToken;
  process.env.STUDIO_GITHUB_REPO ||= 'osavietnam/osavietnam';
  process.env.STUDIO_GITHUB_BRANCH ||= 'main';
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (mutation && !requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  if (!mutation) {
    const { response, responseBody } = await forward(request, upstreamPath);
    return new Response(responseBody, { status: response.status, headers: response.headers });
  }
  const task = mutationQueue.then(() => handleMutation(request, upstreamPath), () => handleMutation(request, upstreamPath));
  mutationQueue = task.then(() => undefined, () => undefined);
  return task as Promise<Response>;
}
