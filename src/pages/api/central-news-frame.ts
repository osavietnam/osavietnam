const SOURCE_URL = 'https://www.augustinianorder.org/news';

export const prerender = false;

export async function GET() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'user-agent': 'augusinh-news-embed/1.0' },
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    let html = await response.text();

    const isolationCss = `<style id="augusinh-news-isolation">
      html, body { margin: 0 !important; min-width: 0 !important; overflow-x: hidden !important; }
    </style>`;
    const isolationScript = `<script>
      (() => {
        const isolate = () => {
          const target = document.getElementById('comp-mn54cd9a');
          if (!target || !target.parentElement) return;
          let keep = target;
          while (keep.parentElement && keep.parentElement !== document.body) {
            const parent = keep.parentElement;
            Array.from(parent.children).forEach((child) => { if (child !== keep) child.style.display = 'none'; });
            keep = parent;
          }
          Array.from(document.body.children).forEach((child) => { if (child !== keep) child.style.display = 'none'; });
          keep.style.display = '';
          document.documentElement.style.overflowX = 'hidden';
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', isolate, { once: true });
        else isolate();
        new MutationObserver(isolate).observe(document.documentElement, { childList: true, subtree: true });
      })();
    </script>`;

    html = html.includes('</head>') ? html.replace('</head>', `${isolationCss}</head>`) : `${isolationCss}${html}`;
    html = html.includes('</body>') ? html.replace('</body>', `${isolationScript}</body>`) : `${html}${isolationScript}`;

    return new Response(html, {
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
