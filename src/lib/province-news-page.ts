const SOURCE_ORIGIN = 'https://www.osa.org.au';
const SOURCE_PATH = '/province-updates/latest-updates-and-events/';
const SOURCE_PAGE_SIZE = 12;
const PAGE_SIZE = 4;
const FETCH_TIMEOUT_MS = 20000;

type ProvinceNewsItem = {
  title: string;
  description: string;
  link: string;
  image: string;
  date: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[String(name).toLowerCase()] ?? entity);
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? '';
}

function parseProvinceNews(html: string) {
  const paginationStart = html.search(/<div\b[^>]*class=["'][^"']*\bpt-cv-pagination-wrapper\b/i);
  const galleryEnd = paginationStart >= 0 ? paginationStart : html.length;
  const starts = Array.from(html.matchAll(/<div\b[^>]*class=["'][^"']*\bpt-cv-content-item\b[^"']*["'][^>]*>/gi))
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0 && index < galleryEnd);

  const items: ProvinceNewsItem[] = starts.map((start, index) => {
    const end = Math.min(starts[index + 1] ?? galleryEnd, galleryEnd);
    const chunk = html.slice(start, end);
    const titleBlock = chunk.match(/<h3\b[^>]*class=["'][^"']*\bpt-cv-title\b[^"']*["'][^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    const imageTag = chunk.match(/<img\b[^>]*class=["'][^"']*\bpt-cv-thumbnail\b[^"']*["'][^>]*>/i)?.[0] ?? '';
    const time = chunk.match(/<time\b([^>]*)>([\s\S]*?)<\/time>/i);
    const excerpt = chunk.match(/<div\b[^>]*class=["'][^"']*\bpt-cv-content\b[^"']*["'][^>]*>([\s\S]*?)(?:<br\s*\/?>\s*<div\b[^>]*class=["'][^"']*\bpt-cv-rmwrap\b|<div\b[^>]*class=["'][^"']*\bpt-cv-rmwrap\b)/i)?.[1] ?? '';
    return {
      title: plainText(titleBlock?.[2] ?? ''),
      description: plainText(excerpt),
      link: decodeHtml(attribute(titleBlock?.[1] ?? '', 'href')),
      image: decodeHtml(attribute(imageTag, 'src')),
      date: plainText(time?.[2] ?? attribute(time?.[1] ?? '', 'datetime')),
    };
  }).filter((item) => item.title && item.link);

  const totalSourcePages = Math.max(1, Number(html.match(/\bdata-totalpages=["'](\d+)["']/i)?.[1] ?? 1));
  return { items, totalSourcePages };
}

async function getProvinceNews(localPage: number) {
  const sourcePage = Math.floor((localPage - 1) * PAGE_SIZE / SOURCE_PAGE_SIZE) + 1;
  const offset = ((localPage - 1) * PAGE_SIZE) % SOURCE_PAGE_SIZE;
  const sourceUrl = new URL(SOURCE_PATH, SOURCE_ORIGIN);
  if (sourcePage > 1) sourceUrl.searchParams.set('_page', String(sourcePage));
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Province source returned ${response.status}`);
  const parsed = parseProvinceNews(await response.text());
  return {
    items: parsed.items.slice(offset, offset + PAGE_SIZE),
    totalPages: parsed.totalSourcePages * (SOURCE_PAGE_SIZE / PAGE_SIZE),
  };
}

function paginationNumbers(current: number, total: number) {
  const values = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = Array.from(values).filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  pages.forEach((page, index) => {
    if (index && page - pages[index - 1] > 1) result.push('ellipsis');
    result.push(page);
  });
  return result;
}

export async function renderProvinceNewsPage(page: number, requestedTheme = 'dark') {
  const requestedPage = Math.max(1, Math.floor(page || 1));
  const theme = requestedTheme === 'light' ? 'light' : 'dark';
  const result = await getProvinceNews(requestedPage);
  const totalPages = Math.max(1, result.totalPages);
  const currentPage = Math.min(requestedPage, totalPages);
  const deploymentBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const firstPageHref = `${deploymentBase}/api/province-news.html?theme=${theme}`;
  const pageHref = (number: number) => number === 1 ? firstPageHref : `${deploymentBase}/api/province-news-page/${number}.html?theme=${theme}`;
  const articleHref = (link: string) => import.meta.env.GITHUB_PAGES === 'true'
    ? link
    : `${deploymentBase}/api/province-news-article?url=${encodeURIComponent(link)}&theme=${theme}`;

  const cards = result.items.map((item) => `<a class="province-news-card" href="${escapeHtml(articleHref(item.link))}">
    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : '<div class="province-news-card-placeholder"></div>'}
    <div class="province-news-card-copy"><time>${escapeHtml(item.date)}</time><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div>
  </a>`).join('');

  const numbers = paginationNumbers(currentPage, totalPages).map((value) => value === 'ellipsis'
    ? '<span class="province-news-page province-news-page-ellipsis" aria-hidden="true">…</span>'
    : value === currentPage
      ? `<span class="province-news-page active" aria-current="page">${value}</span>`
      : `<a class="province-news-page" href="${pageHref(value)}">${value}</a>`).join('');
  const previous = currentPage > 1
    ? `<a class="province-news-page province-news-page-nav" href="${pageHref(currentPage - 1)}">← Trước</a>`
    : '<span class="province-news-page province-news-page-nav disabled" aria-disabled="true">← Trước</span>';
  const next = currentPage < totalPages
    ? `<a class="province-news-page province-news-page-nav" href="${pageHref(currentPage + 1)}">Sau →</a>`
    : '<span class="province-news-page province-news-page-nav disabled" aria-disabled="true">Sau →</span>';

  const css = `
html,body{margin:0!important;width:100%;background:#08111f;color:#f1e8d8;font-family:'Be Vietnam Pro',Arial,sans-serif;color-scheme:dark}*{box-sizing:border-box}body{min-height:0}
.province-news-section{width:min(100%,1440px);margin:0 auto;padding:24px 10px 30px}
.province-news-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:stretch;justify-content:center;gap:16px}
.province-news-card{display:flex;width:100%;min-width:0;flex-direction:column;overflow:hidden;background:#101c31;border:1px solid rgba(233,193,118,.1);color:inherit;text-decoration:none;transition:transform .65s cubic-bezier(.22,1,.36,1),background-color .65s ease,border-color .4s ease}
.province-news-card img,.province-news-card-placeholder{display:block;width:100%;aspect-ratio:16/9;height:auto;object-fit:cover;background:#16233b;opacity:.9;transition:opacity .65s ease,transform .8s cubic-bezier(.2,.75,.25,1)}
.province-news-card-copy{display:flex;flex:1;flex-direction:column;padding:16px 17px 18px;text-align:left}.province-news-card time{display:block;color:#c5a059;font-size:11px;letter-spacing:.08em;text-transform:uppercase}.province-news-card h3{margin:8px 0;color:#efe7d6;font:600 17px/1.35 'Playfair Display',Georgia,serif;transition:color .55s ease,transform .55s cubic-bezier(.22,1,.36,1)}.province-news-card p{margin:0;color:#c9bfa9;font:400 13px/1.55 'Be Vietnam Pro',Arial,sans-serif;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.province-news-pages{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;margin-top:28px}.province-news-page{color:#c5a059;text-decoration:none;padding:5px 9px;transition:color .35s ease}.province-news-page.active{font-weight:700;color:#efe7d6}.province-news-page-nav{border:1px solid rgba(197,160,89,.38);border-radius:4px;padding-inline:11px}.province-news-page.disabled,.province-news-page-ellipsis{opacity:.38;cursor:default}
@media(hover:hover){.province-news-card:hover{transform:translateY(-3px);background:#16233b;border-color:rgba(233,193,118,.38)}.province-news-card:hover img{opacity:1;transform:scale(1.015)}.province-news-card:hover h3{color:#e9c176;transform:translateX(2px)}.province-news-page:hover{color:#efe7d6}}
@media(max-width:760px){.province-news-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
@media(max-width:480px){.province-news-section{padding:16px 6px 24px}.province-news-grid{grid-template-columns:1fr}.province-news-card{max-width:380px;margin-inline:auto}.province-news-card-copy{padding:13px 14px 15px}.province-news-card time{font-size:10px}.province-news-card h3{margin:6px 0;font-size:15px;line-height:1.38}.province-news-card p{font-size:12px;line-height:1.5}.province-news-pages{gap:5px;margin-top:22px}.province-news-page{padding:5px 7px;font-size:13px}.province-news-page-nav{padding-inline:8px}}
html[data-theme="light"],html[data-theme="light"] body{background:#faf7ef;color:#27382e;color-scheme:light}html[data-theme="light"] .province-news-card{background:#fffdf9;border-color:rgba(26,94,60,.15);box-shadow:0 7px 18px rgba(40,57,44,.06)}html[data-theme="light"] .province-news-card img,html[data-theme="light"] .province-news-card-placeholder{background:#f0ebe0}html[data-theme="light"] .province-news-card h3{color:#1a5e3c}html[data-theme="light"] .province-news-card p{color:#4a584d}html[data-theme="light"] .province-news-card time,html[data-theme="light"] .province-news-page{color:#816127}html[data-theme="light"] .province-news-page.active{color:#1a5e3c}html[data-theme="light"] .province-news-page-nav{border-color:rgba(26,94,60,.28)}@media(hover:hover){html[data-theme="light"] .province-news-card:hover{background:#f5f0e6;border-color:rgba(26,94,60,.38)}html[data-theme="light"] .province-news-card:hover h3{color:#0f3d24}html[data-theme="light"] .province-news-page:hover{color:#0f3d24}}
`;
  const resizeScript = `<script>(function(){var section=document.querySelector('.province-news-section');var report=function(){var height=section?Math.ceil(section.getBoundingClientRect().height):document.body.scrollHeight;parent.postMessage({type:'province-news-resize',kind:'gallery',height:height},location.origin)};window.addEventListener('load',report);window.addEventListener('resize',report);if(section&&'ResizeObserver'in window)new ResizeObserver(report).observe(section);setTimeout(report,0)})()</script>`;
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><section class="province-news-section"><div class="province-news-grid">${cards}</div><nav class="province-news-pages" aria-label="Các trang tin Tỉnh Dòng">${previous}${numbers}${next}</nav></section>${resizeScript}</body></html>`;
}
