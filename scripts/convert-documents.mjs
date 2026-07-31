/**
 * convert-documents.mjs
 * Chuyển JSON tài liệu Dòng (tu-luat, hien-chuong, ratio) → Markdown
 * Cấu trúc JSON: sections[].paragraphs[].subparagraphs[].content[]
 * Chạy: node scripts/convert-documents.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_BASE = join(ROOT, 'Ver_Frel.2025-aug-25-v3/Ver_Frel.2025-aug-25-v3/db/documents');
const OUT_DIR = join(ROOT, 'src/content/documents');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const DOCS = [
  {
    input: 'tu-luat-eng.json',
    output: 'tu-luat-en.md',
    title: 'The Rule of Saint Augustine',
    subtitle: 'Tu Luật Thánh Augustinô',
    docType: 'Tu Luật',
    lang: 'en',
  },
  {
    input: 'hien-chuong-eng.json',
    output: 'hien-chuong-en.md',
    title: 'Constitutions of the Order of Saint Augustine',
    subtitle: 'Hiến Chương Dòng Thánh Augustinô',
    docType: 'Hiến Chương',
    lang: 'en',
  },
  {
    input: 'ratio-eng.json',
    output: 'ratio-en.md',
    title: 'Ratio Institutionis',
    subtitle: 'Plan of Augustinian Formation — Dòng Thánh Augustinô',
    docType: 'Ratio',
    lang: 'en',
  },
];

function stripTitleHtml(text) {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

function convertContentLine(text) {
  // Chuyển <br> trong content → Markdown line break (2 spaces + newline)
  let t = text.replace(/<br\s*\/?>/gi, '  \n');

  const hasQuote = t.includes('{{daily_quote}}');
  t = t
    .replace(/\{\{daily_quote\}\}/g, '')
    .replace(/\{\{\/daily_quote\}\}/g, '')
    .trim();

  if (hasQuote) {
    // Nội dung bắt đầu bằng số thứ tự (điều khoản, đoạn văn) → <p> bình thường
    if (/^\d+\./.test(t)) return t;
    // Còn lại là trích dẫn nhúng → blockquote
    return t.split('\n').map(l => '> ' + l).join('\n');
  }
  return t;
}

function buildMarkdown(data, title, subtitle, docType, lang) {
  const lines = [];

  lines.push('---');
  lines.push(`title: "${title}"`);
  lines.push(`subtitle: "${subtitle}"`);
  lines.push(`docType: "${docType}"`);
  lines.push(`lang: "${lang}"`);
  lines.push('draft: false');
  lines.push('---');
  lines.push('');

  // Thu thập footnotes toàn tài liệu
  const allFootnotes = {};

  for (const section of data.sections || []) {
    const secTitle = stripTitleHtml(section.title || '');
    if (secTitle) {
      lines.push(`## ${secTitle}`);
      lines.push('');
    }

    for (const para of section.paragraphs || []) {
      const paraTitle = stripTitleHtml(para.title || '');
      if (paraTitle) {
        lines.push(`### ${paraTitle}`);
        lines.push('');
      }

      for (const sub of para.subparagraphs || []) {
        const subTitle = stripTitleHtml(sub.title || '');
        if (subTitle) {
          lines.push(`#### ${subTitle}`);
          lines.push('');
        }

        for (const contentLine of sub.content || []) {
          const converted = convertContentLine(contentLine);
          if (converted) {
            lines.push(converted);
            lines.push('');
          }
        }
      }
    }

    // Thu thập footnotes theo section
    if (section.footnotes) {
      for (const [key, val] of Object.entries(section.footnotes)) {
        if (val && String(val).trim()) allFootnotes[Number(key)] = val;
      }
    }
  }

  // Xuất footnotes ở cuối
  const fnKeys = Object.keys(allFootnotes).map(Number).sort((a, b) => a - b);
  if (fnKeys.length > 0) {
    lines.push('');
    for (const key of fnKeys) {
      lines.push(`[^${key}]: ${allFootnotes[key]}`);
    }
  }

  return lines.join('\n');
}

for (const { input, output, title, subtitle, docType, lang } of DOCS) {
  const jsonPath = join(SRC_BASE, input);
  const outPath = join(OUT_DIR, output);

  const raw = readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);

  const md = buildMarkdown(data, title, subtitle, docType, lang);
  writeFileSync(outPath, md, 'utf8');
  console.log(`✓ ${output} (${md.length.toLocaleString()} chars)`);
}

console.log('Xong.');
