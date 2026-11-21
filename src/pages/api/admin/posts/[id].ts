import type { APIRoute } from 'astro';
import { readAdminSession, requestIsSameOrigin } from '../../../../lib/admin-auth';
import { deletePost, updatePost } from '../../../../lib/admin-db';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);

export const PUT: APIRoute = async ({ request, params }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const id = Number(params.id); const body = await request.json().catch(() => ({}));
  const input = { slug: slugify(String(body.slug || body.title || '')), title: String(body.title || '').trim().slice(0, 255), excerpt: String(body.excerpt || '').trim(), body: String(body.body || '').trim(), author: String(body.author || '').trim().slice(0, 160), status: body.status === 'published' ? 'published' as const : 'draft' as const };
  if (!id || !input.slug || !input.title || !input.body) return json({ error: 'Dữ liệu không hợp lệ.' }, 422);
  try { await updatePost(id, input); return json({ ok: true }); }
  catch (error: any) { return json({ error: error?.code === 'ER_DUP_ENTRY' ? 'Đường dẫn này đã tồn tại.' : 'Không thể cập nhật.' }, 500); }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  const id = Number(params.id); if (!id) return json({ error: 'ID không hợp lệ.' }, 422);
  await deletePost(id); return json({ ok: true });
};

