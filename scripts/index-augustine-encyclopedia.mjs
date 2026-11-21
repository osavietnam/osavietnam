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
const outputDir = path.join(projectRoot, 'src', 'content', 'augustine-encyclopedia');
const shouldWrite = process.argv.includes('--write');
const overwrite = process.argv.includes('--overwrite');
const refreshGenerated = process.argv.includes('--refresh-generated');

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
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTitle = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseFrontmatterScalar = (source, field) => {
  const value = source.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!value) return '';
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^['"]|['"]$/g, '');
  }
};

const existingByTitle = new Map(
  fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const source = fs.readFileSync(path.join(outputDir, file), 'utf8');
        return [
          normalizeTitle(parseFrontmatterScalar(source, 'title')),
          {
            file,
            titleVi: parseFrontmatterScalar(source, 'titleVi'),
            translationStatus:
              parseFrontmatterScalar(source, 'translationStatus') || 'placeholder',
          },
        ];
      })
    : [],
);

const fallbackVietnameseTitles = new Map([
  ['eriugena john scottus', 'John Scottus Eriugena'],
  ['eucharistic liturgy', 'Phụng Vụ Thánh Thể'],
  [
    'life culture and controversies of augustine',
    'Cuộc Đời, Văn Hóa và Các Cuộc Tranh Luận của Thánh Augustinô',
  ],
  ['possidius', 'Possidius'],
]);

