/**
 * Content Studio API — biên tập các collection trong src/content.
 * Chạy: npm run admin (port 4322). Astro sẽ hot-reload khi source thay đổi.
 */
import http from 'http';
import fs   from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT          = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(ROOT, '.env.local')); } catch (error) {
  if (error?.code !== 'ENOENT') console.warn('Không thể đọc .env.local:', error.message);
}
const CONTENT       = path.join(ROOT, 'src/content/kinh-sach');
const SAINTS_DIR    = path.join(ROOT, 'src/content/thanh-chan-phuoc');
const INDEX_PATH    = path.join(ROOT, 'src/data/kinh-sach-index.json');
const BANNERS_PATH  = path.join(ROOT, 'src/data/banners.json');
const HEADERS_PATH  = path.join(ROOT, 'src/data/page-headers.json');
const ON_GOI_PATH   = path.join(ROOT, 'src/data/on-goi-content.json');
const BANNERS_IMG   = path.join(ROOT, 'public/images/banners');
const SAINTS_IMG    = path.join(ROOT, 'public/db/saints/images');
const ARTICLE_IMG   = path.join(ROOT, 'src/assets');
const ARTICLE_UPLOAD_IMG = path.join(ARTICLE_IMG, 'bai-viet');
const PUBLIC_IMG_ROOT = path.join(ROOT, 'public');
const VOCATION_IMG = path.join(ROOT, 'public/images/on-goi');
const SAINT_INDEX   = path.join(ROOT, 'src/data/saint-index.json');
const TIMELINE_OVERRIDES_PATH = path.join(ROOT, 'src/data/augustine-timeline-overrides.json');
const ARTICLE_TAXONOMY_PATH = path.join(ROOT, 'src/data/article-taxonomy.json');
const PORT          = 4322;
const UTF8          = { encoding: 'utf8' };

const STUDIO_TRASH = path.join(ROOT, 'temp_', 'studio-trash');
const STUDIO_COLLECTIONS = [
  {
    key: 'banners', label: 'Banner & trích dẫn', group: 'Giao diện', icon: '▧', create: false,
    root: path.dirname(BANNERS_PATH), folder: false, virtual: 'banners',
    fields: [
      ['imageUrl', 'Ảnh banner', 'image', true, ['banners']],
      ['altText', 'Mô tả ảnh', 'text'],
      ['quoteText', 'Trích dẫn đầu trang', 'textarea'],
      ['quoteCite', 'Nguồn trích dẫn', 'textarea'],
    ],
  },
  {
    key: 'bai-viet', label: 'Bài viết', group: 'Xuất bản', icon: '✦', create: true,
    root: path.join(ROOT, 'src/content/bai-viet'), folder: true,
    fields: [
      ['title', 'Tiêu đề', 'text', true], ['subtitle', 'Phụ đề', 'text'],
      ['author', 'Tác giả', 'text'], ['authorDetails', 'Thông tin tác giả', 'list'],
      ['category', 'Chuyên mục', 'text'], ['subcategory', 'Chuyên mục con', 'text'],
      ['excerpt', 'Mô tả ngắn', 'textarea'], ['date', 'Ngày đăng', 'date'],
      ['readings', 'Bài đọc phụng vụ', 'list'], ['tags', 'Từ khóa', 'list'],
      ['image', 'Thumbnail', 'text'], ['heroImage', 'Ảnh hero', 'text'],
      ['language', 'Ngôn ngữ', 'select', false, ['vi', 'en']], ['translationOf', 'Bản chính', 'text'],
      ['featured', 'Bài nổi bật', 'boolean'], ['draft', 'Bản nháp', 'boolean'],
    ],
  },
  {
    key: 'kinh-sach', label: 'Bài đọc Kinh Sách', group: 'Xuất bản', icon: '☷', create: true,
    root: path.join(ROOT, 'src/content/kinh-sach'), folder: true,
    fields: [
      ['title', 'Tiêu đề', 'text', true], ['season', 'Mùa phụng vụ', 'text'],
      ['seasonKey', 'Mã mùa', 'text'], ['source', 'Tác giả / nguồn', 'text'],
      ['excerpt', 'Trích nguồn', 'text'], ['liturgy', 'Tên phụng vụ', 'text'],
      ['rank', 'Bậc lễ', 'text'], ['order', 'Thứ tự', 'number'], ['draft', 'Bản nháp', 'boolean'],
    ],
  },
  {
    key: 'thanh-chan-phuoc', label: 'Thánh – Chân phước', group: 'Xuất bản', icon: '✚', create: true,
    root: path.join(ROOT, 'src/content/thanh-chan-phuoc'), folder: false,
    fields: [
      ['title', 'Tên thánh', 'text', true], ['subtitle', 'Phụ đề', 'text'],
      ['rank', 'Bậc lễ', 'select', false, ['solemn', 'feast', 'memorial', 'none']],
      ['feastDay', 'Ngày lễ', 'number'], ['feastMonth', 'Tháng lễ', 'number'],
      ['imageFile', 'Ảnh thẻ thánh', 'image', false, ['saints']], ['draft', 'Bản nháp', 'boolean'],
      ['manualFill', 'Cần biên tập lại', 'boolean'],
    ],
  },
  {
    key: 'documents', label: 'Tu luật & tài liệu', group: 'Thư viện', icon: '▤', create: true,
    root: path.join(ROOT, 'src/content/documents'), folder: false,
    fields: [
      ['title', 'Tiêu đề', 'text', true], ['subtitle', 'Phụ đề', 'text'],
      ['docType', 'Loại tài liệu', 'text'], ['lang', 'Ngôn ngữ', 'select', false, ['vi', 'en']],
      ['translator', 'Dịch giả', 'text'], ['translatorNote', 'Ghi chú dịch thuật', 'textarea'],
      ['draft', 'Bản nháp', 'boolean'],
    ],
  },
  {
    key: 'tu-thuat', label: 'Tự Thuật', group: 'Thư viện', icon: 'Ⅹ', create: false,
    root: path.join(ROOT, 'src/content/tu-thuat'), folder: false,
    fields: [['title', 'Tiêu đề', 'text', true], ['order', 'Quyển', 'number'], ['draft', 'Bản nháp', 'boolean']],
  },
  {
    key: 'lich-su-dong', label: 'Lịch sử Dòng', group: 'Thư viện', icon: '⌛', create: true,
    root: path.join(ROOT, 'src/content/lich-su-dong'), folder: true,
    fields: [
      ['title', 'Tiêu đề', 'text', true], ['subtitle', 'Phụ đề', 'text'],
      ['period', 'Giai đoạn', 'text'], ['sourceNote', 'Nguồn', 'textarea'],
      ['excerpt', 'Mô tả', 'textarea'], ['order', 'Thứ tự', 'number'], ['draft', 'Bản nháp', 'boolean'],
    ],
  },
  {
    key: 'sach', label: 'Sách', group: 'Thư viện', icon: '▥', create: true,
    root: path.join(ROOT, 'src/content/sach'), folder: false,
    fields: [
      ['title', 'Tiêu đề', 'text', true], ['subtitle', 'Phụ đề', 'text'],
      ['author', 'Tác giả', 'text'], ['translator', 'Dịch giả', 'text'],
      ['excerpt', 'Mô tả', 'textarea'], ['publishYear', 'Năm xuất bản', 'text'],
      ['bookType', 'Loại sách', 'select', false, ['spiritual', 'philosophy', 'tu-thuat']],
      ['featured', 'Nổi bật', 'boolean'], ['order', 'Thứ tự', 'number'],
      ['image', 'Ảnh bìa', 'text'], ['draft', 'Bản nháp', 'boolean'],
    ],
  },
  ...[
    ['augustine-life', 'Cuộc đời Thánh Augustinô'],
    ['augustine-works', 'Tác phẩm Augnet'],
    ['augnet-history', 'Lịch sử Augnet'],
    ['augnet-community', 'Linh đạo Augnet'],
    ['augustine-encyclopedia', 'Bách khoa toàn thư'],
  ].map(([key, label]) => ({
    key, label, group: 'Kho tham chiếu', icon: '◫', create: false,
    root: path.join(ROOT, `src/content/${key}`), folder: true,
    fields: [
      ['title', 'Tiêu đề', 'text'], ['titleVi', 'Tiêu đề tiếng Việt', 'text'],
      ['titleEn', 'Tiêu đề tiếng Anh', 'text'], ['author', 'Tác giả', 'text'],
      ['category', 'Chuyên mục', 'text'], ['section', 'Phân mục', 'text'],
      ['sourceUrl', 'Liên kết nguồn', 'text'], ['sourcePages', 'Trang nguồn', 'text'],
      ['translationStatus', 'Trạng thái dịch', 'select', false, ['placeholder', 'draft', 'translated']],
      ['order', 'Thứ tự', 'number'], ['draft', 'Bản nháp', 'boolean'],
    ],
  })),
];

