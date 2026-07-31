import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 4321);
const sourceOrigin = 'https://www.augustinianorder.org';

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function injectArticleLayout(html) {
  // Proxy cùng origin để bài báo vẫn nằm trong iframe; bỏ CSP meta của nguồn vì
  // response proxy không dùng CSP header và cần cho phép CSS fit-width bên dưới.
  html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
  const fit = `<meta name="viewport" content="width=device-width,initial-scale=1">
  <base href="${sourceOrigin}/">
  <style id="osa-local-article-wide">
    :root{--osa-article-max:1760px}
    html,body{margin:0!important;width:100%!important;min-width:0!important;max-width:none!important;overflow-x:hidden!important}
    #SITE_CONTAINER,#SITE_ROOT,main,[role="main"]{width:100%!important;min-width:0!important;max-width:none!important;margin-inline:0!important}
    main>div,main>section,[data-hook="post-page"],[data-testid="blog-post-page"],.blog-post-page,.post-page{width:100%!important;min-width:0!important;max-width:none!important;margin-inline:0!important;box-sizing:border-box!important}
    article,[data-hook="post-content"],[data-testid="post-content"],[data-testid*="post-content"],.post-content{width:min(calc(100% - 12px),var(--osa-article-max))!important;max-width:var(--osa-article-max)!important;margin-inline:auto!important;padding-inline:6px!important;box-sizing:border-box!important}
    article>*,[data-hook="post-content"]>*,[data-testid*="post-content"]>*{max-width:none!important}
    [data-testid="richTextElement"],[data-hook*="rich-text"],.blog-post-description{width:100%!important;max-width:none!important}
    img,picture,video,svg,canvas,iframe{max-width:100%!important;height:auto!important}
    @media(max-width:640px){article,[data-hook="post-content"],[data-testid="post-content"],[data-testid*="post-content"],.post-content{width:100%!important;max-width:none!important;padding-inline:4px!important}}
  </style>`;
  return html.includes('</head>') ? html.replace('</head>', `${fit}</head>`) : `${fit}${html}`;
}

async function proxyArticle(url, res) {
  const path = url.searchParams.get('path') || '';
  if (!path.startsWith('/post/')) return send(res, 400, 'Invalid article path');
  try {
    const upstream = await fetch(new URL(path, sourceOrigin), {
      headers: { 'user-agent': 'Mozilla/5.0 OSA-Vietnam-local-preview/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) throw new Error(`Source returned ${upstream.status}`);
    const html = injectArticleLayout(await upstream.text());
    send(res, 200, html, 'text/html; charset=utf-8');
  } catch (error) {
    const message = String(error?.message || error).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    send(res, 502, `<main style="font:16px system-ui;padding:2rem;max-width:70rem;margin:auto"><h1>Không thể tải bài báo</h1><p>${message}</p><p><a href="${sourceOrigin}${path}" target="_blank" rel="noopener">Mở bài gốc trong tab mới</a></p></main>`, 'text/html; charset=utf-8');
  }
}

async function resolveStatic(pathname) {
  let clean;
  try { clean = decodeURIComponent(pathname).replace(/\\/g, '/'); }
  catch { return null; }
  if (clean.includes('\0')) return null;
  clean = normalize(clean).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '');
  const candidates = [];
  if (!clean || pathname.endsWith('/')) candidates.push(join(root, clean, 'index.html'));
  else {
    candidates.push(join(root, clean));
    if (!extname(clean)) candidates.push(join(root, `${clean}.html`), join(root, clean, 'index.html'));
  }
  for (const file of candidates) {
    const absolute = resolve(file);
    if (!absolute.startsWith(root)) continue;
    try { if ((await stat(absolute)).isFile()) return absolute; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  if (url.pathname === '/api/central-news-article') return proxyArticle(url, res);
  const file = await resolveStatic(url.pathname);
  if (!file) return send(res, 404, 'Not found');
  try {
    const data = await readFile(file);
    send(res, 200, data, types[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch (error) {
    send(res, 500, String(error));
  }
}).listen(port, host, () => {
  console.log(`Local production preview đang mở trên mọi card mạng: http://0.0.0.0:${port}/`);
  console.log(`Trên điện thoại cùng Wi-Fi, mở: http://<IP-MAY-TINH>:${port}/`);
});
