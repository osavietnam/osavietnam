import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataPath = path.join(root, 'src/data/confessions-keyword-index.json');
const contentDir = path.join(root, 'src/content/tu-thuat');

const romanValues = new Map([
  ['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5], ['VI', 6],
  ['VII', 7], ['VIII', 8], ['IX', 9], ['X', 10], ['XI', 11],
  ['XII', 12], ['XIII', 13],
]);
const numberRomans = new Map(Array.from(romanValues, ([roman, number]) => [number, roman]));
const referencePattern = /\b(XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)[,.]\s*(\d+)\s*\(([\d,.\s–—-]+)\)/gi;
const romanDigitValues = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const romanToInt = (value) => {
  let total = 0;
  let previous = 0;
  for (const character of value.toUpperCase().split('').reverse()) {
    const current = romanDigitValues[character] ?? 0;
    total += current < previous ? -current : current;
    previous = Math.max(previous, current);
  }
  return total || null;
};

const structure = new Map();
for (let book = 1; book <= 13; book += 1) {
  const markdown = fs.readFileSync(path.join(contentDir, `quyen-${book}.md`), 'utf8');
  const chapters = new Map();
  let chapter = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^####\s+\S+\s+([IVXLCDM]+)/i);
    if (heading) {
      chapter = romanToInt(heading[1]);
      if (chapter) chapters.set(chapter, chapters.get(chapter) ?? new Set());
      continue;
    }
    const paragraph = line.match(/^(\d+)\s+/);
    if (chapter && paragraph) chapters.get(chapter).add(Number(paragraph[1]));
  }
  structure.set(book, chapters);
}

const firstParagraph = (value) => Number(value.match(/\d+/)?.[0] ?? 0);
const isValid = (book, chapter, paragraph) =>
  structure.get(book)?.get(chapter)?.has(paragraph) ?? false;

const suggest = (book, chapter, paragraph) => {
  const sameCoordinates = [];
  for (let candidateBook = 1; candidateBook <= 13; candidateBook += 1) {
    if (isValid(candidateBook, chapter, paragraph)) sameCoordinates.push(candidateBook);
  }
  if (sameCoordinates.length === 1) {
    return `${numberRomans.get(sameCoordinates[0])},${chapter}(${paragraph})`;
  }

  const sameBookChapters = [];
  for (const [candidateChapter, paragraphs] of structure.get(book) ?? []) {
    if (paragraphs.has(paragraph)) sameBookChapters.push(candidateChapter);
  }
  if (sameBookChapters.length === 1) {
    return `${numberRomans.get(book)},${sameBookChapters[0]}(${paragraph})`;
  }
  return null;
};

const keywordData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const rows = [];
for (const entry of keywordData.entries) {
  for (const line of entry.lines) {
    const text = line.displayText ?? line.text;
    for (const match of text.matchAll(referencePattern)) {
      // The printed source occasionally uses one citation to cover a
      // paragraph range spanning a chapter boundary; preserve that notation.
      if (/[–—-]/.test(match[3])) continue;
      const book = romanValues.get(match[1].toUpperCase());
      const chapter = Number(match[2]);
      const paragraph = firstParagraph(match[3]);
      if (!book || !chapter || !paragraph || isValid(book, chapter, paragraph)) continue;
      rows.push({
        entry: entry.headword,
        page: line.page,
        column: line.column,
        y: line.y,
        reference: match[0],
        suggestion: suggest(book, chapter, paragraph),
        text,
      });
    }
  }
}

const unique = Array.from(new Map(
  rows.map((row) => [
    `${row.page}:${row.column}:${row.y}:${row.reference}`,
    row,
  ]),
).values());
const suggested = unique.filter((row) => row.suggestion);
console.log(`Invalid keyword citations: ${unique.length}`);
console.log(`Unambiguous structural suggestions: ${suggested.length}`);
for (const row of unique) {
  console.log(
    `p${row.page} ${row.column} y${row.y} | ${row.entry} | `
    + `${row.reference} -> ${row.suggestion ?? '?'} | ${row.text}`,
  );
}
