import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = 'https://augnet.osa.org.au/works-of-augustine/';
const dataFile = new URL('src/data/augnet-works-index.json', root);
const contentRoot = new URL('src/content/augustine-works/', root);

const categoryMeta = {
  'writings-of-augustine': {
    category: 'Writings of Augustine',
    categoryVi: 'Tác Phẩm của Thánh Augustinô',
  },
  'his-spiritual-tradition': {
    category: 'His Spiritual Tradition',
    categoryVi: 'Truyền Thống Linh Đạo',
  },
  'his-ideas': {
    category: 'His Ideas',
    categoryVi: 'Tư Tưởng của Thánh Augustinô',
  },
  'his-impact': {
    category: 'His Impact',
    categoryVi: 'Ảnh Hưởng của Thánh Augustinô',
  },
};

const sectionMeta = {
  'city-of-god': { section: 'City of God', sectionVi: 'Thành Đô Thiên Chúa' },
  confessions: { section: 'Confessions', sectionVi: 'Tự Thuật' },
  'his-sermons': { section: 'His Sermons', sectionVi: 'Các Bài Giảng' },
  'his-letters': { section: 'His Letters', sectionVi: 'Thư Từ' },
  theology: { section: 'Theology', sectionVi: 'Thần Học' },
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
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return '';
  }
};

const queue = [source];
const visited = new Set();
const found = new Map();

while (queue.length) {
  const url = queue.shift();
  if (!url || visited.has(url)) continue;
  visited.add(url);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const html = await response.text();
  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const match of anchors) {
    const absolute = normalizeUrl(match[1], url);
    if (!absolute.startsWith(source)) continue;
    const relative = absolute.slice(source.length);
    const coded = relative.match(/(?:^|\/)(\d{4}[a-z]?-[^/]+)\/$/i);

    if (coded) {
      const slug = coded[1];
      const code = slug.match(/^\d{4}[a-z]?/i)?.[0].toUpperCase();
      if (!code) continue;
      const segments = relative.split('/').filter(Boolean);
      const categorySlug = segments[0];
      if (!categoryMeta[categorySlug]) continue;
      const sectionSlug = segments.length > 2 ? segments[1] : '';
      let fullTitle = decodeHtml(match[2]);
      if (!new RegExp(`^${code}\\s+`, 'i').test(fullTitle)) {
        const fallback = slug.replace(/^\d{4}[a-z]?-/i, '').replaceAll('-', ' ');
        fullTitle = `${code} ${fallback}`;
      }
      const title = fullTitle.replace(/^\d{4}[a-z]?\s+/i, '').trim();
      found.set(absolute, { code, title, fullTitle: `${code} ${title}`, url: absolute, categorySlug, sectionSlug });
      continue;
    }

    if (relative && !visited.has(absolute) && !queue.includes(absolute)) queue.push(absolute);
  }
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const allEntries = [...found.values()].sort((a, b) => collator.compare(a.code, b.code));
const categories = Object.entries(categoryMeta).map(([categorySlug, meta]) => {
  const entries = allEntries
    .filter((entry) => entry.categorySlug === categorySlug)
    .map((entry) => ({
      code: entry.code,
      title: entry.title,
      fullTitle: entry.fullTitle,
      url: entry.url,
      section: sectionMeta[entry.sectionSlug]?.section ?? '',
      sectionVi: sectionMeta[entry.sectionSlug]?.sectionVi ?? '',
      sectionSlug: entry.sectionSlug,
    }));
  return { ...meta, categorySlug, entries };
});

const index = {
  source,
  indexedAt: new Date().toISOString().slice(0, 10),
  categoryCount: categories.length,
  entryCount: allEntries.length,
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
      // Chỉ sinh placeholder mới; không ghi đè bản dịch đã được biên tập.
    }
    const frontmatter = [
      '---',
      `code: "${entry.code}"`,
      `titleEn: ${JSON.stringify(entry.title)}`,
      'titleVi: ""',
      `category: ${JSON.stringify(category.category)}`,
      `categorySlug: ${JSON.stringify(category.categorySlug)}`,
      `section: ${JSON.stringify(entry.section)}`,
      `sectionVi: ${JSON.stringify(entry.sectionVi)}`,
      `sectionSlug: ${JSON.stringify(entry.sectionSlug)}`,
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

console.log(`Indexed ${index.entryCount} entries in ${index.categoryCount} categories from ${visited.size} hub pages.`);
