import type { APIRoute } from 'astro';
import { readAdminSession, requestIsSameOrigin } from '../../../../lib/admin-auth';
import { createPost, listAdminPosts } from '../../../../lib/admin-db';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
const payload = (body: any) => ({
  slug: slugify(String(body.slug || body.title || '')),
  title: String(body.title || '').trim().slice(0, 255),
  excerpt: String(body.excerpt || '').trim(), body: String(body.body || '').trim(),
  author: String(body.author || '').trim().slice(0, 160),
  status: body.status === 'published' ? 'published' as const : 'draft' as const,
});

export const GET: APIRoute = async ({ request }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  return json({ posts: await listAdminPosts() });
};

export const POST: APIRoute = async ({ request }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const input = payload(await request.json().catch(() => ({})));
  if (!input.slug || !input.title || !input.body) return json({ error: 'Tiêu đề, đường dẫn và nội dung là bắt buộc.' }, 422);
  try { return json({ ok: true, id: await createPost(input) }, 201); }
  catch (error: any) { return json({ error: error?.code === 'ER_DUP_ENTRY' ? 'Đường dẫn này đã tồn tại.' : 'Không thể lưu bài viết.' }, 500); }
};