const slugify = (value) =>
  normalizeTitle(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entry';

const listHtml = archiveText('OEBPS/006_Entries.xhtml');
const listedTitles = Array.from(listHtml.matchAll(/<p class="li-para">([\s\S]*?)<\/p>/gi))
  .map((match) => stripHtml(match[1]))
  .flatMap((title) =>
    title === 'Possidius Praedestinatione sanctorum, De'
      ? ['Possidius', 'Praedestinatione sanctorum, De']
      : [title]
  )
  .filter(Boolean);
const listedTitleKeys = new Set(listedTitles.map(normalizeTitle));
const listedToBodyTitleAliases = new Map([
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
const expectedBodyTitleKeys = new Set(
  listedTitles.map((title) => {
    const key = normalizeTitle(title);
    return listedToBodyTitleAliases.get(key) ?? key;
  }),
);

const sourceEntries = [];
// Một số mục từ chạy qua ranh giới hai file (A1/A2, C1–C4, M1/M2...).
// Nối toàn bộ chapter trước khi cắt entry giúp giữ đúng tác giả và thư mục ở file kế tiếp.
const corpusHtml = chapterFiles.map((chapterFile) => archiveText(chapterFile)).join('\n');
const candidateStarts = Array.from(
  corpusHtml.matchAll(/<(p|h1)\b[^>]*>([\s\S]*?)<\/\1>/gi),
)
  .map((match) => {
    const strong = match[2].match(/<strong>([\s\S]*?)<\/strong>/i);
    const className = match[0].match(/\bclass="([^"]*)"/i)?.[1] ?? '';
    return strong
      ? {
          index: match.index ?? 0,
          html: match[0],
          className,
          titleHtml: strong[1],
          normalizedTitle: normalizeTitle(stripHtml(strong[1])),
        }
      : null;
  })
  .filter(Boolean);
const classPriority = (className) => {
  if (/\b(?:para1|sec1)\b/i.test(className)) return 0;
  if (/\bbib-para\b/i.test(className)) return 1;
  return 2;
};
const starts = listedTitles
  .map((title) => {
    const listedKey = normalizeTitle(title);
    const expectedKey = listedToBodyTitleAliases.get(listedKey) ?? listedKey;
    return candidateStarts
      .filter((candidate) => candidate.normalizedTitle === expectedKey)
      .sort((a, b) =>
        classPriority(a.className) - classPriority(b.className)
        || a.index - b.index
      )[0];
  })
  .filter(Boolean)
  .sort((a, b) => a.index - b.index);

starts.forEach((match, index) => {
  const start = match.index;
  const end = starts[index + 1]?.index ?? corpusHtml.length;
  const segment = corpusHtml.slice(start, end);
  const rawTitle = stripHtml(match.titleHtml);
  const creditMatches = Array.from(
    segment.matchAll(/<p class="(?:right|ext|indent-para)">([\s\S]*?)<\/p>/gi),
  ).filter((credit) =>
    /<span class="smallcaps">/i.test(credit[1])
    && stripHtml(credit[1]).length <= 140
  );
  const authors = creditMatches
    .map((credit) => stripHtml(credit[1]))
    .filter((credit) =>
      !/^(?:trans(?:lated)?\.?|edited|in collaboration with)/i.test(credit)
    );
  const author = authors.join('; ');
  const bibliographyHeading = segment.match(
    /<h1 class="sec1">B[\s\S]*?IBLIOGRAPHY[\s\S]*?<\/h1>/i
  );
  let bibliography = [];

  if (bibliographyHeading) {
    const bibliographyStart =
      (bibliographyHeading.index ?? 0) + bibliographyHeading[0].length;
    const authorStart = creditMatches.length
      ? creditMatches.at(-1).index ?? segment.length
      : segment.length;
    const bibliographyHtml = segment.slice(bibliographyStart, authorStart);
    bibliography = Array.from(
      bibliographyHtml.matchAll(/<p class="(?:bib-para|bib-in)">([\s\S]*?)<\/p>/gi)
    )
      .map((item) => stripHtml(item[1]))
      .filter((item) => item && !/^(editions?|translations?|studies)$/i.test(item));

    if (!bibliography.length) {
      const fallback = stripHtml(bibliographyHtml);
      if (fallback) bibliography = [fallback];
    }
  }

  const entryType =
      author
    || bibliography.length
    || /<p class="indent-para">/i.test(segment)
      ? 'article'
      : 'cross-reference';
  const seeAlsoParagraphs = Array.from(
    segment.matchAll(/<p class="indent-para-a">([\s\S]*?)<\/p>/gi)
  )
    .map((item) => stripHtml(item[1]).replace(/^(?:→|see(?: also)?)\s*/i, '').trim())
    .filter(Boolean);

  if (entryType === 'cross-reference' && !seeAlsoParagraphs.length) {
    const openingParagraph = segment.match(
      /^<(?:p|h1)\b[^>]*>([\s\S]*?)<\/(?:p|h1)>/i
    );
    const openingText = openingParagraph ? stripHtml(openingParagraph[1]) : '';
    const arrowIndex = openingText.indexOf('→');
    if (arrowIndex >= 0) seeAlsoParagraphs.push(openingText.slice(arrowIndex + 1).trim());
  }

  const seeAlso = seeAlsoParagraphs.flatMap((value) =>
    value.split(';').map((item) => item.trim()).filter(Boolean)
  );

  sourceEntries.push({
    rawTitle,
    normalizedTitle: normalizeTitle(rawTitle),
    author,
    bibliography,
    entryType,
    seeAlso,
  });
});

const unusedSource = new Set(sourceEntries.map((_, index) => index));
const matched = [];
const unmatched = [];
const canonicalTitleBySourceIndex = new Map();

for (const [orderIndex, title] of listedTitles.entries()) {
  const normalized = normalizeTitle(title);
  const expectedBodyKey = listedToBodyTitleAliases.get(normalized) ?? normalized;
  let sourceIndex = sourceEntries.findIndex(
    (entry, index) => unusedSource.has(index) && entry.normalizedTitle === expectedBodyKey
  );

  if (sourceIndex < 0) {
    const candidates = sourceEntries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) =>
        unusedSource.has(index)
        && (
          normalized.startsWith(`${entry.normalizedTitle} `)
          || entry.normalizedTitle.startsWith(`${normalized} `)
        )
      );
    if (candidates.length === 1) sourceIndex = candidates[0].index;
  }

  if (sourceIndex < 0) {
    unmatched.push(title);
    matched.push({
      title,
      author: '',
      bibliography: [],
      entryType: 'article',
      seeAlso: [],
      order: orderIndex + 1,
    });
    continue;
  }

  unusedSource.delete(sourceIndex);
  canonicalTitleBySourceIndex.set(sourceIndex, title);
  matched.push({
    title,
    ...sourceEntries[sourceIndex],
    order: orderIndex + 1,
  });
}

const usedSlugs = new Map();
const entries = matched.map((entry) => {
  const title = entry.title;
  const baseSlug = slugify(title);
  const duplicateNumber = (usedSlugs.get(baseSlug) ?? 0) + 1;
  usedSlugs.set(baseSlug, duplicateNumber);
  return {
    ...entry,
    title,
    order: entry.order,
    slug: duplicateNumber === 1 ? baseSlug : `${baseSlug}-${duplicateNumber}`,
    letter: title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[A-Z]/i)?.[0].toUpperCase() ?? 'A',
  };
});

