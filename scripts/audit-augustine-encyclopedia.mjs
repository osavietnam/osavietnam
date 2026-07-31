import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeHTML } from 'entities';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const epubPath = path.join(
  projectRoot,
  'temp_',
  'Fitzgerald - 2009 - Augustine through the Ages An Encyclopedia.epub',
);
const contentDir = path.join(projectRoot, 'src', 'content', 'augustine-encyclopedia');

const archiveText = (entry) =>
  execFileSync('tar', ['-xOf', epubPath, entry], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

const archiveEntries = execFileSync('tar', ['-tf', epubPath], {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
})
  .split(/\r?\n/)
  .filter(Boolean);

const chapterFiles = archiveEntries
  .filter((entry) => /^OEBPS\/\d+_Chapter-[A-W]\d*\.xhtml$/i.test(entry))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const stripHtml = (value) =>
  decodeHTML(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const listHtml = archiveText('OEBPS/006_Entries.xhtml');
const listedTitles = Array.from(listHtml.matchAll(/<p class="li-para">([\s\S]*?)<\/p>/gi))
  .map((match) => stripHtml(match[1]))
  .flatMap((title) =>
    title === 'Possidius Praedestinatione sanctorum, De'
      ? ['Possidius', 'Praedestinatione sanctorum, De']
      : [title]
  )
  .filter(Boolean);

const corpusParts = chapterFiles.map((chapterFile) => ({
  file: chapterFile,
  html: archiveText(chapterFile),
}));
let offset = 0;
const corpusHtml = corpusParts
  .map((part) => {
    part.start = offset;
    offset += part.html.length + 1;
    return part.html;
  })
  .join('\n');

const titleAliases = new Map([
  ['adnotationes in iob', 'adnotationes in job'],
  ['aristotle knowledge of', 'aristotle augustine s knowledge of'],
  ['asceticism pre augustinian', 'asceticism pre augustine'],
  ['canon of scripture septuagint', 'canon of sacred scripture septuagint'],
  ['cappadocians the', 'the cappadocians'],
  ['catholicos fratres ad', 'catholicos fratres ad or de unitate ecclesiae'],
  ['church north african', 'church north african 312 to 430'],
  ['cult of augustine s body arca di s agostino', 'cult of augustine s body'],
  ['definitiones caelestius', 'definitiones'],
  ['discipline correptio admonitio', 'discipline'],
  ['diversis quaestionibus octaginta tribus de', 'diversis quaestionibus octoginta tribus de'],
  ['epistula ad romanos inchoata expositio', 'e pistula ad romanos inchoata expositio'],
  ['eucharistic liturgy', 'the eucharistic liturgy in hippo s basilica major at the time of augustine'],
  ['felix of apthungi', 'felix of apthugni'],
  ['genesi ad litteram de', 'genesi ad litteram liber de'],
  ['hermetic tradition', 'hermetictradition'],
  ['milevius council of', 'milevis council of'],
  ['origine animae et de sententia jacobi de', 'origine animae et de sententia jacobi'],
  ['thagaste souk ahras', 'thagaste'],
]);

const strongParagraphs = Array.from(
  corpusHtml.matchAll(/<(p|h1)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
)
  .map((match) => {
    const strong = match[3].match(/<strong>([\s\S]*?)<\/strong>/i);
    if (!strong) return null;
    const className = match[2].match(/\bclass="([^"]*)"/i)?.[1] ?? '';
    return {
      index: match.index ?? 0,
      className,
      title: stripHtml(strong[1]),
      normalizedTitle: normalize(stripHtml(strong[1])),
      opening: stripHtml(match[3]).slice(0, 240),
    };
  })
  .filter(Boolean);

const starts = [];
const unmatched = [];
const ambiguous = [];
const classPriority = (className) => {
  if (/\b(?:para1|sec1)\b/i.test(className)) return 0;
  if (/\bbib-para\b/i.test(className)) return 1;
  return 2;
};

for (const listedTitle of listedTitles) {
  const listedKey = normalize(listedTitle);
  const expectedKey = titleAliases.get(listedKey) ?? listedKey;
  const candidates = strongParagraphs.filter(
    (paragraph) => paragraph.normalizedTitle === expectedKey,
  ).sort((a, b) =>
    classPriority(a.className) - classPriority(b.className)
    || a.index - b.index
  );
  if (!candidates.length) {
    unmatched.push(listedTitle);
    continue;
  }
  if (candidates.length > 1) {
    ambiguous.push({
      title: listedTitle,
      candidates: candidates.map((candidate) => ({
        className: candidate.className,
        opening: candidate.opening,
      })),
    });
  }
  starts.push({
    ...candidates[0],
    listedTitle,
  });
}

starts.sort((a, b) => a.index - b.index);

const sourceRows = starts.map((start, index) => {
  const end = starts[index + 1]?.index ?? corpusHtml.length;
  const segment = corpusHtml.slice(start.index, end);
  const rightMatches = Array.from(
    segment.matchAll(/<p class="(right|ext|indent-para)">([\s\S]*?)<\/p>/gi),
  )
    .filter((match) =>
      /<span class="smallcaps">/i.test(match[2])
      && stripHtml(match[2]).length <= 140
    )
    .map((match) => stripHtml(match[2]));
  const authors = rightMatches.filter((credit) =>
    !/^(?:trans(?:lated)?\.?|edited|in collaboration with)/i.test(credit)
  );
  const translators = rightMatches.filter((credit) =>
    /^(?:trans(?:lated)?\.?|edited)/i.test(credit)
  );
  const bibliographyHeadings = Array.from(
    segment.matchAll(/<h1 class="sec1">([\s\S]*?IBLIOGRAPHY[\s\S]*?)<\/h1>/gi),
  ).map((match) => stripHtml(match[1]));
  const part = corpusParts.findLast((item) => item.start <= start.index);
  return {
    title: start.listedTitle,
    rawTitle: start.title,
    className: start.className,
    file: part?.file ?? '',
    authors,
    translators,
    allCredits: rightMatches,
    bibliographyHeadings: bibliographyHeadings.length,
  };
});

const parseFrontmatter = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const frontmatter = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? '';
  const scalar = (field) => {
    const value = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    if (!value) return '';
    try {
      return JSON.parse(value);
    } catch {
      return value.replace(/^['"]|['"]$/g, '');
    }
  };
  return {
    file: path.basename(filePath),
    title: scalar('title'),
    author: scalar('author'),
    entryType: scalar('entryType'),
  };
};

const currentEntries = fs
  .readdirSync(contentDir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => parseFrontmatter(path.join(contentDir, file)));

const currentByTitle = new Map(
  currentEntries.map((entry) => [normalize(entry.title), entry]),
);

const authorMismatches = [];
const authorBoundaryProblems = [];
const missingCurrentEntries = [];

for (const source of sourceRows) {
  const expectedAuthors = source.authors;
  if (source.authors.length !== 1) authorBoundaryProblems.push(source);
  const current =
    currentByTitle.get(normalize(source.title))
    ?? currentByTitle.get(normalize(source.rawTitle));
  if (!current) {
    missingCurrentEntries.push(source);
    continue;
  }
  if (
    expectedAuthors.length
    && normalize(current.author) !== normalize(expectedAuthors.join('; '))
  ) {
    authorMismatches.push({
      title: source.title,
      file: current.file,
      current: current.author,
      source: expectedAuthors,
      translators: source.translators,
    });
  }
}

const matchedCurrentFiles = new Set();
for (const source of sourceRows) {
  const current =
    currentByTitle.get(normalize(source.title))
    ?? currentByTitle.get(normalize(source.rawTitle));
  if (current) matchedCurrentFiles.add(current.file);
}
const unmatchedCurrentArticles = currentEntries.filter((entry) =>
  entry.entryType !== 'cross-reference'
  && !matchedCurrentFiles.has(entry.file)
);

const duplicateTitles = [...currentEntries.reduce((groups, entry) => {
  const key = normalize(entry.title);
  const group = groups.get(key) ?? [];
  group.push(entry.file);
  groups.set(key, group);
  return groups;
}, new Map())]
  .filter(([, files]) => files.length > 1)
  .map(([title, files]) => ({ title, files }));

console.log(JSON.stringify({
  counts: {
    listedTitles: listedTitles.length,
    mappedArticleStarts: starts.length,
    currentEntries: currentEntries.length,
    currentArticles: currentEntries.filter((entry) => entry.entryType === 'article').length,
    currentCrossReferences: currentEntries.filter((entry) => entry.entryType === 'cross-reference').length,
  },
  unmatched,
  ambiguous,
  authorBoundaryProblems,
  authorMismatches,
  missingCurrentEntries,
  unmatchedCurrentArticles,
  duplicateTitles,
}, null, 2));
