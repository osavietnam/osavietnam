import { renderProvinceNewsPage } from '../../lib/province-news-page';

export const prerender = false;

export async function GET({ url }: { url: URL }) {
  try {
    return new Response(await renderProvinceNewsPage(1, url.searchParams.get('theme') ?? 'dark'), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load source';
    return new Response(`<p style="font:16px system-ui;padding:2rem">Không thể tải tin Tỉnh Dòng: ${message}</p>`, {
      status: 502,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}