const yamlString = (value) => JSON.stringify(value);
const articlePlaceholderBody =
  '*Mục từ này đã được tạo sẵn để bổ sung bản dịch tiếng Việt. Nội dung sẽ được biên tập từ bản gốc và giữ thống nhất hệ thống trích dẫn của website.*';

const serializeEntry = (entry) => {
  const existing = existingByTitle.get(normalizeTitle(entry.title));
  const titleVi =
    existing?.titleVi
    || fallbackVietnameseTitles.get(normalizeTitle(entry.title))
    || entry.title;
  const lines = [
    '---',
    `title: ${yamlString(entry.title)}`,
    `titleVi: ${yamlString(titleVi)}`,
    `letter: ${yamlString(entry.letter)}`,
    `author: ${yamlString(entry.author)}`,
    `entryType: ${yamlString(entry.entryType)}`,
    ...(entry.seeAlso.length
      ? ['seeAlso:', ...entry.seeAlso.map((item) => `  - ${yamlString(item)}`)]
      : ['seeAlso: []']),
    ...(entry.bibliography.length
      ? ['bibliography:', ...entry.bibliography.map((item) => `  - ${yamlString(item)}`)]
      : ['bibliography: []']),
    `sourcePages: ${yamlString(`Mục từ “${entry.title}”`)}`,
    `order: ${entry.order}`,
    'translationStatus: "placeholder"',
    'draft: false',
    '---',
    '',
    entry.entryType === 'cross-reference'
      ? `*Mục dẫn chiếu trong nguyên bản${entry.seeAlso.length ? `: ${entry.seeAlso.join('; ')}` : ''}.*`
      : articlePlaceholderBody,
    '',
  ];
  return lines.join('\n');
};

let written = 0;
let skipped = 0;
let pruned = 0;

if (shouldWrite) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of entries) {
    const target = path.join(outputDir, `${entry.slug}.md`);
    if (fs.existsSync(target) && !overwrite) {
      const current = fs.readFileSync(target, 'utf8');
      const isGeneratedPlaceholder =
        (parseFrontmatterScalar(current, 'translationStatus') || 'placeholder')
        === 'placeholder';
      if (!refreshGenerated || !isGeneratedPlaceholder) {
        skipped += 1;
        continue;
      }
    }
    fs.writeFileSync(target, serializeEntry(entry), 'utf8');
    written += 1;
  }

  if (process.argv.includes('--prune-generated')) {
    const canonicalFiles = new Set(entries.map((entry) => `${entry.slug}.md`));
    for (const file of fs.readdirSync(outputDir).filter((item) => item.endsWith('.md'))) {
      if (canonicalFiles.has(file)) continue;
      const target = path.join(outputDir, file);
      const source = fs.readFileSync(target, 'utf8');
      const status = parseFrontmatterScalar(source, 'translationStatus') || 'placeholder';
      if (status !== 'placeholder') continue;
      fs.unlinkSync(target);
      pruned += 1;
    }
  }
}

const sourceWithoutMatch = [...unusedSource].map((index) => sourceEntries[index].rawTitle);
const missingAuthors = entries.filter((entry) => !entry.author).map((entry) => entry.title);
const missingBibliography = entries
  .filter((entry) => entry.entryType === 'article' && !entry.bibliography.length)
  .map((entry) => entry.title);
const anomalousSeeAlso = entries
  .filter((entry) => entry.seeAlso.some((item) => item.length > 180))
  .map((entry) => ({ title: entry.title, seeAlso: entry.seeAlso }));

console.log(JSON.stringify({
  mode: shouldWrite ? 'write' : 'dry-run',
  chapterFiles: chapterFiles.length,
  listedEntries: listedTitles.length,
  parsedEntries: sourceEntries.length,
  generatedEntries: entries.length,
  matchedEntries: listedTitles.length - unmatched.length,
  unmatchedListedEntries: unmatched,
  unusedParsedEntries: sourceWithoutMatch,
  crossReferences: entries.filter((entry) => entry.entryType === 'cross-reference').length,
  missingAuthors,
  missingBibliography,
  anomalousSeeAlso,
  written,
  skipped,
  pruned,
}, null, 2));
