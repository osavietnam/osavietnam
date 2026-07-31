import { renderCentralNewsPage } from '../../../lib/central-news-page';

export const prerender = false;
export async function GET({ params, url }: { params: { page?: string }, url: URL }) {
  const page = Math.max(2, Number(params.page || 2));
  try {
    return new Response(await renderCentralNewsPage(page, url.origin, url.searchParams.get('theme') ?? 'dark'), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load source';
    return new Response(`<main style="font:16px system-ui;padding:2rem"><p>Không thể tải trang ${page}: ${message}</p><p><a href="/api/central-news.html">Về trang 1</a></p></main>`, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
