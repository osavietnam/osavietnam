import { renderCentralNewsPage } from '../../lib/central-news-page';

export const prerender = false;

export async function GET({ url }: { url: URL }) {
  try {
    return new Response(await renderCentralNewsPage(1, url.origin, url.searchParams.get('theme') ?? 'dark', url.searchParams.get('external') === '1'), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load source';
    return new Response(`<p style="font:16px system-ui;padding:2rem">Unable to load news: ${message}</p>`, {
      status: 502,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}
