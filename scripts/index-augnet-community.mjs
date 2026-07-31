import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = 'https://augnet.osa.org.au/order-of-st-augustine/community/';
const dataFile = new URL('src/data/augnet-community-index.json', root);
const contentRoot = new URL('src/content/augnet-community/', root);
const cacheFile = new URL('temp_/augnet-community-crawl-cache.json', root);

const groups = {
  community: {
    category: 'Community Life',
    categoryVi: 'Đời Sống Cộng Đoàn',
    codes: ['3103', '3104', '3112'],
  },
  charism: {
    category: 'Augustinian Charism',
    categoryVi: 'Đặc Sủng',
    codes: ['3106', '3113'],
  },
  vows: {
    category: 'Religious Vows',
    categoryVi: 'Các Lời Khấn',
    codes: ['3108', '3109', '3110', '3111'],
  },
  vocation: {
    category: 'Vocation and Membership',
    categoryVi: 'Ơn Gọi và Gia Nhập Dòng',
    codes: ['3115'],
  },
};

const translations = {
  '3103': 'Những Khía Cạnh của Đời Sống Cộng Đoàn',
  '3104': 'Cộng Đoàn và Sứ Vụ Tông Đồ',
  '3106': 'Đặc Sủng',
  '3108': 'Ba Lời Khấn',
  '3109': 'Đức Nghèo Khó',
  '3110': 'Đức Khiết Tịnh',
  '3111': 'Đức Vâng Phục',
  '3112': 'Đời Sống Augustinô',
  '3113': 'Thánh Augustinô và Thánh Biển Đức',
  '3115': 'Gia Nhập Dòng Thánh Augustinô',
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
      url.pathname = url.pathname.replace(/^\/en(?=\/order-of-st-augustine\/community\/)/, '');
    }
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return '';
  }
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
      if (!response.ok) return { status: response.status, h1: '', links: [] };
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
      if (attempt === 5) throw error;
      await wait(800 * (attempt + 1));
    }
  }
}

function remember(url, label = '') {
  if (!url.startsWith(source)) return;
  const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  const urlMatch = slug.match(/^(\d{4}[a-z]?)-/i);
  if (!urlMatch) return;
  const cleanLabel = decodeHtml(label);
  const labelMatch = cleanLabel.match(/^(\d{4}[a-z]?)\s+(.+)$/i);
  const code = (labelMatch?.[1] ?? urlMatch[1]).toUpperCase();
  const title = labelMatch?.[2]?.trim() || cleanLabel.replace(/^\d{4}[a-z]?\s+/i, '') || slug.replace(/^\d{4}[a-z]?-/i, '').replaceAll('-', ' ');
  found.set(url, { code, title, fullTitle: `${code} ${title}`, url });
}

while (queue.length) {
  const batch = queue.splice(0, 4);
  await Promise.all(batch.map(async (url) => {
    if (visited.has(url)) return;
    visited.add(url);
    const page = await fetchPage(url);
    if (!page || page.status !== 200) return;
    remember(url, page.h1);
    for (const [href, label] of page.links) {
      const absolute = normalizeUrl(href, url);
      if (!absolute.startsWith(source)) continue;
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
const entries = [...found.values()].sort((a, b) => collator.compare(a.code, b.code));
const categoryFor = (code) => Object.entries(groups).find(([, value]) => value.codes.includes(code));
const categories = Object.entries(groups).map(([categorySlug, meta]) => ({
  category: meta.category,
  categoryVi: meta.categoryVi,
  categorySlug,
  entries: entries.filter((entry) => meta.codes.includes(entry.code)),
}));

const ungrouped = entries.filter((entry) => !categoryFor(entry.code));
if (ungrouped.length) throw new Error(`Chưa phân nhóm mã: ${ungrouped.map((entry) => entry.code).join(', ')}`);
if (entries.length !== Object.keys(translations).length) throw new Error(`Số bài không khớp: ${entries.length}`);

const index = {
  source,
  indexedAt: new Date().toISOString().slice(0, 10),
  crawledPageCount: visited.size,
  categoryCount: categories.length,
  entryCount: entries.length,
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
      // Không ghi đè nội dung người dùng đã bổ sung.
    }
    const frontmatter = [
      '---',
      `code: "${entry.code}"`,
      `titleEn: ${JSON.stringify(entry.title)}`,
      `titleVi: ${JSON.stringify(translations[entry.code])}`,
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

console.log(`Indexed ${index.entryCount} Community entries in ${index.categoryCount} categories from ${index.crawledPageCount} pages.`);
for (const category of categories) console.log(`${category.categorySlug}: ${category.entries.length}`);
