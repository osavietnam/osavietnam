import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeHTML } from 'entities';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const docxPath = path.join(projectRoot, 'temp_', 'augustine-anthropology.docx');
const targetPath = path.join(
  projectRoot,
  'src',
  'content',
  'augustine-encyclopedia',
  'anthropology.md',
);

const xml = execFileSync('tar', ['-xOf', docxPath, 'word/document.xml'], {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

const decodeXml = (value) => decodeHTML(value.replace(/<[^>]+>/g, ''));
const paragraphs = Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g));

const markdownParagraphs = paragraphs
  .map((paragraphMatch) => {
    const paragraphXml = paragraphMatch[1];
    const style =
      paragraphXml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? '';
    const runs = Array.from(paragraphXml.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g));
    const pieces = [];

    for (const runMatch of runs) {
      const runXml = runMatch[1];
      const text = Array.from(runXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
        .map((match) => decodeXml(match[1]))
        .join('');
      if (!text) continue;

      const italic = /<w:i(?:\s[^>]*)?\/>/.test(runXml)
        && !/<w:i\b[^>]*w:val="(?:0|false|off)"/i.test(runXml);
      const bold = /<w:b(?:\s[^>]*)?\/>/.test(runXml)
        && !/<w:b\b[^>]*w:val="(?:0|false|off)"/i.test(runXml);
      const previous = pieces.at(-1);

      if (previous && previous.italic === italic && previous.bold === bold) {
        previous.text += text;
      } else {
        pieces.push({ text, italic, bold });
      }
    }

    const text = pieces
      .map((piece) => {
        if (piece.bold && piece.italic) return `***${piece.text}***`;
        if (piece.bold) return `**${piece.text}**`;
        if (piece.italic) return `*${piece.text}*`;
        return piece.text;
      })
      .join('')
      .trim();

    return { style, text };
  })
  .filter((paragraph) => paragraph.text);

if (!markdownParagraphs.length) {
  throw new Error('Không đọc được nội dung paragraph từ DOCX Anthropology.');
}

const englishStartIndex = markdownParagraphs.findIndex(
  ({ text }) => text.trim() === 'Body-Soul Relationship'
);
const vietnameseParagraphs =
  englishStartIndex > 0 ? markdownParagraphs.slice(0, englishStartIndex) : markdownParagraphs;

let body = vietnameseParagraphs
  .slice(1)
  .map(({ style, text }) => {
    const plainText = text.replace(/\*/g, '').trim();
    if (/^Heading1$/i.test(style)) return `## ${text}`;
    if (/^Kết luận$/i.test(plainText)) return '## Kết Luận';
    return text;
  })
  .join('\n\n')
  .trim();

// EPUB và DOCX cùng in nhầm 7.7.1; chương VII của quyển VII bắt đầu ở
// đoạn 11. Chuẩn hóa để dẫn chiếu tới đúng đoạn trong bản Tự Thuật.
body = body.replace(/\bconf\.\s+2\.2\.2;\s*7\.7\.1;\s*8\.5\.10\b/i, 'conf. 2.2.2; 7.7.11; 8.5.10');

// Chuẩn hóa mọi dẫn chiếu Confessiones. Với trích dẫn đủ ba cấp, link đi
// thẳng đến đoạn; với trích dẫn chỉ có quyển/chương, link mở đúng quyển.
body = body.replace(
  /\*?conf\.\*?\s+(\d+)\.(\d+)(?:\.(\d+))?(?:[–-](\d+)\.(\d+)\.(\d+))?/gi,
  (full, book, chapter, paragraph, endBook, endChapter, endParagraph) => {
    const label = `conf. ${book}.${chapter}${paragraph ? `.${paragraph}` : ''}`
      + (endBook ? `–${endBook}.${endChapter}.${endParagraph}` : '');
    const anchor = paragraph ? `#chi-muc-${chapter}-${paragraph}` : '';
    return `[${label}](/tu-thuat/?book=quyen-${book}${anchor})`;
  }
);
// Sau ký hiệu conf. đầu tiên, nguyên bản thường rút gọn các dẫn chiếu kế tiếp:
// “conf. 12.16.23; 10.3.3”. Mỗi số vẫn cần là một link độc lập.
body = body.replace(
  /(\[conf\.\s+\d+\.\d+(?:\.\d+)?(?:[–-]\d+\.\d+\.\d+)?\]\(\/tu-thuat\/\?book=quyen-\d+(?:#chi-muc-\d+-\d+)?\))((?:;\s*\d+\.\d+(?:\.\d+)?(?:[–-]\d+\.\d+\.\d+)?)*)/gi,
  (full, firstReference, compactReferences) => {
    const linkedTail = compactReferences.replace(
      /;\s*(\d+)\.(\d+)(?:\.(\d+))?(?:[–-](\d+)\.(\d+)\.(\d+))?/g,
      (reference, book, chapter, paragraph, endBook, endChapter, endParagraph) => {
        const label = `${book}.${chapter}${paragraph ? `.${paragraph}` : ''}`
          + (endBook ? `–${endBook}.${endChapter}.${endParagraph}` : '');
        const anchor = paragraph ? `#chi-muc-${chapter}-${paragraph}` : '';
        return `; [${label}](/tu-thuat/?book=quyen-${book}${anchor})`;
      }
    );
    return `${firstReference}${linkedTail}`;
  }
);
body = body
  .replace(
    /\*Confessiones\*\s*\(Tự thuật\)/g,
    '[*Confessiones* (Tự Thuật)](/tu-thuat/)'
  )
  .replace(
    /(?<![\[*])\bConfessiones\b(?![\]*])/g,
    '[*Confessiones*](/tu-thuat/)'
  );

const existing = fs.readFileSync(targetPath, 'utf8');
const frontmatterMatch = existing.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!frontmatterMatch) throw new Error('Không tìm thấy frontmatter Anthropology hiện có.');

const frontmatter = frontmatterMatch[1]
  .replace(/^titleVi:.*$/m, 'titleVi: "Nhân Học"')
  .replace(/^author:.*$/m, 'author: "Stephen J. Duffy"')
  .replace(/^translationStatus:.*$/m, 'translationStatus: "translated"');

fs.writeFileSync(targetPath, `---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');

console.log(JSON.stringify({
  target: path.relative(projectRoot, targetPath).replaceAll('\\', '/'),
  sourceParagraphs: markdownParagraphs.length,
  vietnameseParagraphs: vietnameseParagraphs.length,
  bodyParagraphs: vietnameseParagraphs.length - 1,
  headings: vietnameseParagraphs.slice(1).filter(({ style, text }) =>
    /^Heading1$/i.test(style) || /^Kết luận$/i.test(text.replace(/\*/g, '').trim())
  ).length,
  confessionLinks: (body.match(/\]\(\/tu-thuat\//g) ?? []).length,
  characters: body.length,
}, null, 2));
