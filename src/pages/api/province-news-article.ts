const SOURCE_ORIGIN = 'https://www.osa.org.au';
const FETCH_TIMEOUT_MS = 20000;

export const prerender = false;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[String(name).toLowerCase()] ?? entity);
}

function text(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractDivByClass(html: string, className: string) {
  const opener = new RegExp(`<div\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'i');
  const match = opener.exec(html);
  if (!match || match.index < 0) return '';
  const tokenPattern = /<\/?div\b[^>]*>/gi;
  tokenPattern.lastIndex = match.index;
  let depth = 0;
  let token: RegExpExecArray | null;
  while ((token = tokenPattern.exec(html))) {
    if (/^<\/div/i.test(token[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(match.index, tokenPattern.lastIndex);
  }
  return html.slice(match.index);
}

function metaContent(html: string, property: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (key !== property) continue;
    return decodeHtml(tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? '');
  }
  return '';
}

export async function GET({ url }: { url: URL }) {
  const requested = url.searchParams.get('url') ?? '';
  const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(requested, SOURCE_ORIGIN);
  } catch {
    return new Response('Invalid article URL', { status: 400 });
  }
  if (sourceUrl.protocol !== 'https:' || !['www.osa.org.au', 'osa.org.au'].includes(sourceUrl.hostname) || sourceUrl.port) {
    return new Response('Invalid article URL', { status: 400 });
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const source = await response.text();
    let content = extractDivByClass(source, 'post-wrapper-content');
    if (!content) throw new Error('Article content was not found');
    content = content
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/\son(?:click|load|error|mouseover|mouseenter|mouseleave)\s*=\s*(["'])[\s\S]*?\1/gi, '');

    const title = metaContent(source, 'og:title') || text(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const image = metaContent(source, 'og:image');
    const date = text(source.match(/<time\b[^>]*class=["'][^"']*\bentry-date\b[^"']*["'][^>]*>([\s\S]*?)<\/time>/i)?.[1] ?? '');
    const firstHeading = text(content.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ?? '');
    const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const showTitle = title && normalized(firstHeading) !== normalized(title);

    const css = `
:root{color-scheme:${theme}}*{box-sizing:border-box}html,body{margin:0;width:100%;min-width:0;overflow-x:hidden;background:#08111f;color:#d9d2c4;font-family:'Be Vietnam Pro',system-ui,sans-serif}body{padding:clamp(18px,3vw,42px) clamp(10px,2.4vw,34px) 42px}.province-article{width:min(100%,1440px);margin:0 auto}.province-article-head{width:min(100%,1180px);margin:0 auto clamp(24px,4vw,48px);text-align:center}.province-article-head h1{margin:0;color:#efe7d6;font:600 clamp(1.8rem,4.2vw,3.25rem)/1.18 'Playfair Display',Georgia,serif;text-wrap:balance}.province-article-head time{display:block;margin-top:12px;color:#c5a059;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase}.province-article-cover{display:block;width:min(100%,1180px);max-height:680px;object-fit:contain;margin:0 auto clamp(24px,4vw,48px)}
.post-wrapper-content,.post-wrapper-content .section,.post-wrapper-content .section_wrapper,.post-wrapper-content .wrap,.post-wrapper-content .mcb-wrap-inner,.post-wrapper-content .column,.post-wrapper-content .the_content,.post-wrapper-content .the_content_wrapper{width:100%!important;min-width:0!important;max-width:none!important;margin-inline:0!important;padding-inline:0!important;float:none!important}.post-wrapper-content .the_content_wrapper{width:min(100%,1180px)!important;margin-inline:auto!important}.post-wrapper-content h1,.post-wrapper-content h2,.post-wrapper-content h3,.post-wrapper-content h4{color:#efe7d6!important;font-family:'Playfair Display',Georgia,serif!important;line-height:1.28!important;text-wrap:balance}.post-wrapper-content h2{font-size:clamp(1.65rem,3vw,2.35rem)!important}.post-wrapper-content h3{font-size:clamp(1.3rem,2.2vw,1.7rem)!important}.post-wrapper-content p,.post-wrapper-content li{color:#d9d2c4!important;font-size:clamp(.98rem,1.25vw,1.08rem)!important;line-height:1.78!important}.post-wrapper-content a{color:#e9c176!important;text-decoration-thickness:1px;text-underline-offset:.2em}.post-wrapper-content img,.post-wrapper-content picture,.post-wrapper-content video,.post-wrapper-content iframe,.post-wrapper-content svg{display:block;max-width:100%!important;height:auto!important;margin-inline:auto}.post-wrapper-content figure{max-width:100%!important;margin-inline:auto!important}.post-wrapper-content table{display:block;max-width:100%;overflow:auto}.post-wrapper-content blockquote{margin:1.5rem 0;padding:.15rem 0 .15rem 1.25rem;border-left:3px solid #c5a059;color:#efe7d6}.post-wrapper-content .column_attr{padding-inline:0!important}
html[data-theme="light"],html[data-theme="light"] body{background:#faf7ef;color:#39483f;color-scheme:light}html[data-theme="light"] .province-article-head h1,html[data-theme="light"] .post-wrapper-content h1,html[data-theme="light"] .post-wrapper-content h2,html[data-theme="light"] .post-wrapper-content h3,html[data-theme="light"] .post-wrapper-content h4{color:#1a5e3c!important}html[data-theme="light"] .post-wrapper-content p,html[data-theme="light"] .post-wrapper-content li{color:#39483f!important}html[data-theme="light"] .post-wrapper-content a{color:#6c511e!important}
@media(max-width:640px){body{padding:14px 7px 30px}.province-article-head{margin-bottom:22px}.province-article-head h1{font-size:1.75rem}.province-article-cover{margin-bottom:22px}.post-wrapper-content .the_content_wrapper{width:100%!important}.post-wrapper-content p,.post-wrapper-content li{font-size:.95rem!important;line-height:1.7!important}.post-wrapper-content h2{font-size:1.5rem!important}.post-wrapper-content h3{font-size:1.23rem!important}.post-wrapper-content iframe{width:100%!important}}
`;
    const resizeScript = `<script>(function(){var root=document.querySelector('.province-article');var report=function(){var height=Math.ceil(Math.max(root?root.getBoundingClientRect().height:0,document.body.scrollHeight)+parseFloat(getComputedStyle(document.body).paddingTop)+parseFloat(getComputedStyle(document.body).paddingBottom));if(height>0)parent.postMessage({type:'province-news-resize',kind:'article',height:height},location.origin)};var schedule=function(){requestAnimationFrame(report)};window.addEventListener('load',schedule);window.addEventListener('resize',schedule);document.querySelectorAll('img,iframe,video').forEach(function(media){media.addEventListener('load',schedule);media.addEventListener('error',schedule)});if(root&&'ResizeObserver'in window)new ResizeObserver(schedule).observe(root);setTimeout(schedule,0);setTimeout(schedule,500);setTimeout(schedule,1800)})()</script>`;
    const header = showTitle ? `<header class="province-article-head"><h1>${escapeHtml(title)}</h1>${date ? `<time>${escapeHtml(date)}</time>` : ''}</header>` : '';
    const cover = showTitle && image ? `<img class="province-article-cover" src="${escapeHtml(image)}" alt="" loading="eager">` : '';
    const html = `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${SOURCE_ORIGIN}/"><style>${css}</style></head><body><article class="province-article">${header}${cover}${content}</article>${resizeScript}</body></html>`;
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load article';
    return new Response(`<p style="font:16px system-ui;padding:2rem">Không thể tải bài viết: ${escapeHtml(message)}</p>`, {
      status: 502,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}
