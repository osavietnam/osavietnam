import type { APIRoute } from 'astro';
import { readAdminSession, requestIsSameOrigin } from '../../../lib/admin-auth';
import { getStudioGithubToken, setStudioGithubToken } from '../../../lib/admin-db';

export const prerender = false;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export const GET: APIRoute = async ({ request }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  return json({ configured: Boolean(await getStudioGithubToken()) });
};

export const POST: APIRoute = async ({ request }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  if (!token) return json({ error: 'Thiếu GitHub token.' }, 422);
  const probe = await fetch('https://api.github.com/repos/osavietnam/osavietnam', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'osa-vietnam-content-studio',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!probe.ok) return json({ error: 'GitHub token không hợp lệ hoặc không có quyền truy cập repository.' }, 422);
  await setStudioGithubToken(token);
  process.env.STUDIO_GITHUB_TOKEN = token;
  process.env.STUDIO_GITHUB_REPO = 'osavietnam/osavietnam';
  process.env.STUDIO_GITHUB_BRANCH = 'main';
  return json({ ok: true, configured: true });
};
