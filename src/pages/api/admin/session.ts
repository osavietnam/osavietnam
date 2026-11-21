import type { APIRoute } from 'astro';
import { clearSessionCookie, createAdminSession, readAdminSession, requestIsSameOrigin, sessionCookie, verifyAdminPassword } from '../../../lib/admin-auth';

const json = (data: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const attempts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const GET: APIRoute = ({ request }) => json({ authenticated: Boolean(readAdminSession(request)) });

export const POST: APIRoute = async ({ request }) => {
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const body = await request.json().catch(() => ({}));
  if (body.action === 'logout') return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  const client = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const current = attempts.get(client);
  if (current && current.reset > now && current.count >= MAX_ATTEMPTS) return json({ error: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' }, 429);
  if (!current || current.reset <= now) attempts.set(client, { count: 0, reset: now + WINDOW_MS });
  const username = String(body.username ?? '');
  const password = String(body.password ?? '');
  if (!verifyAdminPassword(username, password)) {
    const record = attempts.get(client)!; record.count += 1;
    return json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }, 401);
  }
  attempts.delete(client);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(createAdminSession(username)) });
};

export const DELETE: APIRoute = ({ request }) => {
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
};
