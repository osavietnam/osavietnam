const { chromium } = require('playwright');

const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:4331';
const base = (process.env.SMOKE_BASE || '/osavietnam').replace(/\/$/, '');

function isOutsideBase(url) {
  const parsed = new URL(url);
  return parsed.origin === origin
    && parsed.pathname !== base
    && !parsed.pathname.startsWith(`${base}/`);
}

function isRootPathOutsideBase(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && value !== base
    && !value.startsWith(`${base}/`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const failures = [];
  const results = {};

  async function open(route) {
    const page = await context.newPage();
    const errors = [];
    const rootRequests = [];
    const badResponses = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      try {
        if (isOutsideBase(request.url())) rootRequests.push(new URL(request.url()).pathname);
      } catch {}
    });
    page.on('response', (response) => {
      try {
        const url = new URL(response.url());
        if (url.origin === origin && response.status() >= 400) {
          badResponses.push(`${response.status()} ${url.pathname}`);
        }
      } catch {}
    });
    await page.goto(`${origin}${base}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(300);
    return {
      page,
      errors,
      rootRequests: [...new Set(rootRequests)],
      badResponses: [...new Set(badResponses)],
    };
  }

  const routes = [
    '/', '/on-goi/', '/kinh-sach/', '/tu-thuat/', '/tu-luat/', '/hien-phap/',
    '/ratio/', '/lich-phung-vu/', '/thanh-chan-phuoc/',
  ];
  for (const route of routes) {
    const audit = await open(route);
    results[`runtime ${route}`] = {
      errors: audit.errors,
      rootRequests: audit.rootRequests,
      badResponses: audit.badResponses,
    };
    if (audit.errors.length || audit.rootRequests.length || audit.badResponses.length) {
      failures.push(`runtime ${route}`);
    }
    await audit.page.close();
  }

  {
    const audit = await open('/on-goi/');
    const media = await audit.page.evaluate(() => ({
      brokenImages: [...document.images]
        .filter((image) => image.src && image.complete && image.naturalWidth === 0)
        .map((image) => image.src),
      rootAttributes: [...document.querySelectorAll('[src],[href]')]
        .flatMap((element) => ['src', 'href'].map((attribute) => element.getAttribute(attribute)))
        .filter((value) => value && value.startsWith('/')),
    }));
    media.rootAttributes = media.rootAttributes.filter(isRootPathOutsideBase);
    results.vocation = media;
    if (media.brokenImages.length || media.rootAttributes.length) failures.push('vocation media');
    await audit.page.close();
  }

  {
    const audit = await open('/kinh-sach/');
    await audit.page.waitForSelector('#todayCard', { state: 'visible' });
    const today = await audit.page.evaluate(() => ({
      text: document.querySelector('#todayCard')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      options: [...document.querySelectorAll('#todaySelect option')]
        .map((option) => ({ value: option.value, text: option.textContent })),
      rowUrls: [...document.querySelectorAll('[data-url]')]
        .map((element) => element.getAttribute('data-url'))
        .filter(Boolean),
    }));
    today.badRows = today.rowUrls.filter(isRootPathOutsideBase);
    delete today.rowUrls;
    results.readingsToday = today;
    const expectedTwoOnReleaseDate = new Date().toISOString().startsWith('2026-08-14');
    if (today.text.includes('Năm ?')
      || !today.options.length
      || (expectedTwoOnReleaseDate && today.options.length !== 2)
      || today.options.some((option) => !new URL(option.value, origin).pathname.startsWith(`${base}/`))
      || today.badRows.length) {
      failures.push('readings today');
    }
    const firstReadingPath = new URL(today.options[0].value, origin).pathname;
    const response = await audit.page.goto(`${origin}${firstReadingPath}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    const destination = {
      status: response?.status() || 0,
      path: new URL(audit.page.url()).pathname,
      proseLength: await audit.page.locator('article.prose').textContent().then((text) => text?.length || 0),
    };
    results.readingsDestination = destination;
    if (destination.status !== 200
      || !destination.path.startsWith(`${base}/`)
      || destination.proseLength < 500) {
      failures.push('readings destination');
    }
    await audit.page.close();
  }

  {
    const audit = await open('/tu-thuat/');
    await audit.page.locator('.tt-book-tab[data-fragment-slug="quyen-1"]').click();
    await audit.page.waitForFunction(() => (
      document.querySelector('#tt-chapter-content')?.dataset.contentSlug === 'quyen-1'
    ));
    const book = await audit.page.evaluate(() => ({
      slug: document.querySelector('#tt-chapter-content')?.dataset.contentSlug,
      length: document.querySelector('#tt-chapter-content')?.textContent?.length || 0,
      failed: /không thể tải/i.test(document.querySelector('#tt-chapter-content')?.textContent || ''),
    }));
    results.confessions = book;
    if (book.slug !== 'quyen-1' || book.length < 1000 || book.failed) failures.push('confessions lazy load');
    await audit.page.close();
  }

  for (const route of ['/tu-luat/', '/hien-phap/', '/ratio/']) {
    const audit = await open(route);
    const english = audit.page.locator('.doc-lang-tab[data-doc-id$="-en"]').first();
    const id = await english.getAttribute('data-doc-id');
    await english.click();
    await audit.page.waitForFunction((expectedId) => (
      document.querySelector(`[data-doc-id="${expectedId}"]`)?.classList.contains('active')
    ), id);
    await audit.page.waitForTimeout(300);
    const switched = await audit.page.evaluate(() => ({
      path: location.pathname,
      language: document.documentElement.lang,
      length: document.querySelector('article.prose')?.textContent?.length || 0,
    }));
    results[`language ${route}`] = switched;
    if (!switched.path.startsWith(`${base}/`) || switched.language !== 'en' || switched.length < 1000) {
      failures.push(`document language ${route}`);
    }
    await audit.page.close();
  }

  {
    const audit = await open('/linh-dao/bai-viet/hiep-nhat-trong-duc-ai/');
    await audit.page.locator('[data-spirit-language="en"]').click();
    const switched = await audit.page.evaluate(() => ({
      englishHidden: document.querySelector('[data-spirit-language-panel="en"]')?.hidden,
      vietnameseHidden: document.querySelector('[data-spirit-language-panel="vi"]')?.hidden,
      englishLength: document.querySelector('[data-spirit-language-panel="en"]')?.textContent?.length || 0,
    }));
    results.articleLanguage = switched;
    if (switched.englishHidden !== false || switched.vietnameseHidden !== true || switched.englishLength < 500) {
      failures.push('article language');
    }
    await audit.page.close();
  }

  {
    const audit = await open('/thanh-chan-phuoc/');
    await audit.page.waitForSelector('#ucTrack a.saint-card');
    const cards = await audit.page.evaluate(() => (
      [...document.querySelectorAll('#ucTrack a.saint-card')].map((card) => ({
        name: card.getAttribute('aria-label'),
        href: card.href,
        background: getComputedStyle(card).getPropertyValue('--sc-bg'),
      }))
    ));
    const destinations = [];
    for (const card of cards) {
      const response = await audit.page.request.get(card.href);
      destinations.push({
        name: card.name,
        status: response.status(),
        path: new URL(card.href).pathname,
      });
    }
    const badBackgrounds = cards
      .filter((card) => {
        const path = card.background.match(/url\(['"]?([^'")]+)/)?.[1] || '';
        return isRootPathOutsideBase(path);
      })
      .map((card) => card.name);
    results.upcomingSaints = { count: cards.length, destinations, badBackgrounds };
    if (cards.length !== 8
      || destinations.some((card) => card.status !== 200 || !card.path.startsWith(`${base}/`))
      || badBackgrounds.length) {
      failures.push('upcoming saints links');
    }
    const first = audit.page.locator('#ucTrack a.saint-card').first();
    const expected = new URL(await first.getAttribute('href'), origin).pathname;
    await first.click();
    await audit.page.waitForLoadState('domcontentloaded');
    const actual = new URL(audit.page.url()).pathname;
    results.upcomingSaints.desktopClick = { expected, actual };
    if (actual !== expected) failures.push('upcoming saints desktop click');
    await audit.page.close();
  }

  {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await mobile.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}${base}/thanh-chan-phuoc/`, { waitUntil: 'networkidle' });
    const first = page.locator('#ucTrack a.saint-card').first();
    const expected = new URL(await first.getAttribute('href'), origin).pathname;
    const before = new URL(page.url()).pathname;
    await first.tap();
    await page.waitForTimeout(150);
    const afterFirst = {
      path: new URL(page.url()).pathname,
      selected: await first.evaluate((element) => element.classList.contains('is-touch-selected')),
    };
    await Promise.all([
      page.waitForURL((url) => url.pathname === expected, { timeout: 10000 }),
      first.tap(),
    ]);
    const afterSecond = new URL(page.url()).pathname;
    results.upcomingSaintsMobile = { before, expected, afterFirst, afterSecond, errors };
    if (afterFirst.path !== before || !afterFirst.selected || afterSecond !== expected || errors.length) {
      failures.push('upcoming saints mobile two-tap');
    }
    await mobile.close();
  }

  await browser.close();
  console.log(JSON.stringify({ ok: failures.length === 0, failures, results }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
