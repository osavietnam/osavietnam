const SOURCE_ORIGIN = 'https://www.augustinianorder.org';
const NEWS_CATEGORY_ID = 'b4d42789-942e-4a4c-b5ff-df3504e19ec6';
const BLOG_APP_ID = '22bef345-3c5b-4c18-b782-74d4085112ff';
const PAGE_SIZE = 4;
const FETCH_TIMEOUT_MS = 12000;

type NewsItem = { title: string; description: string; link: string; image: string; date: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function getWixHeaders() {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';
  return {
    'user-agent': userAgent,
    accept: 'application/json, text/plain, */*',
    referer: `${SOURCE_ORIGIN}/_partials/wix-thunderbolt/dist/clientWorker.196162d7.bundle.min.js`,
    'x-wix-brand': 'wix',
    'x-wix-linguist': 'en|en-us|true|4a020198-a67a-4b44-a735-0b636b58eecf',
    commonconfig: encodeURIComponent(JSON.stringify({
      brand: 'wix', host: 'VIEWER', BSI: '', siteRevision: '4',
      branchId: '7e8bb0d8-5fd7-46c2-9095-6509b46ced7e', renderingFlow: 'NONE', language: 'en', locale: 'en-us',
    })),
  };
}

async function getCentralNews(page: number) {
  const headers = getWixHeaders();
  const tokenResponse = await fetch(`${SOURCE_ORIGIN}/_api/v1/access-tokens?ifr=true&worker=false`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!tokenResponse.ok) throw new Error(`Wix access token returned ${tokenResponse.status}`);
  const tokenData = await tokenResponse.json() as { apps?: Record<string, { accessToken?: string }> };
  const accessToken = tokenData.apps?.[BLOG_APP_ID]?.accessToken;
  if (!accessToken) throw new Error('Wix blog access token is unavailable');

  const endpoint = new URL('/_api/blog-frontend-adapter-public/v2/post-feed-page', SOURCE_ORIGIN);
  endpoint.search = new URLSearchParams({
    languageCode: 'en', page: String(page), pageSize: String(PAGE_SIZE), includeInitialPageData: 'false',
    type: 'POST_LIST_WIDGET', 'postListWidgetOptions.featuredOnly': 'false',
    'postListWidgetOptions.categoryId': NEWS_CATEGORY_ID, translationsName: 'post-list-widget',
  }).toString();
  const response = await fetch(endpoint, { headers: { ...headers, authorization: accessToken }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Wix news feed returned ${response.status}`);
  const data = await response.json() as { postFeedPage?: { posts?: { posts?: Array<Record<string, any>>; pagingMetaData?: { total?: number } } } };
  const feed = data.postFeedPage?.posts;
  const items: NewsItem[] = (feed?.posts ?? []).map((post) => ({
    title: String(post.title ?? ''),
    description: String(post.excerpt ?? ''),
    link: String(post.link ?? `${post.url?.base ?? SOURCE_ORIGIN}${post.url?.path ?? ''}`),
    image: String(post.media?.wixMedia?.image?.url ?? ''),
    date: String(post.firstPublishedDate ?? ''),
  })).filter((item) => item.title && item.link);
  return { items, total: Number(feed?.pagingMetaData?.total ?? items.length) };
}

export async function renderCentralNewsPage(page: number, origin: string, requestedTheme = 'dark', openExternal = false) {
  const requestedPage = Math.max(1, page);
  const theme = requestedTheme === 'light' ? 'light' : 'dark';
  const { items, total } = await getCentralNews(requestedPage);
  const totalPages = Math.min(12, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const currentPage = Math.min(totalPages, requestedPage);
  const deploymentBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const modeParam = openExternal ? '&external=1' : '';
  const local = `${deploymentBase}/api/central-news.html?theme=${theme}${modeParam}`;
  const paged = `${deploymentBase}/api/central-news-page`;
  const cards = items.map((item) => {
    let articleHref = item.link;
    if (!openExternal) {
      try {
        const articleUrl = new URL(item.link, SOURCE_ORIGIN);
        if (import.meta.env.GITHUB_PAGES !== 'true' && articleUrl.origin === SOURCE_ORIGIN && articleUrl.pathname.startsWith('/post/')) {
          articleHref = `${deploymentBase}/api/central-news-article?path=${encodeURIComponent(articleUrl.pathname)}&theme=${theme}`;
        }
      } catch {}
    }
    const externalAttrs = openExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="central-news-card" href="${escapeHtml(articleHref)}"${externalAttrs}>
    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : '<div class="central-news-card-placeholder"></div>'}
    <div class="central-news-card-copy"><time>${escapeHtml(item.date ? new Date(item.date).toLocaleDateString('en-GB') : '')}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div>
  </a>`;
  }).join('');
  const pageHref = (pageNumber: number) => pageNumber === 1 ? local : `${paged}/${pageNumber}.html?theme=${theme}${modeParam}`;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => {
    const n = index + 1;
    return n === currentPage ? `<span class="central-news-page active" aria-current="page">${n}</span>` : `<a class="central-news-page" href="${pageHref(n)}">${n}</a>`;
  }).join('');
  const previous = currentPage > 1
    ? `<a class="central-news-page central-news-page-nav" href="${pageHref(currentPage - 1)}">← Trước</a>`
    : `<span class="central-news-page central-news-page-nav disabled" aria-disabled="true">← Trước</span>`;
  const next = currentPage < totalPages
    ? `<a class="central-news-page central-news-page-nav" href="${pageHref(currentPage + 1)}">Sau →</a>`
    : `<span class="central-news-page central-news-page-nav disabled" aria-disabled="true">Sau →</span>`;
  const pagination = `${previous}${pageNumbers}${next}`;
  const css = `
html,body{margin:0!important;width:100%;background:#08111f;color:#f1e8d8;font-family:'Be Vietnam Pro',Arial,sans-serif;color-scheme:dark}
*{box-sizing:border-box}
html{scrollbar-width:thin;scrollbar-color:#c5a059 transparent}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{border:0;border-radius:0;background:#c5a059}::-webkit-scrollbar-thumb:hover{background:#e9c176}
body{min-height:0}
.central-news-section{width:min(100%,1440px);margin:0 auto;padding:24px 10px 30px}
.central-news-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;justify-content:center;justify-items:center;gap:16px}
.central-news-card{display:flex;align-self:center;width:100%;max-width:none;flex-direction:column;min-width:0;overflow:hidden;background:#101b30;border:1px solid rgba(233,193,118,.18);color:inherit;text-decoration:none;transition:transform .3s cubic-bezier(.22,1,.36,1),background-color .25s ease,border-color .25s ease}
.central-news-card img,.central-news-card-placeholder{display:block;width:100%;aspect-ratio:16/9;height:auto;object-fit:cover;background:#16233b;opacity:.94;transition:opacity .25s ease,transform .4s cubic-bezier(.2,.75,.25,1)}
.central-news-card-copy{padding:16px 17px 18px;text-align:left;transition:background-color .25s ease}
.central-news-card time{display:block;color:#c5a059;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.95}
.central-news-card h3{margin:8px 0;color:#efe7d6;font:600 17px/1.35 'Playfair Display',Georgia,serif;transition:color .25s ease,transform .25s cubic-bezier(.22,1,.36,1)}
.central-news-card p{margin:0;color:#c9bfa9;font:400 13px/1.55 'Be Vietnam Pro',Arial,sans-serif;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.central-news-pages{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;margin-top:28px}.central-news-page{color:#c5a059;text-decoration:none;padding:5px 9px;transition:color .35s ease}.central-news-page.active{font-weight:700;color:#efe7d6}.central-news-page-nav{border:1px solid rgba(197,160,89,.38);border-radius:4px;padding-inline:11px}.central-news-page.disabled{opacity:.38;cursor:default}
@media(hover:hover){.central-news-card:hover{transform:translateY(-3px);background:#16233b;border-color:rgba(233,193,118,.38)}.central-news-card:hover img{opacity:1;transform:scale(1.015)}.central-news-card:hover h3{color:#e9c176;transform:translateX(2px)}.central-news-page:hover{color:#efe7d6}}
@media(max-width:760px){.central-news-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
@media(max-width:480px){.central-news-section{padding-inline:6px}.central-news-grid{grid-template-columns:1fr}.central-news-card{max-width:380px}.central-news-card-copy{padding:13px 14px 15px}.central-news-card time{font-size:10px}.central-news-card h3{margin:6px 0;font-size:15px;line-height:1.38}.central-news-card p{font-size:12px;line-height:1.5}.central-news-pages{gap:5px;margin-top:22px}.central-news-page{padding:5px 7px;font-size:13px}.central-news-page-nav{padding-inline:8px}}
html[data-theme="light"],html[data-theme="light"] body{background:#faf7ef;color:#27382e;color-scheme:light}html[data-theme="light"]{scrollbar-color:#1a5e3c transparent}html[data-theme="light"]::-webkit-scrollbar-thumb,html[data-theme="light"] ::-webkit-scrollbar-thumb{background:#1a5e3c}html[data-theme="light"]::-webkit-scrollbar-thumb:hover,html[data-theme="light"] ::-webkit-scrollbar-thumb:hover{background:#0f3d24}.central-news-section{background:transparent}html[data-theme="light"] .central-news-card{background:#fffdf9;border-color:rgba(26,94,60,.15);box-shadow:0 7px 18px rgba(40,57,44,.06)}html[data-theme="light"] .central-news-card img,html[data-theme="light"] .central-news-card-placeholder{background:#f0ebe0}html[data-theme="light"] .central-news-card h3{color:#1a5e3c}html[data-theme="light"] .central-news-card p{color:#4a584d}html[data-theme="light"] .central-news-card time,html[data-theme="light"] .central-news-page{color:#816127}html[data-theme="light"] .central-news-page.active{color:#1a5e3c}html[data-theme="light"] .central-news-page-nav{border-color:rgba(26,94,60,.28)}@media(hover:hover){html[data-theme="light"] .central-news-card:hover{transform:translateY(-3px);background:#f5f0e6;border-color:rgba(26,94,60,.38)}html[data-theme="light"] .central-news-card:hover h3{color:#0f3d24;transform:translateX(2px)}html[data-theme="light"] .central-news-page:hover{color:#0f3d24}}
html[data-theme="light"] .central-news-card{border-color:rgba(26,94,60,.2);box-shadow:none}
`;
  const resizeScript = `<script>(function(){var section=document.querySelector('.central-news-section');var report=function(){var height=section?Math.ceil(section.getBoundingClientRect().height):document.body.scrollHeight;parent.postMessage({type:'central-news-resize',kind:'gallery',height:height},location.origin)};var setZoom=function(scale){var zoom=Math.min(1.25,Math.max(1,Number(scale)||1));document.body.style.zoom=String(zoom);document.body.style.width=(100/zoom)+'%';requestAnimationFrame(report)};window.addEventListener('message',function(event){if(event.origin===location.origin&&event.data&&event.data.type==='central-news-zoom')setZoom(event.data.scale)});window.addEventListener('load',report);window.addEventListener('resize',report);if(section&&'ResizeObserver'in window)new ResizeObserver(report).observe(section);setTimeout(report,0)})()</script>`;
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><section id="comp-mn54cd9a" class="central-news-section"><div class="central-news-grid">${cards}</div><nav class="central-news-pages" aria-label="News pages">${pagination}</nav></section>${resizeScript}</body></html>`;
}
