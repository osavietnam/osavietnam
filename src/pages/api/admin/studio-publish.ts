import type { APIRoute } from 'astro';
import { readAdminSession, requestIsSameOrigin } from '../../../lib/admin-auth';
import {
  discardStudioPendingChanges,
  publishStudioPendingChanges,
  studioPendingStatus,
} from '../../../lib/studio-proxy';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, private' },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  try {
    return json(await studioPendingStatus());
  } catch (error) {
    console.error('[studio] pending status failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Không thể đọc vùng chờ.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!readAdminSession(request)) return json({ error: 'Chưa đăng nhập.' }, 401);
  if (!requestIsSameOrigin(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);

  try {
    const { action } = await request.json();
    if (action === 'publish') return json(await publishStudioPendingChanges());
    if (action === 'discard') return json(await discardStudioPendingChanges());
    return json({ error: 'Thao tác không hợp lệ.' }, 400);
  } catch (error) {
    console.error('[studio] publish action failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Không thể thực hiện thao tác.' }, 500);
  }
};
