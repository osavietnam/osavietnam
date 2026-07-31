import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = 'https://augnet.osa.org.au/history/';
const dataFile = new URL('src/data/augnet-history-index.json', root);
const contentRoot = new URL('src/content/augnet-history/', root);
const cacheFile = new URL('temp_/augnet-history-crawl-cache.json', root);
const categoryMeta = {
  general: { category: 'General', categoryVi: 'Lịch Sử Tổng Quát' },
  'regional-history': { category: 'Regional History', categoryVi: 'Lịch Sử theo Khu Vực' },
  places: { category: 'Places', categoryVi: 'Địa Điểm' },
  people: { category: 'People', categoryVi: 'Nhân Vật' },
};

const decodeHtml = (value) => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&rsquo;/gi, '’')
  .replace(/&ndash;/gi, '–')
  .replace(/&mdash;/gi, '—')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeUrl = (href, current) => {
  try {
    const url = new URL(href, current);
    url.hash = '';
    url.search = '';
    if (url.hostname === 'www.augnet.org' || url.hostname === 'augnet.org') {
      url.protocol = 'https:';
      url.hostname = 'augnet.osa.org.au';
      url.pathname = url.pathname.replace(/^\/en(?=\/history\/)/, '');
    }
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return '';
  }
};

const isAllowed = (url) => {
  if (!url.startsWith(source)) return false;
  const first = url.slice(source.length).split('/').filter(Boolean)[0];
  return !first || Boolean(categoryMeta[first]);
};

const queue = [source];
const queued = new Set(queue);
const visited = new Set();
const found = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let pageCache = {};
try {
  pageCache = JSON.parse(await readFile(cacheFile, 'utf8'));
} catch {
  // Chưa có cache ở lần crawl đầu tiên.
}

async function fetchPage(url) {
  if (pageCache[url]) return pageCache[url];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status === 503) {
        await wait(800 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        const page = { status: response.status, h1: '', links: [] };
        pageCache[url] = page;
        return page;
      }
      const html = await response.text();
      const page = {
        status: response.status,
        h1: html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '',
        links: [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
          .map((match) => [match[1], match[2]]),
      };
      pageCache[url] = page;
      return page;
    } catch (error) {
      if (attempt === 5) {
        console.warn(`Network error: ${url} (${error.cause?.code ?? error.message})`);
        return null;
      }
      await wait(800 * (attempt + 1));
    }
  }
  return null;
}

const remember = (absolute, label = '') => {
  const relative = absolute.slice(source.length);
  const segments = relative.split('/').filter(Boolean);
  const slug = segments.at(-1) ?? '';
  const match = slug.match(/^(\d{4}[a-z]?)-/i);
  if (!match || !categoryMeta[segments[0]]) return;
  const urlCode = match[1].toUpperCase();
  const cleanLabel = decodeHtml(label);
  const labelMatch = cleanLabel.match(/^(\d{4}[a-z]?)\s+(.+)$/i);
  const code = labelMatch?.[1].toUpperCase() ?? urlCode;
  const title = labelMatch?.[2]?.trim() || slug.replace(/^\d{4}[a-z]?-/i, '').replaceAll('-', ' ');
  const previous = found.get(absolute);
  found.set(absolute, {
    code,
    urlCode,
    title: cleanLabel ? title : previous?.title ?? title,
    fullTitle: `${code} ${cleanLabel ? title : previous?.title ?? title}`,
    url: absolute,
    categorySlug: segments[0],
  });
};

while (queue.length) {
  const batch = queue.splice(0, 6);
  await Promise.all(batch.map(async (url) => {
    if (visited.has(url)) return;
    visited.add(url);
    const page = await fetchPage(url);
    if (!page || page.status !== 200) {
      found.delete(url);
      console.warn(`Skipped ${page?.status ?? 'network'}: ${url}`);
      return;
    }
    remember(url, page.h1);

    for (const [href, label] of page.links) {
      const absolute = normalizeUrl(href, url);
      if (!isAllowed(absolute)) continue;
      remember(absolute, label);
      if (!visited.has(absolute) && !queued.has(absolute)) {
        queue.push(absolute);
        queued.add(absolute);
      }
    }
  }));
  await mkdir(path.dirname(fileURLToPath(cacheFile)), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(pageCache), 'utf8');
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const uniqueEntries = new Map();
const seenIdentity = new Set();
for (const entry of found.values()) {
  const slug = new URL(entry.url).pathname.split('/').filter(Boolean).at(-1);
  const routeKey = `${entry.categorySlug}/${slug}`;
  const identityKey = `${entry.categorySlug}/${entry.code}/${entry.title.toLocaleLowerCase('en')}`;
  if (uniqueEntries.has(routeKey) || seenIdentity.has(identityKey)) continue;
  uniqueEntries.set(routeKey, entry);
  seenIdentity.add(identityKey);
}
const allEntries = [...uniqueEntries.values()].sort((a, b) => collator.compare(a.code, b.code));
const duplicateCodes = [...new Set(allEntries.map((entry) => entry.code).filter((code, index, codes) => codes.indexOf(code) !== index))];

const categories = Object.entries(categoryMeta).map(([categorySlug, meta]) => ({
  ...meta,
  categorySlug,
  entries: allEntries
    .filter((entry) => entry.categorySlug === categorySlug)
    .map(({ categorySlug: _categorySlug, ...entry }) => entry),
}));

const index = {
  source,
  indexedAt: new Date().toISOString().slice(0, 10),
  crawledPageCount: visited.size,
  categoryCount: categories.length,
  entryCount: allEntries.length,
  duplicateCodes,
  categories,
};

await mkdir(path.dirname(fileURLToPath(dataFile)), { recursive: true });
await writeFile(dataFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

let order = 0;
for (const category of categories) {
  const categoryDir = new URL(`${category.categorySlug}/`, contentRoot);
  await mkdir(categoryDir, { recursive: true });
  for (const entry of category.entries) {
    order += 1;
    const slug = new URL(entry.url).pathname.split('/').filter(Boolean).at(-1);
    const contentFile = new URL(`${slug}.md`, categoryDir);
    try {
      await access(contentFile);
      continue;
    } catch {
      // Không ghi đè những bản dịch đã có.
    }
    const frontmatter = [
      '---',
      `code: "${entry.code}"`,
      `urlCode: "${entry.urlCode}"`,
      `titleEn: ${JSON.stringify(entry.title)}`,
      'titleVi: ""',
      `category: ${JSON.stringify(category.category)}`,
      `categorySlug: ${JSON.stringify(category.categorySlug)}`,
      `sourceUrl: ${JSON.stringify(entry.url)}`,
      `order: ${order}`,
      'translationStatus: placeholder',
      'draft: false',
      '---',
      '',
      '*Nội dung bản dịch tiếng Việt sẽ được bổ sung tại đây.*',
      '',
    ].join('\n');
    await writeFile(contentFile, frontmatter, 'utf8');
  }
}

console.log(`Indexed ${index.entryCount} entries in ${index.categoryCount} categories from ${index.crawledPageCount} pages.`);
for (const category of categories) console.log(`${category.categorySlug}: ${category.entries.length}`);