const studioCollection = key => STUDIO_COLLECTIONS.find(item => item.key === key);
const studioField = field => ({ key: field[0], label: field[1], type: field[2], required: !!field[3], options: field[4] || [] });

function studioScalar(raw = '') {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    try { return JSON.parse(value); } catch {}
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    try { return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1).replace(/''/g, "'"); } catch {}
  }
  return value;
}

function studioSplitMd(raw) {
  raw = raw.replace(/^\uFEFF/, '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: raw };
  const lines = match[1].split(/\r?\n/);
  const fm = {};
  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index].match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!row) continue;
    const [, key, rest] = row;
    if (rest.trim()) { fm[key] = studioScalar(rest); continue; }
    const values = [];
    while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
      index += 1;
      values.push(studioScalar(lines[index].replace(/^\s+-\s+/, '')));
    }
    fm[key] = values;
  }
  return { fm, body: match[2] };
}

function quoteSourceText(value = '') {
  return String(value)
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteSourceSnippet(value = '', max = 104) {
  const text = quoteSourceText(value);
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function integerToRoman(value) {
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let number = Number(value) || 0;
  let result = '';
  for (const [unit, roman] of map) while (number >= unit) { result += roman; number -= unit; }
  return result;
}

function documentQuoteSource(id, label, route) {
  const file = path.join(ROOT, 'src/content/documents', `${id}.md`);
  if (!fs.existsSync(file)) return { id, label, route, entries: [] };
  const { body } = studioSplitMd(fs.readFileSync(file, UTF8));
  const entries = [];
  const expression = /^(\d+)\\?\.\s+(.+)$/gm;
  let match;
  while ((match = expression.exec(body))) entries.push({ number: Number(match[1]), snippet: quoteSourceSnippet(match[2]) });
  return { id, label, route, entries };
}

function confessionQuoteSources() {
  const directory = path.join(ROOT, 'src/content/tu-thuat');
  const books = [];
  for (let number = 1; number <= 13; number += 1) {
    const file = path.join(directory, `quyen-${number}.md`);
    if (!fs.existsSync(file)) continue;
    const { body } = studioSplitMd(fs.readFileSync(file, UTF8));
    const chapters = [];
    let chapter = null;
    for (const line of body.split(/\r?\n/)) {
      const heading = line.match(/^####\s+(?:Đoạn|Chương)\s+([IVXLCDM]+)\b\s*:?\s*(.*)$/iu);
      if (heading) {
        chapter = { roman: heading[1].toUpperCase(), title: quoteSourceText(heading[2]), paragraphs: [] };
        chapters.push(chapter);
        continue;
      }
      const paragraph = line.match(/^(\d+)\s+(.+)$/u);
      if (chapter && paragraph) chapter.paragraphs.push({ number: Number(paragraph[1]), snippet: quoteSourceSnippet(paragraph[2]) });
    }
    books.push({ number, roman: integerToRoman(number), chapters });
  }
  return books;
}

function quoteSourceCatalog() {
  return {
    documents: [
      documentQuoteSource('tu-luat-vi', 'Tu Luật', '/tu-luat/'),
      documentQuoteSource('hien-phap-vi', 'Hiến Pháp', '/hien-phap/'),
      documentQuoteSource('ratio-vi', 'Ratio Institutionis', '/ratio/'),
    ],
    confessions: confessionQuoteSources(),
  };
}

function studioYamlValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(String(value ?? ''));
}

function studioToMd(collection, fm, body) {
  const preferred = collection.fields.map(field => field[0]);
  const keys = [...preferred, ...Object.keys(fm).filter(key => !preferred.includes(key))]
    .filter((key, index, all) => all.indexOf(key) === index && fm[key] !== undefined && fm[key] !== null && fm[key] !== '');
  const lines = ['---'];
  for (const key of keys) {
    const value = fm[key];
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value.filter(item => String(item).trim())) lines.push(`  - ${studioYamlValue(item)}`);
    } else lines.push(`${key}: ${studioYamlValue(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n') + String(body || '').trimEnd() + '\n';
}

function rebaseRelativeAsset(value, oldFile, newFile) {
  const source = String(value || '');
  if (!source || !/^\.\.?[\\/]/.test(source)) return source;
  const absolute = path.resolve(path.dirname(oldFile), source.replace(/\//g, path.sep));
  let relative = path.relative(path.dirname(newFile), absolute).replace(/\\/g, '/');
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative;
}

function rebaseArticleBodyAssets(body, oldFile, newFile) {
  if (oldFile === newFile) return String(body || '');
  return String(body || '')
    .replace(/(\]\()((?:\.\.?\/)[^\s)]+)(?=[\s)]|$)/g, (_, prefix, value) => `${prefix}${rebaseRelativeAsset(value, oldFile, newFile)}`)
    .replace(/((?:src|href)=["'])((?:\.\.?\/)[^"']+)(["'])/g, (_, prefix, value, suffix) => `${prefix}${rebaseRelativeAsset(value, oldFile, newFile)}${suffix}`);
}

function studioFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.mdx?$/i.test(entry.name)) result.push(full);
    }
  };
  walk(root);
  return result;
}

function studioId(collection, file) {
  return path.relative(collection.root, file).replace(/\\/g, '/').replace(/\.mdx?$/i, '');
}

function studioPath(collection, id, extension = '.md') {
  const clean = String(id || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.split('/').some(part => !part || part === '.' || part === '..' || !/^[a-zA-Z0-9._-]+$/.test(part))) {
    throw new Error('ID hoặc slug không hợp lệ');
  }
  const file = path.resolve(collection.root, clean + extension);
  const root = path.resolve(collection.root) + path.sep;
  if (!file.startsWith(root)) throw new Error('Đường dẫn nằm ngoài collection');
  return file;
}

function studioRoute(collectionKey, id) {
  const bits = id.split('/');
  const slug = bits.at(-1);
  const folder = bits.slice(0, -1).join('/');
  if (collectionKey === 'bai-viet') {
    if (folder === 'linh-dao') return `/linh-dao/bai-viet/${slug}/`;
    if (folder === 'bai-giang-suy-niem') return `/bai-giang-suy-niem/${slug}/`;
    if (folder === 'sinh-hoat-cong-doan') return `/tin-tuc/${id}/`;
    return `/bai-viet/${id}/`;
  }
  if (collectionKey === 'kinh-sach') return `/kinh-sach/${id}/`;
  if (collectionKey === 'thanh-chan-phuoc') return `/thanh-chan-phuoc/${id}/`;
  if (collectionKey === 'tu-thuat') return `/tu-thuat/?book=${encodeURIComponent(slug)}`;
  if (collectionKey === 'lich-su-dong') return `/lich-su-dong/${id}/`;
  if (collectionKey === 'augustine-life') return `/thanh-au-tinh/tieu-su/${slug}/`;
  if (collectionKey === 'augustine-works') return `/thanh-au-tinh/tac-pham/${slug}/`;
  if (collectionKey === 'augustine-encyclopedia') return `/thanh-au-tinh/bach-khoa/${slug}/`;
  return '';
}

function studioExistingPath(collection, id) {
  if (collection.virtual === 'banners') return BANNERS_PATH;
  for (const extension of ['.md', '.mdx']) {
    const file = studioPath(collection, id, extension);
    if (fs.existsSync(file)) return file;
  }
  return studioPath(collection, id, '.md');
}

function articleTaxonomy() {
  return JSON.parse(fs.readFileSync(ARTICLE_TAXONOMY_PATH, UTF8));
}

function articleTaxonomySlug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function articleKindFiles(kind, categories) {
  const articleCollection = studioCollection('bai-viet');
  const folders = new Set(categories.map(category => category.folder));
  return studioFiles(articleCollection.root).filter(file => {
    const id = studioId(articleCollection, file);
    const folder = id.split('/').slice(0, -1).join('/');
    if (kind === 'news') return folder === 'sinh-hoat-cong-doan';
    if (kind === 'spirituality') return folder === 'linh-dao';
    return folders.has(folder);
  });
}

function rewriteArticleCategory(kind, categories, oldLabel, nextCategory) {
  const articleCollection = studioCollection('bai-viet');
  const files = articleKindFiles(kind, categories);
  const changes = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, UTF8);
    const { fm, body } = studioSplitMd(raw);
    if (fm.category !== oldLabel) continue;
    changes.push({ file, nextFile: file, fm: { ...fm, category: nextCategory.label }, body });
  }
  for (const change of changes) {
    fs.mkdirSync(path.dirname(change.nextFile), { recursive: true });
    fs.writeFileSync(change.nextFile, studioToMd(articleCollection, change.fm, change.body), UTF8);
    if (change.nextFile !== change.file) fs.unlinkSync(change.file);
  }
  return changes.length;
}

function rewriteArticleSubcategory(kind, categories, categoryLabel, oldLabel, nextLabel = '') {
  const articleCollection = studioCollection('bai-viet');
  const files = articleKindFiles(kind, categories);
  let changed = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file, UTF8);
    const { fm, body } = studioSplitMd(raw);
    if (fm.category !== categoryLabel || fm.subcategory !== oldLabel) continue;
    const nextFm = { ...fm, subcategory: nextLabel };
    fs.writeFileSync(file, studioToMd(articleCollection, nextFm, body), UTF8);
    changed += 1;
  }
  return changed;
}

function bannerRecords() {
  const all = JSON.parse(fs.readFileSync(BANNERS_PATH, UTF8));
  const records = [];
  for (const [key, raw] of Object.entries(all)) {
    const variants = Array.isArray(raw) ? raw : [raw];
    variants.forEach((value, index) => records.push({
      id: variants.length > 1 ? `${key}.${index + 1}` : key,
      key,
      index,
      value,
      variants: variants.length,
    }));
  }
  return { all, records };
}

function bannerRecord(id) {
  return bannerRecords().records.find(record => record.id === id);
}

function bannerRoute(key) {
  return ({
    home: '/', 'bai-viet-triet-hoc': '/bai-viet/', 'bai-viet-than-hoc': '/bai-viet/',
    'bai-giang-suy-niem': '/bai-giang-suy-niem/', readings: '/kinh-sach/', reader: '/kinh-sach/',
    saints: '/thanh-chan-phuoc/', documents: '/hien-phap/', 'tu-luat': '/tu-luat/',
    'thu-vien': '/linh-dao/', 'lich-phung-vu': '/lich-phung-vu/', 'tu-thuat': '/tu-thuat/',
    'lich-su-dong': '/lich-su-dong/', 'thanh-au-tinh': '/thanh-au-tinh/',
  })[key] || '';
}

function syncSaintIndex(id, fm) {
  if (!fs.existsSync(SAINT_INDEX)) return;
  const data = JSON.parse(fs.readFileSync(SAINT_INDEX, UTF8));
  let found = null;
  let sourceMonth = null;
  let changed = false;
  for (const month of data.months || []) {
    for (const saint of month.saints || []) {
      const slug = path.basename(String(saint.bioFile || ''), path.extname(String(saint.bioFile || '')));
      if (slug !== id) continue;
      found = saint;
      sourceMonth = month;
      if (typeof fm.title === 'string' && fm.title.trim() && saint.name !== fm.title.trim()) { saint.name = fm.title.trim(); changed = true; }
      if (typeof fm.imageFile === 'string' && saint.imageFile !== fm.imageFile) { saint.imageFile = fm.imageFile; changed = true; }
      if (typeof fm.rank === 'string' && saint.rank !== fm.rank) { saint.rank = fm.rank; changed = true; }
      if (Number.isFinite(Number(fm.feastDay)) && Number(saint.day) !== Number(fm.feastDay)) { saint.day = Number(fm.feastDay); changed = true; }
      break;
    }
    if (found) break;
  }
  if (!found) return;
  const targetMonthNumber = Number(fm.feastMonth);
  if (Number.isFinite(targetMonthNumber) && targetMonthNumber !== Number(sourceMonth?.monthNumber)) {
    const targetMonth = (data.months || []).find(month => Number(month.monthNumber) === targetMonthNumber);
    if (targetMonth) {
      sourceMonth.saints = sourceMonth.saints.filter(saint => saint !== found);
      targetMonth.saints.push(found);
      targetMonth.saints.sort((a, b) => Number(a.day) - Number(b.day));
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(SAINT_INDEX, JSON.stringify(data, null, 2) + '\n', UTF8);
}

function syncAllSaintIndexEntries() {
  if (!fs.existsSync(SAINTS_DIR) || !fs.existsSync(SAINT_INDEX)) return;
  for (const file of fs.readdirSync(SAINTS_DIR).filter(name => name.endsWith('.md'))) {
    const id = file.slice(0, -3);
    const { fm } = studioSplitMd(fs.readFileSync(path.join(SAINTS_DIR, file), UTF8));
    syncSaintIndex(id, fm);
  }
}

async function studioSubmitToGitHub(collection, id, message) {
  const token = process.env.STUDIO_GITHUB_TOKEN;
  const repository = process.env.STUDIO_GITHUB_REPO;
  const branch = process.env.STUDIO_GITHUB_BRANCH || 'main';
  if (!token || !repository) {
    return { configured: false, message: 'Chưa cấu hình STUDIO_GITHUB_TOKEN và STUDIO_GITHUB_REPO.' };
  }
  const file = studioExistingPath(collection, id);
  if (!fs.existsSync(file)) throw new Error('Không tìm thấy file để submit');
  const files = [file];
  const addPublicAsset = rawUrl => {
    const urlPath = String(rawUrl || '').split(/[?#]/)[0];
    if (!urlPath.startsWith('/')) return;
    const asset = path.resolve(ROOT, 'public', urlPath.slice(1));
    const publicRoot = path.resolve(ROOT, 'public') + path.sep;
    if (asset.startsWith(publicRoot) && fs.existsSync(asset)) files.push(asset);
  };
  if (collection.key === 'thanh-chan-phuoc') {
    const { fm } = studioSplitMd(fs.readFileSync(file, UTF8));
    files.push(SAINT_INDEX);
    addPublicAsset(fm.imageFile);
  } else if (collection.virtual === 'banners') {
    addPublicAsset(bannerRecord(id)?.value?.imageUrl);
  }
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'osa-vietnam-content-studio',
  };
  const commits = [];
  for (const sourceFile of [...new Set(files.filter(candidate => fs.existsSync(candidate)))]) {
    const repoPath = path.relative(ROOT, sourceFile).replace(/\\/g, '/');
    const endpoint = `https://api.github.com/repos/${repository}/contents/${repoPath}`;
    let sha;
    const current = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
    if (current.ok) sha = (await current.json()).sha;
    else if (current.status !== 404) throw new Error(`GitHub không đọc được ${repoPath} (${current.status})`);
    const payload = {
      message: message || `content: update ${id}`,
      content: Buffer.from(fs.readFileSync(sourceFile)).toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    };
    const response = await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `GitHub trả về ${response.status}`);
    commits.push({ path: repoPath, url: result.commit?.html_url || '' });
  }
  return { configured: true, commit: commits.at(-1)?.url || '', commits, path: commits[0]?.path || '', branch };
}

