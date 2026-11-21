#!/usr/bin/env node
/**
 * convert-json-to-md.mjs
 * ----------------------------------------------------------------------------
 * Chuyển nội dung JSON cũ (sections > paragraphs > subparagraphs > content[])
 * sang Markdown + frontmatter cho Astro.
 *
 * Cách dùng:
 *   node scripts/convert-json-to-md.mjs <input.json> <output.md> --type=article
 *   node scripts/convert-json-to-md.mjs <input.json> <output.md> --type=book \
 *        --title="..." --author="..." --category="..." --excerpt="..." --date=YYYY-MM-DD
 *
 * Có thể bọc trong vòng lặp shell để convert toàn bộ /db.
 * ----------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node convert-json-to-md.mjs <in.json> <out.md> [--key=value ...]');
  process.exit(1);
}
const opts = Object.fromEntries(
  rest.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.join('=')];
  })
);

/* --- Chuyển cú pháp parser cũ -> Markdown chuẩn --- */
function convertInline(text) {
  if (typeof text !== 'string') return '';
  let t = text;
  // {{daily_quote}} -> bỏ
  t = t.replace(/\{\{\/?daily_quote\}\}/g, '');
  // || (xuống dòng cũ) -> hai dấu cách + newline (line break Markdown)
  t = t.replace(/\|\|/g, '  \n');
  // <br> -> line break
  t = t.replace(/<br\s*\/?>/gi, '  \n');
  // [[image|src|alt]] -> ![alt](src)
  t = t.replace(/\[\[image\|(.*?)\|(.*?)\]\]/g, (_, src, alt) => `\n\n![${alt}](${src})\n\n`);
  // [[quote|text|author]] -> blockquote
  t = t.replace(/\[\[quote\|(.*?)\|(.*?)\]\]/g, (_, q, a) => `\n\n> ${q}\n>\n> — ${a}\n\n`);
  // [[emphasis|text]] -> heading nhỏ
  t = t.replace(/\[\[emphasis\|(.*?)\]\]/g, (_, x) => `\n\n### ${x}\n\n`);
  // [[Text|đích]] -> [Text](đường-dẫn) — ánh xạ sang URL Astro mới
  t = t.replace(/\[\[(.*?)\|(.*?)\]\]/g, (_, label, dest) => {
    const [pathPart, hash] = dest.split('#');
    const seg = pathPart.split('/');
    const anchor = hash ? `#${hash}` : '';
    let url = '#';
    if (seg[0] === 'book') {
      // book/<type>/<author>/<bookId> -> /sach/<author>/<bookId>/
      url = `/sach/${seg[2]}/${seg[3]}/${anchor}`;
    } else if (seg[0] === 'article') {
      // article/<pageKey>/<id> -> /bai-viet/<id>/
      url = `/bai-viet/${seg[2] ?? ''}/${anchor}`;
    } else if (seg[0] === 'saint') {
      url = `/thanh/${seg[1] ?? ''}/${anchor}`;
    } else {
      url = `/${pathPart}/${anchor}`;
    }
    return `[${label}](${url})`;
  });
  // *nghiêng* đã là Markdown chuẩn -> giữ nguyên
  // [^1] footnote đã là Markdown chuẩn -> giữ nguyên (cần định nghĩa [^1]: ... ở cuối)
  return t.trim();
}

function renderTable(tbl) {
  // GFM table: bọc | ở đầu/cuối, gộp cell về 1 dòng, escape | trong nội dung
  const cell = (c) => convertInline(String(c)).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
  const head = `| ${tbl.header.map(cell).join(' | ')} |`;
  const sep = `| ${tbl.header.map(() => '---').join(' | ')} |`;
  const rows = tbl.rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n');
  return `\n\n${head}\n${sep}\n${rows}\n\n`;
}

function renderContentItem(item) {
  if (item && typeof item === 'object' && item.type === 'table') return renderTable(item);
  return convertInline(item);
}

/* --- Duyệt cấu trúc sections --- */
const data = JSON.parse(readFileSync(input, 'utf-8'));
const out = [];
const footnoteDefs = [];   // các định nghĩa [^gN]: ... gom ở cuối
let fnCounter = 0;

for (const section of data.sections ?? []) {
  // ánh xạ số chú thích trong section -> số toàn cục duy nhất
  const fnMap = {};
  const fns = section.footnotes && typeof section.footnotes === 'object' ? section.footnotes : {};
  for (const localNum of Object.keys(fns)) {
    fnCounter += 1;
    fnMap[localNum] = fnCounter;
    // nội dung chú thích cũng có thể chứa cú pháp cũ -> chuyển inline, gộp 1 dòng
    const def = convertInline(String(fns[localNum])).replace(/\s*\n\s*/g, ' ').trim();
    footnoteDefs.push(`[^${fnCounter}]: ${def}`);
  }
  // hàm đổi [^k] trong text của section này sang [^global]
  const remap = (txt) =>
    txt.replace(/\[\^(\d+)\]/g, (m, n) => (fnMap[n] ? `[^${fnMap[n]}]` : m));

  if (section.title) out.push(`## ${section.title}\n`);
  for (const para of section.paragraphs ?? []) {
    if (para.title) out.push(`### ${remap(para.title)}\n`);
    for (const sub of para.subparagraphs ?? []) {
      if (sub.title) out.push(`#### ${remap(sub.title)}\n`);
      for (const c of sub.content ?? []) {
        let md = renderContentItem(c);
        if (md) { md = remap(md); out.push(md + '\n'); }
      }
    }
  }
}

// gắn định nghĩa chú thích ở cuối (Astro/remark sẽ render thành mục "Chú thích")
if (footnoteDefs.length) {
  out.push('\n');
  out.push(...footnoteDefs);
}

/* --- Frontmatter --- */
const fm = ['---'];
const esc = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
if (opts.title) fm.push(`title: ${esc(opts.title)}`);
if (opts.subtitle) fm.push(`subtitle: ${esc(opts.subtitle)}`);
if (opts.author) fm.push(`author: ${esc(opts.author)}`);
if (opts.translator) fm.push(`translator: ${esc(opts.translator)}`);
if (opts.category) fm.push(`category: ${esc(opts.category)}`);
if (opts.excerpt) fm.push(`excerpt: ${esc(opts.excerpt)}`);
if (opts.date) fm.push(`date: ${opts.date}`);
if (opts.image) fm.push(`image: ${esc(opts.image)}`);
if (opts.heroImage) fm.push(`heroImage: ${esc(opts.heroImage)}`);
if (opts.bookType) fm.push(`bookType: ${esc(opts.bookType)}`);
if (opts.publishYear) fm.push(`publishYear: ${esc(opts.publishYear)}`);
if (opts.season) fm.push(`season: ${esc(opts.season)}`);
if (opts.source) fm.push(`source: ${esc(opts.source)}`);
if (opts.order) fm.push(`order: ${Number(opts.order)}`);
if (opts.featured === 'true') fm.push('featured: true');
fm.push('---', '');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, fm.join('\n') + out.join('\n'), 'utf-8');
console.log(`✓ ${input} -> ${output}`);
