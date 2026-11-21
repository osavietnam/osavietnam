#!/usr/bin/env node
/**
 * convert-kinh-sach.mjs
 * Đọc TableIndex.json gốc, chuyển TOÀN BỘ bài đọc Kinh Sách (JSON → Markdown),
 * và sinh file dữ liệu index (src/data/kinh-sach-index.json) cho trang bảng.
 *
 * Dùng:
 *   node scripts/convert-kinh-sach.mjs <DB_DIR> <OUT_CONTENT_DIR> <OUT_INDEX_JSON>
 * Ví dụ:
 *   node scripts/convert-kinh-sach.mjs \
 *     /path/to/db src/content/kinh-sach src/data/kinh-sach-index.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const [DB, OUT_CONTENT, OUT_INDEX] = process.argv.slice(2);
if (!DB || !OUT_CONTENT || !OUT_INDEX) {
  console.error('Usage: node convert-kinh-sach.mjs <DB_DIR> <OUT_CONTENT_DIR> <OUT_INDEX_JSON>');
  process.exit(1);
}

/* --- chuyển cú pháp inline cũ -> Markdown --- */
function convertInline(text) {
  if (typeof text !== 'string') return '';
  let t = text;
  t = t.replace(/\{\{\/?daily_quote\}\}/g, '');
  t = t.replace(/\|\|/g, '  \n');
  t = t.replace(/<br\s*\/?>/gi, '  \n');
  t = t.replace(/\[\[image\|(.*?)\|(.*?)\]\]/g, (_, src, alt) => `\n\n![${alt}](${src})\n\n`);
  t = t.replace(/\[\[quote\|(.*?)\|(.*?)\]\]/g, (_, q, a) => `\n\n> ${q}\n>\n> — ${a}\n\n`);
  t = t.replace(/\[\[emphasis\|(.*?)\]\]/g, (_, x) => `\n\n### ${x}\n\n`);
  t = t.replace(/\[\[(.*?)\|(.*?)\]\]/g, (_, label) => label); // bỏ link nội bộ cũ, giữ chữ
  return t.trim();
}

function renderTable(tbl) {
  const cell = (c) => convertInline(String(c)).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
  const head = `| ${tbl.header.map(cell).join(' | ')} |`;
  const sep = `| ${tbl.header.map(() => '---').join(' | ')} |`;
  const rows = tbl.rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n');
  return `\n\n${head}\n${sep}\n${rows}\n\n`;
}
function renderItem(item) {
  if (item && typeof item === 'object' && item.type === 'table') return renderTable(item);
  return convertInline(item);
}

function bodyFromSections(data) {
  const out = [];
  const footnoteDefs = [];
  let fnCounter = 0;
  for (const section of data.sections ?? []) {
    const fnMap = {};
    const fns = section.footnotes && typeof section.footnotes === 'object' ? section.footnotes : {};
    for (const localNum of Object.keys(fns)) {
      fnCounter += 1;
      fnMap[localNum] = fnCounter;
      const def = convertInline(String(fns[localNum])).replace(/\s*\n\s*/g, ' ').trim();
      footnoteDefs.push(`[^${fnCounter}]: ${def}`);
    }
    const remap = (txt) => txt.replace(/\[\^(\d+)\]/g, (m, n) => (fnMap[n] ? `[^${fnMap[n]}]` : m));

    if (section.title) out.push(`## ${remap(section.title)}\n`);
    for (const para of section.paragraphs ?? []) {
      if (para.title) out.push(`### ${remap(para.title)}\n`);
      for (const sub of para.subparagraphs ?? []) {
        if (sub.title) out.push(`#### ${remap(sub.title)}\n`);
        for (const c of sub.content ?? []) {
          let md = renderItem(c);
          if (md) { md = remap(md); out.push(md + '\n'); }
        }
      }
    }
  }
  if (footnoteDefs.length) {
    out.push('\n');
    out.push(...footnoteDefs);
  }
  return out.join('\n');
}

const esc = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
// Bỏ thẻ HTML rò rỉ (vd <br>) khỏi các trường hiển thị dạng văn bản thuần
const clean = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const SEASON_LABELS = {
  'le-chung': 'Lễ Chung',
  'le-rieng': 'Lễ Riêng',
  'trong-kinh-chua': 'Lễ Trọng Kính Chúa',
  'mua-thuong-nien': 'Mùa Thường Niên',
  'mua-vong': 'Mùa Vọng',
  'mua-giang-sinh': 'Mùa Giáng Sinh',
  'mua-chay': 'Mùa Chay',
  'mua-phuc-sinh': 'Mùa Phục Sinh',
};

const tableIndex = JSON.parse(readFileSync(join(DB, 'phung-vu/kinh-sach/TableIndex.json'), 'utf-8'));
const outIndex = {}; // { category: [ {id, slug, author, excerpt, liturgy, rank, url} ] }
let total = 0, missing = 0;

for (const [category, readings] of Object.entries(tableIndex)) {
  outIndex[category] = [];
  let order = 0;
  for (const r of readings) {
    order += 1;
    // contentFile dạng "db/phung-vu/kinh-sach/content/<season>/<slug>.json"
    const rel = r.contentFile.replace(/^db\//, '');
    const abs = join(DB, rel);
    const slug = basename(rel).replace(/\.json$/, '');
    const id = `${category}/${slug}`;
    const url = `/kinh-sach/${id}/`;

    let body = '';
    let title = r.liturgy || slug;
    if (existsSync(abs)) {
      try {
        const data = JSON.parse(readFileSync(abs, 'utf-8'));
        if (data.title) title = data.title;
        body = bodyFromSections(data);
      } catch (e) {
        missing += 1;
      }
    } else {
      missing += 1;
    }

    // frontmatter
    const fm = [
      '---',
      `title: ${esc(clean(r.liturgy || title))}`,
      `season: ${esc(SEASON_LABELS[category] ?? category)}`,
      `seasonKey: ${esc(category)}`,
      r.author ? `source: ${esc(clean(r.author))}` : null,
      r.excerpt ? `excerpt: ${esc(clean(r.excerpt))}` : null,
      r.liturgy ? `liturgy: ${esc(clean(r.liturgy))}` : null,
      r.rank ? `rank: ${esc(r.rank)}` : null,
      `order: ${order}`,
      '---',
      '',
    ].filter(Boolean);

    const outPath = join(OUT_CONTENT, `${id}.md`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, fm.join('\n') + '\n' + body + '\n', 'utf-8');
    total += 1;

    outIndex[category].push({
      id, slug, url,
      author: clean(r.author),
      excerpt: clean(r.excerpt),
      liturgy: clean(r.liturgy),
      rank: r.rank ?? '',
    });
  }
}

mkdirSync(dirname(OUT_INDEX), { recursive: true });
writeFileSync(OUT_INDEX, JSON.stringify(outIndex, null, 0), 'utf-8');
console.log(`✓ Đã chuyển ${total} bài (thiếu/lỗi: ${missing}). Index: ${OUT_INDEX}`);
