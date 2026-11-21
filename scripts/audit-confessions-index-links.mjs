import { chromium } from 'playwright';

const baseUrl = process.env.AUGUSINH_BASE_URL ?? 'http://127.0.0.1:4321';
const romanValues = new Map([
  ['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5], ['VI', 6], ['VII', 7],
  ['VIII', 8], ['IX', 9], ['X', 10], ['XI', 11], ['XII', 12], ['XIII', 13],
  ['XIV', 14], ['XV', 15], ['XVI', 16], ['XVII', 17], ['XVIII', 18],
  ['XIX', 19], ['XX', 20], ['XXI', 21], ['XXII', 22], ['XXIII', 23],
  ['XXIV', 24], ['XXV', 25], ['XXVI', 26], ['XXVII', 27], ['XXVIII', 28],
  ['XXIX', 29], ['XXX', 30], ['XXXI', 31], ['XXXII', 32], ['XXXIII', 33],
  ['XXXIV', 34], ['XXXV', 35], ['XXXVI', 36], ['XXXVII', 37], ['XXXVIII', 38],
  ['XXXIX', 39], ['XL', 40], ['XLI', 41], ['XLII', 42], ['XLIII', 43],
]);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(`${baseUrl}/chi-muc/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
const occurrences = await page.evaluate(() => Array.from(
  document.querySelectorAll('a[title^="Mở Tự Thuật"][href^="/tu-thuat/?book=quyen-"]'),
  (anchor) => ({
    href: anchor.getAttribute('href') ?? '',
    reference: anchor.textContent?.trim() ?? '',
    title: anchor.getAttribute('title') ?? '',
    source: anchor.closest('.idx-confession-links') ? 'scripture' : 'keyword',
  }),
));

const links = Array.from(
  new Map(occurrences.map((link) => [`${link.href}\u0000${link.reference}`, link])).values(),
);
const auditRows = links.map((link) => {
  const url = new URL(link.href, baseUrl);
  const bookMatch = url.searchParams.get('book')?.match(/^quyen-(\d+)$/);
  const anchorMatch = url.hash.match(/^#chi-muc-(\d+)-(\d+)$/);
  const normalizedReference = link.reference.replace(/\s+/g, '');
  const hasExplicitParagraph = /^[IVX]+,\d+(?:,|\()\d+/i.test(normalizedReference);
  return {
    ...link,
    book: bookMatch ? Number(bookMatch[1]) : null,
    chapter: anchorMatch ? Number(anchorMatch[1]) : null,
    paragraph: anchorMatch ? Number(anchorMatch[2]) : null,
    hasExplicitParagraph,
  };
});

const failures = auditRows
  .filter((link) => !link.book || !link.chapter || !link.paragraph)
  .map((link) => ({
    ...link,
    reason: !link.book
      ? 'invalid-book'
      : !link.href.includes('#chi-muc-')
        ? 'missing-exact-anchor'
        : !link.chapter
          ? 'invalid-chapter'
          : 'invalid-paragraph',
  }));

const chapterMaps = {};
const runtimeChecks = [];
for (let book = 1; book <= 13; book += 1) {
  await page.goto(`${baseUrl}/tu-thuat/?book=quyen-${book}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForFunction(
    (slug) => {
      const content = document.getElementById('tt-chapter-content');
      const loading = document.getElementById('tt-chapter-loading');
      return content?.dataset.contentSlug === slug && loading?.hidden;
    },
    `quyen-${book}`,
    { timeout: 45_000 },
  );

  const structure = await page.evaluate((romanEntries) => {
    const roman = new Map(romanEntries);
    const content = document.getElementById('tt-chapter-content');
    const chapters = {};
    let currentChapter = null;
    for (const element of Array.from(content?.children ?? [])) {
      if (element.tagName === 'H4') {
        const match = element.textContent?.trim().match(/^(?:Đoạn|Chương)\s+([IVXLCDM]+)/i);
        currentChapter = match ? roman.get(match[1].toUpperCase()) ?? null : null;
        if (currentChapter) chapters[currentChapter] ??= [];
        continue;
      }
      if (!currentChapter) continue;
      const number = element.querySelector('.article-num')?.textContent?.match(/\d+/)?.[0];
      if (number) chapters[currentChapter].push(Number(number));
    }
    return chapters;
  }, Array.from(romanValues.entries()));
  chapterMaps[book] = structure;

  for (const link of auditRows.filter((item) => item.book === book && item.chapter && item.paragraph)) {
    const paragraphs = structure[link.chapter];
    if (!paragraphs) {
      failures.push({ ...link, reason: 'chapter-not-found' });
    } else if (link.hasExplicitParagraph && !paragraphs.includes(link.paragraph)) {
      failures.push({
        ...link,
        reason: 'paragraph-not-in-chapter',
        availableParagraphs: paragraphs,
      });
    }
  }

  const runtimeSample = auditRows.find((link) => (
    link.book === book
    && link.chapter
    && link.paragraph
    && structure[link.chapter]?.includes(link.paragraph)
  ));
  if (runtimeSample) {
    await page.goto('about:blank');
    await page.goto(`${baseUrl}${runtimeSample.href}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForFunction(
      ({ slug, hash }) => {
        const content = document.getElementById('tt-chapter-content');
        const loading = document.getElementById('tt-chapter-loading');
        return content?.dataset.contentSlug === slug
          && loading?.hidden
          && window.location.hash === hash;
      },
      { slug: `quyen-${book}`, hash: new URL(runtimeSample.href, baseUrl).hash },
      { timeout: 45_000 },
    );
    await page.waitForTimeout(400);
    const runtimeResult = await page.evaluate(({ chapter, paragraph }) => {
      const roman = new Map([
        ['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5], ['VI', 6],
        ['VII', 7], ['VIII', 8], ['IX', 9], ['X', 10], ['XI', 11], ['XII', 12],
        ['XIII', 13], ['XIV', 14], ['XV', 15], ['XVI', 16], ['XVII', 17],
        ['XVIII', 18], ['XIX', 19], ['XX', 20], ['XXI', 21], ['XXII', 22],
        ['XXIII', 23], ['XXIV', 24], ['XXV', 25], ['XXVI', 26], ['XXVII', 27],
        ['XXVIII', 28], ['XXIX', 29], ['XXX', 30], ['XXXI', 31], ['XXXII', 32],
        ['XXXIII', 33], ['XXXIV', 34], ['XXXV', 35], ['XXXVI', 36],
        ['XXXVII', 37], ['XXXVIII', 38], ['XXXIX', 39], ['XL', 40],
        ['XLI', 41], ['XLII', 42], ['XLIII', 43],
      ]);
      const content = document.getElementById('tt-chapter-content');
      const heading = Array.from(content?.querySelectorAll('h4') ?? []).find((element) => {
        const match = element.textContent?.trim().match(/^(?:Đoạn|Chương)\s+([IVXLCDM]+)/i);
        return match && roman.get(match[1].toUpperCase()) === chapter;
      });
      let target = heading;
      let sibling = heading?.nextElementSibling;
      while (sibling && sibling.tagName !== 'H4') {
        const number = sibling.querySelector('.article-num')?.textContent?.match(/\d+/)?.[0];
        if (Number(number) === paragraph) {
          target = sibling;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      const offset = window.__ttScrollOffset?.() ?? 0;
      const actualTop = target?.getBoundingClientRect().top ?? null;
      const expectedTop = offset + 12;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const atDocumentEnd = Math.abs(window.scrollY - maxScroll) <= 3;
      return {
        actualTop,
        expectedTop,
        aligned: actualTop !== null && (
          Math.abs(actualTop - expectedTop) <= 3
          || (atDocumentEnd && actualTop >= expectedTop && actualTop < window.innerHeight)
        ),
      };
    }, { chapter: runtimeSample.chapter, paragraph: runtimeSample.paragraph });
    runtimeChecks.push({ book, reference: runtimeSample.reference, ...runtimeResult });
  }
}

const uniqueFailures = Array.from(
  new Map(failures.map((failure) => [
    `${failure.href}\u0000${failure.reference}\u0000${failure.reason}`,
    failure,
  ])).values(),
);

const report = {
  occurrenceCount: occurrences.length,
  uniqueLinkCount: links.length,
  checkedBooks: Object.keys(chapterMaps).length,
  failureCount: uniqueFailures.length,
  failures: uniqueFailures,
  runtimeChecks,
  pageErrors: errors,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const countsByReason = Object.groupBy(uniqueFailures, (failure) => failure.reason);
  console.log(`Occurrences: ${report.occurrenceCount}`);
  console.log(`Unique links: ${report.uniqueLinkCount}`);
  console.log(`Failures: ${report.failureCount}`);
  console.log(`Runtime samples aligned: ${runtimeChecks.filter((row) => row.aligned).length}/${runtimeChecks.length}`);
  if (process.argv.includes('--summary')) {
    for (const row of runtimeChecks) {
      console.log(`Runtime book ${row.book} ${row.reference}: top=${row.actualTop}, expected=${row.expectedTop}, aligned=${row.aligned}`);
    }
  }
  console.log(`Page errors: ${report.pageErrors.length}`);
  console.log(`By reason: ${Object.entries(countsByReason).map(([reason, rows]) => `${reason}=${rows.length}`).join(', ')}`);
  if (process.argv.includes('--summary')) {
    await browser.close();
    process.exit(0);
  }
  for (let book = 1; book <= 13; book += 1) {
    const bookFailures = uniqueFailures.filter((failure) => failure.book === book);
    if (!bookFailures.length) continue;
    console.log(`\nBOOK ${book} (${bookFailures.length})`);
    for (const failure of bookFailures) {
      const available = failure.availableParagraphs?.length
        ? `; chapter has ${failure.availableParagraphs.join(',')}`
        : '';
      console.log(`- ${failure.reference} [${failure.source}]: ${failure.reason}${available}`);
    }
  }
}

await browser.close();
