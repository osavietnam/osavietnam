import fs from 'node:fs';

const vietnameseSource = 'C:/Users/jayce/.codex/attachments/6b46eb96-1d02-4160-84f4-08afa125c706/pasted-text.txt';
const englishPagesSource = 'temp_/EN_Spiri_Farrell-pages.txt';
const vietnameseOutput = 'src/content/bai-viet/linh-dao/hiep-nhat-trong-duc-ai.md';
const englishOutput = 'src/content/bai-viet/linh-dao/hiep-nhat-trong-duc-ai-en.md';

const frontmatterOf = (path) => {
  const value = fs.readFileSync(path, 'utf8');
  const match = value.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!match) throw new Error(`Missing frontmatter: ${path}`);
  return match[0];
};

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const footnoteReference = (language, number) => {
  const label = language === 'vi' ? `Chú thích ${number}` : `Footnote ${number}`;
  return `<sup><a href="#fn-${language}-${number}" id="fnref-${language}-${number}" data-footnote-ref aria-label="${label}">${number}</a></sup>`;
};

const footnoteSection = (language, notes) => {
  const heading = language === 'vi' ? 'Chú Thích' : 'Notes';
  const items = Array.from({ length: 42 }, (_, index) => {
    const number = index + 1;
    const note = notes.get(number);
    if (!note) throw new Error(`Missing ${language.toUpperCase()} footnote ${number}`);
    return `  <li id="fn-${language}-${number}"><p>${escapeHtml(note)} <a href="#fnref-${language}-${number}" data-footnote-backref aria-label="Trở lại chú thích ${number}">↩</a></p></li>`;
  }).join('\n');
  return `<section class="footnotes" data-footnotes>\n  <h2 class="sr-only">${heading}</h2>\n  <ol>\n${items}\n  </ol>\n</section>`;
};

const vietnamese = fs.readFileSync(vietnameseSource, 'utf8').replaceAll('\r', '');
const vietnameseLines = vietnamese.split('\n');
const separatorIndex = vietnameseLines.findIndex((line) => /^[-—]{5,}/.test(line.trim()));
if (separatorIndex < 0) throw new Error('Vietnamese footnote separator not found');

const vietnameseNotes = new Map();
for (const line of vietnameseLines.slice(separatorIndex + 1)) {
  const match = line.trim().match(/^\[(\d+)]\s*(.+)$/);
  if (match) vietnameseNotes.set(Number(match[1]), match[2].trim());
}

const vietnameseHeadings = new Set([
  'Một bối cảnh lịch sử vắn gọn',
  'Tạo lập một nơi để chia sẻ trong đức ái',
  'CHRISTUS TOTUS: Sống trong Tình yêu',
  'Kết luận',
]);
const vietnameseQuotes = new Set([
  'Tôi bắt đầu quy tụ',
  'Các tín hữu thời bấy giờ',
  'Vì không ai được nhàn hạ',
  'Ví như thân thể người ta',
  'Do đó, đối với thánh nhân',
  'Anh em có là gì',
]);

const vietnameseBody = vietnameseLines.slice(7, separatorIndex)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((paragraph) => {
    if (vietnameseHeadings.has(paragraph)) return `## ${paragraph}`;
    const withReferences = paragraph.replace(/\[(\d+)]/g, (_, number) => footnoteReference('vi', number));
    return [...vietnameseQuotes].some((start) => paragraph.startsWith(start)) ? `> ${withReferences}` : withReferences;
  })
  .join('\n\n');

const pages = fs.readFileSync(englishPagesSource, 'utf8').replaceAll('\r', '').split('\f').filter(Boolean);
if (pages.length !== 7) throw new Error(`Expected 7 English PDF pages, received ${pages.length}`);

const englishNotes = new Map();
const englishBodyPages = [];
let activeNote = null;
pages.forEach((page, pageIndex) => {
  const lines = page.split('\n');
  const footnoteStart = pageIndex === 4
    ? lines.findIndex((line, index) => index > 30 && line.startsWith('quae sua sunt'))
    : lines.findIndex((line) => /^\d+$/.test(line));
  if (footnoteStart < 0) throw new Error(`English footnote block not found on page ${pageIndex + 1}`);
  englishBodyPages.push(lines.slice(0, footnoteStart));
  for (const rawLine of lines.slice(footnoteStart)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^\d+$/.test(line)) {
      activeNote = Number(line);
      if (!englishNotes.has(activeNote)) englishNotes.set(activeNote, '');
    } else {
      if (activeNote === null) throw new Error(`Orphan English footnote text on page ${pageIndex + 1}`);
      englishNotes.set(activeNote, `${englishNotes.get(activeNote)} ${line}`.trim());
    }
  }
});

const englishBlocks = [];
englishBodyPages.forEach((lines, pageIndex) => {
  const blocks = lines.join('\n').trim().split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  if (pageIndex === 5 && englishBlocks.length && blocks.length) {
    englishBlocks[englishBlocks.length - 1] += ` ${blocks.shift().replace(/\s*\n\s*/g, ' ')}`;
  }
  englishBlocks.push(...blocks.map((block) => block.replace(/\s*\n\s*/g, ' ')));
});

const englishIntroIndex = englishBlocks.findIndex((block) => block.startsWith('An investigation into the spirituality'));
if (englishIntroIndex < 0) throw new Error('English article opening not found');
englishBlocks.splice(0, englishIntroIndex);

const englishHeadings = new Set([
  'Brief Historic background',
  'Creating a place to share in love',
  'CHRISTUS TOTUS: Living in Love',
  'Conclusion',
]);
const englishQuotes = new Set([
  'Spirituality or charism is',
  'I began to gather together brothers',
  'The community of believers',
  'For no one ought to be so leisured',
  'Just as a human body',
  'Consequently, Christ is for him',
  'It is to what you are',
]);

let englishBody = englishBlocks.map((paragraph) => englishHeadings.has(paragraph) ? `## ${paragraph}` : paragraph).join('\n\n');
let searchFrom = 0;
for (let number = 1; number <= 42; number += 1) {
  const pattern = new RegExp(`(^|[^\\d])${number}(?=$|[^\\d])`, 'm');
  const match = englishBody.slice(searchFrom).match(pattern);
  if (!match || match.index === undefined) throw new Error(`English body reference ${number} not found`);
  const absoluteIndex = searchFrom + match.index;
  const replacement = `${match[1]}${footnoteReference('en', number)}`;
  englishBody = englishBody.slice(0, absoluteIndex) + replacement + englishBody.slice(absoluteIndex + match[0].length);
  searchFrom = absoluteIndex + replacement.length;
}
englishBody = englishBody.split('\n\n')
  .map((paragraph) => [...englishQuotes].some((start) => paragraph.startsWith(start)) ? `> ${paragraph}` : paragraph)
  .join('\n\n');

fs.writeFileSync(vietnameseOutput, `${frontmatterOf(vietnameseOutput)}\n\n${vietnameseBody}\n\n${footnoteSection('vi', vietnameseNotes)}\n`, 'utf8');
fs.writeFileSync(englishOutput, `${frontmatterOf(englishOutput)}\n\n${englishBody}\n\n${footnoteSection('en', englishNotes)}\n`, 'utf8');

console.log(JSON.stringify({
  vietnameseParagraphs: vietnameseBody.split('\n\n').length,
  englishParagraphs: englishBody.split('\n\n').length,
  vietnameseNotes: vietnameseNotes.size,
  englishNotes: englishNotes.size,
}, null, 2));