// ─── Frontmatter helpers ────────────────────────────────────────────────────

function splitMd(raw) {
  raw = raw.replace(/^﻿/, ''); // strip UTF-8 BOM (PowerShell 5.1 adds it)
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  return { fm: parseFm(m[1]), body: m[2] };
}

function parseFm(text) {
  const fm = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v === 'true')       v = true;
    else if (v === 'false') v = false;
    else if (/^\d+$/.test(v)) v = +v;
    else if (/^["'][\s\S]*["']$/.test(v)) v = v.slice(1, -1);
    fm[m[1]] = v;
  }
  return fm;
}

const FM_KEYS       = ['title','season','seasonKey','source','excerpt','liturgy','rank','order','draft','manualFill'];
const SAINT_FM_KEYS = ['title','subtitle','rank','feastDay','feastMonth','imageFile','draft','manualFill'];

function toMd(fm, body) {
  const q = v =>
    typeof v === 'boolean' ? String(v) :
    typeof v === 'number'  ? String(v) :
    `"${String(v ?? '').replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
  const lines = ['---', ...FM_KEYS.filter(k => k in fm).map(k => `${k}: ${q(fm[k])}`), '---', ''];
  return lines.join('\n') + (body || '').trim();
}

// ─── Index rebuild ───────────────────────────────────────────────────────────

function rebuildIndex() {
  const index = {};
  for (const season of fs.readdirSync(CONTENT).sort()) {
    const dir = path.join(CONTENT, season);
    if (!fs.statSync(dir).isDirectory()) continue;
    const entries = [];
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
      const slug = file.slice(0, -3);
      const { fm } = splitMd(fs.readFileSync(path.join(dir, file), UTF8));
      if (fm.draft === true) continue;
      entries.push({
        id:      `${season}/${slug}`,
        slug,
        url:     `/kinh-sach/${season}/${slug}/`,
        author:  String(fm.source  || ''),
        excerpt: String(fm.excerpt || ''),
        liturgy: String(fm.liturgy || fm.title || ''),
        rank:    String(fm.rank    || ''),
        _ord:    Number(fm.order)  || 0,
      });
    }
    entries.sort((a, b) => a._ord - b._ord).forEach(e => delete e._ord);
    if (entries.length) index[season] = entries;
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index), UTF8);
  console.log(`[rebuild] index.json — ${Object.values(index).flat().length} bài`);
  return index;
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const requestOrigin = req.headers.origin || '';
  if (/^http:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):4321$/.test(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const p    = url.pathname;
  const json = (d, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json;charset=utf-8' }); res.end(JSON.stringify(d)); };
  const err  = (msg, s = 400) => json({ error: msg }, s);

  try {
    if (p === '/api/studio/quote-sources' && req.method === 'GET') {
      return json(quoteSourceCatalog());
    }

    // Inline editor: niên biểu Thánh Augustinô.
    if (p === '/api/studio/timeline' && req.method === 'GET') {
      const overrides = fs.existsSync(TIMELINE_OVERRIDES_PATH)
        ? JSON.parse(fs.readFileSync(TIMELINE_OVERRIDES_PATH, UTF8))
        : {};
      return json({ overrides });
    }

    if (p === '/api/studio/timeline' && req.method === 'PUT') {
      const payload = await readBody(req);
      const id = String(payload.id || '');
      if (!/^timeline-\d{3}$/.test(id)) return err('Mã sự kiện không hợp lệ');
      const input = payload.patch && typeof payload.patch === 'object' ? payload.patch : {};
      const allowed = ['year', 'augEn', 'augVi', 'worldEn', 'worldVi', 'eraEn', 'eraVi', 'major'];
      const patch = {};
      for (const key of allowed) {
        if (!(key in input)) continue;
        patch[key] = key === 'major' ? Boolean(input[key]) : String(input[key] ?? '').trim();
      }
      const overrides = fs.existsSync(TIMELINE_OVERRIDES_PATH)
        ? JSON.parse(fs.readFileSync(TIMELINE_OVERRIDES_PATH, UTF8))
        : {};
      overrides[id] = { ...(overrides[id] || {}), ...patch };
      fs.writeFileSync(TIMELINE_OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + '\n', UTF8);
      return json({ ok: true, id, value: overrides[id] });
    }

    // ── Content Studio API ────────────────────────────────────────────────
    if (p === '/api/studio/manifest' && req.method === 'GET') {
      return json({
        mode: 'local',
        githubConfigured: !!(process.env.STUDIO_GITHUB_TOKEN && process.env.STUDIO_GITHUB_REPO),
        repository: process.env.STUDIO_GITHUB_REPO || '',
        branch: process.env.STUDIO_GITHUB_BRANCH || 'main',
        collections: STUDIO_COLLECTIONS.map(collection => ({
          key: collection.key,
          label: collection.label,
          group: collection.group,
          icon: collection.icon,
          create: collection.create,
          folder: collection.folder,
          virtual: collection.virtual || '',
          fields: collection.fields.map(studioField),
        })),
      });
    }

    if (p === '/api/studio/article-taxonomy' && req.method === 'GET') {
      const kind = url.searchParams.get('kind');
      const taxonomy = articleTaxonomy();
      if (!kind || !taxonomy[kind]) return err('Nhóm bài viết không hợp lệ');
      return json({ kind, categories: taxonomy[kind].categories || [] });
    }

    if (p === '/api/studio/article-taxonomy' && req.method === 'PUT') {
      const payload = await readBody(req);
      const kind = String(payload.kind || '');
      const action = String(payload.action || '');
      const taxonomy = articleTaxonomy();
      if (!taxonomy[kind] || !['news', 'scholar', 'spirituality', 'sermon'].includes(kind)) return err('Nhóm bài viết không hợp lệ');
      const categories = taxonomy[kind].categories || [];
      const label = String(payload.label || '').trim();
      if (!label) return err('Tên chuyên mục không được để trống');

      if (action === 'add') {
        if (categories.some(category => category.label.toLocaleLowerCase('vi') === label.toLocaleLowerCase('vi'))) return err('Chuyên mục đã tồn tại', 409);
        const folder = kind === 'news' ? 'sinh-hoat-cong-doan' : kind === 'spirituality' ? 'linh-dao' : kind === 'sermon' ? 'bai-giang-suy-niem' : articleTaxonomySlug(label);
        if (!folder) return err('Không thể tạo mã thư mục cho chuyên mục');
        categories.push({ label, folder, tone: kind === 'news' ? 'news' : kind === 'spirituality' ? 'spirituality' : kind === 'sermon' ? 'liturgy' : 'neutral', subcategories: [] });
      } else if (action === 'rename') {
        const category = categories.find(item => item.label === label);
        const nextLabel = String(payload.nextLabel || '').trim();
        if (!category) return err('Không tìm thấy chuyên mục', 404);
        if (!nextLabel) return err('Tên chuyên mục mới không hợp lệ');
        if (categories.some(item => item !== category && item.label.toLocaleLowerCase('vi') === nextLabel.toLocaleLowerCase('vi'))) return err('Tên chuyên mục mới đã tồn tại', 409);
        const oldLabel = category.label;
        category.label = nextLabel;
        rewriteArticleCategory(kind, categories, oldLabel, category);
      } else if (action === 'delete') {
        if (categories.length < 2) return err('Phải giữ lại ít nhất một chuyên mục');
        const index = categories.findIndex(item => item.label === label);
        const replacement = categories.find(item => item.label === String(payload.replacement || ''));
        if (index < 0) return err('Không tìm thấy chuyên mục', 404);
        if (!replacement || replacement.label === label) return err('Cần chọn chuyên mục nhận các bài hiện có');
        rewriteArticleCategory(kind, categories, label, replacement);
        categories.splice(index, 1);
      } else if (action === 'add-subcategory') {
        const category = categories.find(item => item.label === label);
        const subcategory = String(payload.subcategory || '').trim();
        if (!category) return err('Không tìm thấy chuyên mục', 404);
        if (!subcategory) return err('Tên chuyên mục con không được để trống');
        category.subcategories ||= [];
        if (category.subcategories.some(item => item.toLocaleLowerCase('vi') === subcategory.toLocaleLowerCase('vi'))) return err('Chuyên mục con đã tồn tại', 409);
        category.subcategories.push(subcategory);
      } else if (action === 'rename-subcategory') {
        const category = categories.find(item => item.label === label);
        const subcategory = String(payload.subcategory || '').trim();
        const nextLabel = String(payload.nextLabel || '').trim();
        if (!category) return err('Không tìm thấy chuyên mục', 404);
        const index = (category.subcategories || []).findIndex(item => item === subcategory);
        if (index < 0) return err('Không tìm thấy chuyên mục con', 404);
        if (!nextLabel) return err('Tên chuyên mục con mới không hợp lệ');
        if (category.subcategories.some((item, itemIndex) => itemIndex !== index && item.toLocaleLowerCase('vi') === nextLabel.toLocaleLowerCase('vi'))) return err('Tên chuyên mục con mới đã tồn tại', 409);
        rewriteArticleSubcategory(kind, categories, category.label, subcategory, nextLabel);
        category.subcategories[index] = nextLabel;
      } else if (action === 'delete-subcategory') {
        const category = categories.find(item => item.label === label);
        const subcategory = String(payload.subcategory || '').trim();
        const replacement = String(payload.replacement || '').trim();
        if (!category) return err('Không tìm thấy chuyên mục', 404);
        const index = (category.subcategories || []).findIndex(item => item === subcategory);
        if (index < 0) return err('Không tìm thấy chuyên mục con', 404);
        if (replacement && !category.subcategories.some(item => item === replacement && item !== subcategory)) return err('Chuyên mục con nhận bài không tồn tại');
        rewriteArticleSubcategory(kind, categories, category.label, subcategory, replacement);
        category.subcategories.splice(index, 1);
      } else return err('Thao tác chuyên mục không hợp lệ');

      fs.writeFileSync(ARTICLE_TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2) + '\n', UTF8);
      return json({ ok: true, kind, categories, action });
    }

    if (p === '/api/studio/items' && req.method === 'GET') {
      const collection = studioCollection(url.searchParams.get('collection'));
      if (!collection) return err('Collection không hợp lệ');
      if (collection.virtual === 'banners') {
        const items = bannerRecords().records.map(record => ({
          id: record.id,
          title: record.variants > 1 ? `${record.key} · banner ${record.index + 1}` : record.key,
          subtitle: String(record.value.altText || ''),
          draft: false,
          status: 'published',
          hasContent: !!record.value.quoteText,
          updatedAt: fs.statSync(BANNERS_PATH).mtime.toISOString(),
          route: bannerRoute(record.key),
          folder: '',
        }));
        return json({ collection: collection.key, items });
      }
      const items = studioFiles(collection.root).map(file => {
        const id = studioId(collection, file);
        const { fm, body } = studioSplitMd(fs.readFileSync(file, UTF8));
        const stat = fs.statSync(file);
        return {
          id,
          title: String(fm.titleVi || fm.title || fm.titleEn || id),
          subtitle: String(fm.subtitle || fm.category || fm.author || ''),
          category: String(fm.category || ''),
          draft: fm.draft === true || fm.translationStatus === 'draft' || fm.translationStatus === 'placeholder',
          status: fm.translationStatus || (fm.draft === true ? 'draft' : 'published'),
          language: String(fm.language || (id.endsWith('-en') ? 'en' : 'vi')),
          translationOf: String(fm.translationOf || ''),
          featured: fm.featured === true,
          hasContent: body.trim().length > 0,
          updatedAt: stat.mtime.toISOString(),
          route: studioRoute(collection.key, id),
          folder: id.includes('/') ? id.split('/').slice(0, -1).join('/') : '',
        };
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return json({ collection: collection.key, items });
    }

    if (p === '/api/studio/item' && req.method === 'GET') {
      const collection = studioCollection(url.searchParams.get('collection'));
      const id = url.searchParams.get('id');
      if (!collection || !id) return err('Thiếu collection hoặc id');
      if (collection.virtual === 'banners') {
        const record = bannerRecord(id);
        if (!record) return err('Không tìm thấy banner', 404);
        const raw = fs.readFileSync(BANNERS_PATH, UTF8);
        return json({
          id,
          fm: { ...record.value },
          body: '',
          route: bannerRoute(record.key),
          extension: '.json',
          checksum: createHash('sha256').update(raw).digest('hex'),
          relativePath: `src/data/banners.json · ${id}`,
          bannerKey: record.key,
          variantIndex: record.index,
        });
      }
      const file = studioExistingPath(collection, id);
      if (!fs.existsSync(file)) return err('Không tìm thấy nội dung', 404);
      const raw = fs.readFileSync(file, UTF8);
      const { fm, body } = studioSplitMd(raw);
      return json({
        id, fm, body, route: studioRoute(collection.key, id),
        extension: path.extname(file),
        checksum: createHash('sha256').update(raw).digest('hex'),
        relativePath: path.relative(ROOT, file).replace(/\\/g, '/'),
      });
    }

    if (p === '/api/studio/item' && (req.method === 'POST' || req.method === 'PUT')) {
      const payload = await readBody(req);
      const collection = studioCollection(payload.collection);
      if (!collection || !payload.id) return err('Thiếu collection hoặc id');
      if (collection.virtual === 'banners') {
        if (req.method === 'POST') {
          const snapshot = bannerRecords();
          if (payload.action === 'delete') {
            const record = snapshot.records.find(item => item.id === payload.id);
            if (!record) return err('Không tìm thấy trích dẫn banner', 404);
            const variants = Array.isArray(snapshot.all[record.key]) ? [...snapshot.all[record.key]] : [snapshot.all[record.key]];
            if (variants.length <= 1) return err('Banner cần giữ ít nhất một trích dẫn');
            const currentRaw = fs.readFileSync(BANNERS_PATH, UTF8);
            if (payload.checksum && createHash('sha256').update(currentRaw).digest('hex') !== payload.checksum) {
              return err('Banner đã thay đổi ở nơi khác. Hãy tải lại trước khi xóa.', 409);
            }
            variants.splice(record.index, 1);
            snapshot.all[record.key] = variants.length === 1 ? variants[0] : variants;
            fs.writeFileSync(BANNERS_PATH, JSON.stringify(snapshot.all, null, 2) + '\n', UTF8);
            const raw = fs.readFileSync(BANNERS_PATH, UTF8);
            return json({
              ok: true,
              id: variants.length === 1 ? record.key : `${record.key}.${Math.min(record.index + 1, variants.length)}`,
              route: bannerRoute(record.key),
              checksum: createHash('sha256').update(raw).digest('hex'),
            });
          }
          const key = String(payload.bannerKey || payload.id || '').split('.')[0];
          if (!key || !Object.prototype.hasOwnProperty.call(snapshot.all, key)) return err('Không tìm thấy banner', 404);
          const currentRaw = fs.readFileSync(BANNERS_PATH, UTF8);
          if (payload.checksum && createHash('sha256').update(currentRaw).digest('hex') !== payload.checksum) {
            return err('Banner đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.', 409);
          }
          const variants = Array.isArray(snapshot.all[key]) ? [...snapshot.all[key]] : [snapshot.all[key]];
          const next = {
            imageUrl: String(payload.fm?.imageUrl || variants[0]?.imageUrl || ''),
            altText: String(payload.fm?.altText || variants[0]?.altText || ''),
            quoteText: String(payload.fm?.quoteText || ''),
            quoteCite: String(payload.fm?.quoteCite || ''),
          };
          variants.push(next);
          snapshot.all[key] = variants;
          fs.writeFileSync(BANNERS_PATH, JSON.stringify(snapshot.all, null, 2) + '\n', UTF8);
          const raw = fs.readFileSync(BANNERS_PATH, UTF8);
          return json({
            ok: true,
            id: `${key}.${variants.length}`,
            route: bannerRoute(key),
            checksum: createHash('sha256').update(raw).digest('hex'),
            relativePath: `src/data/banners.json · ${key}.${variants.length}`,
          });
        }
        const snapshot = bannerRecords();
        const record = snapshot.records.find(item => item.id === payload.id);
        if (!record) return err('Không tìm thấy banner', 404);
        const currentRaw = fs.readFileSync(BANNERS_PATH, UTF8);
        if (payload.checksum && createHash('sha256').update(currentRaw).digest('hex') !== payload.checksum) {
          return err('Banner đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.', 409);
        }
        const next = {
          imageUrl: String(payload.fm?.imageUrl || ''),
          altText: String(payload.fm?.altText || ''),
          quoteText: String(payload.fm?.quoteText || ''),
          quoteCite: String(payload.fm?.quoteCite || ''),
        };
        if (Array.isArray(snapshot.all[record.key])) snapshot.all[record.key][record.index] = next;
        else snapshot.all[record.key] = next;
        fs.writeFileSync(BANNERS_PATH, JSON.stringify(snapshot.all, null, 2) + '\n', UTF8);
        const raw = fs.readFileSync(BANNERS_PATH, UTF8);
        return json({
          ok: true,
          id: payload.id,
          route: bannerRoute(record.key),
          checksum: createHash('sha256').update(raw).digest('hex'),
          relativePath: `src/data/banners.json · ${payload.id}`,
        });
      }
      if (req.method === 'POST' && !collection.create) return err('Collection này không cho phép tạo mục mới');
      const originalId = String(payload.originalId || payload.id);
      const oldFile = studioExistingPath(collection, originalId);
      const extension = payload.extension === '.mdx' ? '.mdx' : (fs.existsSync(oldFile) ? path.extname(oldFile) : '.md');
      const newFile = studioPath(collection, payload.id, extension);
      if (req.method === 'POST' && fs.existsSync(newFile)) return err('Slug đã tồn tại', 409);
      if (req.method === 'PUT' && oldFile !== newFile && fs.existsSync(newFile)) return err('Slug đã tồn tại trong chuyên mục nhận', 409);
      if (payload.checksum && fs.existsSync(oldFile)) {
        const actual = createHash('sha256').update(fs.readFileSync(oldFile)).digest('hex');
        if (actual !== payload.checksum) return err('File đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.', 409);
      }
      const nextFm = { ...(payload.fm || {}) };
      let nextBody = String(payload.body || '');
      const movingArticle = collection.key === 'bai-viet' && oldFile !== newFile;
      if (movingArticle) {
        for (const key of ['image', 'heroImage']) {
          if (typeof nextFm[key] === 'string') nextFm[key] = rebaseRelativeAsset(nextFm[key], oldFile, newFile);
        }
        nextBody = rebaseArticleBodyAssets(nextBody, oldFile, newFile);
      }

      const linkedTranslations = movingArticle && nextFm.language !== 'en' && !nextFm.translationOf
        ? studioFiles(collection.root).map(file => {
            const id = studioId(collection, file);
            if (id === originalId) return null;
            const raw = fs.readFileSync(file, UTF8);
            const parsed = studioSplitMd(raw);
            const linked = parsed.fm.translationOf === originalId || id === `${originalId}-en`;
            return linked ? { id, file, ...parsed, extension: path.extname(file) } : null;
          }).filter(Boolean)
        : [];

      for (const translation of linkedTranslations) {
        const targetFolder = String(payload.id).split('/').slice(0, -1).join('/');
        const targetId = `${targetFolder}/${translation.id.split('/').at(-1)}`;
        const targetFile = studioPath(collection, targetId, translation.extension);
        if (targetFile !== translation.file && fs.existsSync(targetFile)) throw new Error(`Không thể chuyển bản EN “${translation.id}”: slug đã tồn tại trong chuyên mục nhận.`);
        translation.targetFile = targetFile;
      }

      fs.mkdirSync(path.dirname(newFile), { recursive: true });
      fs.writeFileSync(newFile, studioToMd(collection, nextFm, nextBody), UTF8);
      // The Tin tức masthead represents one article, so selecting a new banner
      // article atomically clears the flag from the previous one.
      if (
        collection.key === 'bai-viet'
        && String(payload.id).startsWith('sinh-hoat-cong-doan/')
        && nextFm.featured === true
        && nextFm.language !== 'en'
        && !nextFm.translationOf
      ) {
        for (const candidate of studioFiles(collection.root)) {
          if (path.resolve(candidate) === path.resolve(newFile)) continue;
          const candidateId = studioId(collection, candidate);
          if (!candidateId.startsWith('sinh-hoat-cong-doan/')) continue;
          const parsed = studioSplitMd(fs.readFileSync(candidate, UTF8));
          if (parsed.fm.featured !== true || parsed.fm.language === 'en' || parsed.fm.translationOf) continue;
          fs.writeFileSync(candidate, studioToMd(collection, { ...parsed.fm, featured: false }, parsed.body), UTF8);
        }
      }
      for (const translation of linkedTranslations) {
        const targetFile = translation.targetFile;
        const translationFm = { ...translation.fm, translationOf: String(payload.id) };
        for (const key of ['image', 'heroImage']) {
          if (typeof translationFm[key] === 'string') translationFm[key] = rebaseRelativeAsset(translationFm[key], translation.file, targetFile);
        }
        const translationBody = rebaseArticleBodyAssets(translation.body, translation.file, targetFile);
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(targetFile, studioToMd(collection, translationFm, translationBody), UTF8);
        if (targetFile !== translation.file && fs.existsSync(translation.file)) fs.unlinkSync(translation.file);
      }
      if (collection.key === 'thanh-chan-phuoc') syncSaintIndex(payload.id, payload.fm || {});
      if (oldFile !== newFile && fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      if (collection.key === 'kinh-sach') rebuildIndex();
      const raw = fs.readFileSync(newFile, UTF8);
      return json({
        ok: true, id: payload.id, route: studioRoute(collection.key, payload.id),
        checksum: createHash('sha256').update(raw).digest('hex'),
        relativePath: path.relative(ROOT, newFile).replace(/\\/g, '/'),
      });
    }

    if (p === '/api/studio/item' && req.method === 'DELETE') {
      const collection = studioCollection(url.searchParams.get('collection'));
      const id = url.searchParams.get('id');
      if (!collection || !id) return err('Thiếu collection hoặc id');
      const file = studioExistingPath(collection, id);
      if (!fs.existsSync(file)) return err('Không tìm thấy nội dung', 404);
      const target = path.join(STUDIO_TRASH, collection.key, `${Date.now()}-${path.basename(file)}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(file, target);
      if (collection.key === 'kinh-sach') rebuildIndex();
      return json({ ok: true, recoverable: true, trashPath: path.relative(ROOT, target).replace(/\\/g, '/') });
    }

    if (p === '/api/studio/submit' && req.method === 'POST') {
      const payload = await readBody(req);
      const collection = studioCollection(payload.collection);
      if (!collection || !payload.id) return err('Thiếu collection hoặc id');
      const result = await studioSubmitToGitHub(collection, payload.id, payload.message);
      if (!result.configured) return json({ ok: false, ...result }, 409);
      return json({ ok: true, ...result });
    }

    // ── Studio image library — article, banner and saint-card assets
    if (p === '/api/studio/image' && req.method === 'GET') {
      const scope = url.searchParams.get('scope');
      const value = String(url.searchParams.get('value') || '');
      if (scope !== 'articles' || !value.startsWith('../../../assets/')) return err('Đường dẫn ảnh không hợp lệ');
      const relative = value.slice('../../../assets/'.length).replace(/\\/g, '/');
      const file = path.resolve(ARTICLE_IMG, relative);
      const rootPrefix = path.resolve(ARTICLE_IMG) + path.sep;
      if (!file.startsWith(rootPrefix) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return err('Không tìm thấy ảnh', 404);
      const extension = path.extname(file).toLowerCase();
      const contentTypes = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.png': 'image/png',
        '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml',
      };
      if (!contentTypes[extension]) return err('Định dạng ảnh không hỗ trợ');
      res.writeHead(200, { 'Content-Type': contentTypes[extension], 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
      return;
    }

    if (p === '/api/studio/images' && req.method === 'GET') {
      const scope = url.searchParams.get('scope');
      if (scope === 'vocation') {
        const walk = directory => fs.existsSync(directory)
          ? fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
              const absolute = path.join(directory, entry.name);
              return entry.isDirectory() ? walk(absolute) : [absolute];
            })
          : [];
        const files = walk(PUBLIC_IMG_ROOT)
          .filter(file => /\.(jpg|jpeg|png|webp|avif|gif|svg|jfif)$/i.test(file))
          .map(file => '/' + path.relative(PUBLIC_IMG_ROOT, file).replace(/\\/g, '/'))
          .sort((a, b) => a.localeCompare(b));
        return json({ scope, files });
      }
      if (scope === 'articles') {
        const walk = directory => fs.existsSync(directory)
          ? fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
              const absolute = path.join(directory, entry.name);
              return entry.isDirectory() ? walk(absolute) : [absolute];
            })
          : [];
        const files = walk(ARTICLE_IMG)
          .filter(file => /\.(jpg|jpeg|png|webp|avif|gif|svg|jfif)$/i.test(file))
          .map(file => '../../../assets/' + path.relative(ARTICLE_IMG, file).replace(/\\/g, '/'))
          .sort((a, b) => a.localeCompare(b));
        return json({ scope, files });
      }
      const config = scope === 'saints'
        ? { dir: SAINTS_IMG, prefix: '/db/saints/images/' }
        : scope === 'banners'
          ? { dir: BANNERS_IMG, prefix: '/images/banners/' }
          : null;
      if (!config) return err('Thư viện ảnh không hợp lệ');
      if (!fs.existsSync(config.dir)) fs.mkdirSync(config.dir, { recursive: true });
      const files = fs.readdirSync(config.dir)
        .filter(file => /\.(jpg|jpeg|png|webp|avif|gif|svg|jfif)$/i.test(file))
        .sort((a, b) => a.localeCompare(b))
        .map(file => config.prefix + file);
      return json({ scope, files });
    }

    if (p === '/api/studio/images' && req.method === 'POST') {
      const { scope, filename, data } = await readBody(req);
      const config = scope === 'articles'
        ? { dir: ARTICLE_UPLOAD_IMG, prefix: '../../../assets/bai-viet/' }
        : scope === 'vocation'
          ? { dir: VOCATION_IMG, prefix: '/images/on-goi/' }
        : scope === 'saints'
        ? { dir: SAINTS_IMG, prefix: '/db/saints/images/' }
        : scope === 'banners'
          ? { dir: BANNERS_IMG, prefix: '/images/banners/' }
          : null;
      if (!config || !filename || !data) return err('Thiếu thư viện, tên file hoặc dữ liệu ảnh');
      const safeName = String(filename).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
      if (!/\.(jpg|jpeg|png|webp|avif|gif|svg|jfif)$/i.test(safeName)) return err('Định dạng ảnh không hỗ trợ');
      const buffer = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) return err('Ảnh rỗng hoặc vượt quá 8 MB');
      if (!fs.existsSync(config.dir)) fs.mkdirSync(config.dir, { recursive: true });
      let finalName = safeName;
      if ((scope === 'articles' || scope === 'vocation') && fs.existsSync(path.join(config.dir, finalName))) {
        const extension = path.extname(finalName);
        finalName = `${path.basename(finalName, extension)}-${Date.now()}${extension}`;
      }
      fs.writeFileSync(path.join(config.dir, finalName), buffer);
      return json({ ok: true, url: config.prefix + finalName });
    }

    // ── GET /api/entries ── list all entries (from filesystem)
    if (p === '/api/entries' && req.method === 'GET') {
      const result = {};
      for (const season of fs.readdirSync(CONTENT).sort()) {
        const dir = path.join(CONTENT, season);
        if (!fs.statSync(dir).isDirectory()) continue;
        result[season] = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(file => {
          const slug = file.slice(0, -3);
          const { fm, body } = splitMd(fs.readFileSync(path.join(dir, file), UTF8));
          return { id: `${season}/${slug}`, slug, title: String(fm.title || slug),
            author: String(fm.source || ''), liturgy: String(fm.liturgy || ''),
            seasonLabel: String(fm.season || season), draft: !!fm.draft, order: Number(fm.order) || 0,
            hasContent: body.trim().length > 0 };
        }).sort((a, b) => a.order - b.order);
      }
      return json(result);
    }

    // ── GET /api/entry?id=season/slug ── full entry
    if (p === '/api/entry' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const [season, ...rest] = id.split('/');
      const file = path.join(CONTENT, season, rest.join('/') + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      const { fm, body } = splitMd(fs.readFileSync(file, UTF8));
      return json({ fm, body });
    }

    // ── POST /api/entry ── create new
    if (p === '/api/entry' && req.method === 'POST') {
      const { seasonKey, slug, fm, body } = await readBody(req);
      if (!seasonKey || !slug) return err('Thiếu seasonKey hoặc slug');
      if (!/^[a-z0-9-]+$/.test(slug)) return err('Slug chỉ dùng chữ thường, số và gạch nối');
      const dir  = path.join(CONTENT, seasonKey);
      const file = path.join(dir, slug + '.md');
      if (fs.existsSync(file)) return err('File đã tồn tại. Dùng PUT để cập nhật.');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, toMd(fm, body), UTF8);
      rebuildIndex();
      return json({ ok: true, id: `${seasonKey}/${slug}`, url: `/kinh-sach/${seasonKey}/${slug}/` });
    }

    // ── PUT /api/entry?id=... ── update (rename slug / change season supported)
    if (p === '/api/entry' && req.method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const { fm, body, newSlug } = await readBody(req);
      const [oldSeason, ...oldRest] = id.split('/');
      const oldSlug   = oldRest.join('/');
      const newSeason = fm.seasonKey || oldSeason;
      const finalSlug = newSlug || oldSlug;
      if (!/^[a-z0-9-]+$/.test(finalSlug)) return err('Slug không hợp lệ');
      const oldFile = path.join(CONTENT, oldSeason, oldSlug + '.md');
      const newDir  = path.join(CONTENT, newSeason);
      const newFile = path.join(newDir, finalSlug + '.md');
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      if (oldFile !== newFile && fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      fs.writeFileSync(newFile, toMd(fm, body), UTF8);
      rebuildIndex();
      return json({ ok: true, id: `${newSeason}/${finalSlug}` });
    }

    // ── DELETE /api/entry?id=... ── delete
    if (p === '/api/entry' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const [season, ...rest] = id.split('/');
      const file = path.join(CONTENT, season, rest.join('/') + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      fs.unlinkSync(file);
      rebuildIndex();
      return json({ ok: true });
    }

    // ── GET /api/saints ── list all thanh-chan-phuoc entries
    if (p === '/api/saints' && req.method === 'GET') {
      const entries = fs.readdirSync(SAINTS_DIR).filter(f => f.endsWith('.md')).sort().map(file => {
        const slug = file.slice(0, -3);
        const { fm, body } = splitMd(fs.readFileSync(path.join(SAINTS_DIR, file), UTF8));
        return { id: slug, title: String(fm.title || slug), subtitle: String(fm.subtitle || ''),
          rank: String(fm.rank || 'none'), feastDay: fm.feastDay, feastMonth: fm.feastMonth,
          draft: !!fm.draft, manualFill: !!fm.manualFill, hasContent: body.trim().length > 0 };
      });
      return json(entries);
    }

    // ── GET /api/saint?id=slug ── full entry
    if (p === '/api/saint' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const file = path.join(SAINTS_DIR, id + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      const { fm, body } = splitMd(fs.readFileSync(file, UTF8));
      return json({ fm, body });
    }

    // ── PUT /api/saint?id=slug ── update entry
    if (p === '/api/saint' && req.method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const { fm, body } = await readBody(req);
      const file = path.join(SAINTS_DIR, id + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      const q = v =>
        typeof v === 'boolean' ? String(v) :
        typeof v === 'number'  ? String(v) :
        `"${String(v ?? '').replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
      const lines = ['---', ...SAINT_FM_KEYS.filter(k => k in fm).map(k => `${k}: ${q(fm[k])}`), '---', ''];
      fs.writeFileSync(file, lines.join('\n') + (body || '').trim(), UTF8);
      syncSaintIndex(id, fm);
      return json({ ok: true });
    }

    // ── GET /api/banners ── return all banner config
    if (p === '/api/banners' && req.method === 'GET') {
      return json(JSON.parse(fs.readFileSync(BANNERS_PATH, UTF8)));
    }

    // ── PUT /api/banners/:key ── update one banner key
    if (p.startsWith('/api/banners/') && req.method === 'PUT') {
      const key = decodeURIComponent(p.slice('/api/banners/'.length));
      const body = await readBody(req);
      const all = JSON.parse(fs.readFileSync(BANNERS_PATH, UTF8));
      if (!(key in all)) return err('Không tìm thấy banner key: ' + key, 404);
      all[key] = body;
      fs.writeFileSync(BANNERS_PATH, JSON.stringify(all, null, 2), UTF8);
      return json({ ok: true });
    }

    // ── GET /api/banner-images ── list available banner image files
    if (p === '/api/banner-images' && req.method === 'GET') {
      const files = fs.readdirSync(BANNERS_IMG)
        .filter(f => /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(f))
        .map(f => '/images/banners/' + f);
      return json(files);
    }

    // ── POST /api/banner-images ── upload a new banner image (base64 JSON)
    if (p === '/api/banner-images' && req.method === 'POST') {
      const { filename, data } = await readBody(req);
      if (!filename || !data) return err('Thiếu filename hoặc data');
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(safeName)) return err('Định dạng không hỗ trợ');
      const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (buf.length > 8 * 1024 * 1024) return err('File quá lớn (tối đa 8 MB)');
      fs.writeFileSync(path.join(BANNERS_IMG, safeName), buf);
      return json({ ok: true, url: '/images/banners/' + safeName });
    }

    // ── GET /api/on-goi ── return on-goi page content
    if (p === '/api/on-goi' && req.method === 'GET') {
      return json(JSON.parse(fs.readFileSync(ON_GOI_PATH, UTF8)));
    }

    // ── PUT /api/on-goi ── update on-goi page content
    if (p === '/api/on-goi' && req.method === 'PUT') {
      const body = await readBody(req);
      fs.writeFileSync(ON_GOI_PATH, JSON.stringify(body, null, 2), UTF8);
      return json({ ok: true });
    }

    // ── GET /api/page-headers ── return all masthead config
    if (p === '/api/page-headers' && req.method === 'GET') {
      return json(JSON.parse(fs.readFileSync(HEADERS_PATH, UTF8)));
    }

    // ── PUT /api/page-headers/:key ── update one page header key
    if (p.startsWith('/api/page-headers/') && req.method === 'PUT') {
      const key = decodeURIComponent(p.slice('/api/page-headers/'.length));
      const body = await readBody(req);
      const all = JSON.parse(fs.readFileSync(HEADERS_PATH, UTF8));
      if (!(key in all)) return err('Không tìm thấy page-header key: ' + key, 404);
      all[key] = body;
      fs.writeFileSync(HEADERS_PATH, JSON.stringify(all, null, 2), UTF8);
      return json({ ok: true });
    }

    err('Không tìm thấy endpoint', 404);
  } catch (e) {
    console.error(e);
    err(e.message, 500);
  }
});

syncAllSaintIndexEntries();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  Admin API  →  http://localhost:${PORT}     ║`);
  console.log('║  Inline edit is active directly on local pages  ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
