import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'desktop-light', width: 1440, height: 1000, theme: 'light' },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  if (viewport.theme) {
    await page.addInitScript((theme) => localStorage.setItem('augusinh-theme', theme), viewport.theme);
  }
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4321/linh-dao/', { waitUntil: 'networkidle' });

  const initial = await page.evaluate(() => {
    const firstThumb = document.querySelector('.spirit-gallery-thumb');
    const firstRail = document.querySelector('[data-spirit-rail]');
    return {
      quote: document.querySelector('.banner-container .bvq-text')?.textContent?.trim(),
      cards: document.querySelectorAll('.spirit-gallery-card').length,
      sections: document.querySelectorAll('[data-spirit-category]').length,
      filters: [...document.querySelectorAll('[data-spirit-category-toggle]')].map((item) =>
        item.textContent?.replace(/\s+/g, ' ').trim(),
      ),
      overflow: document.documentElement.scrollWidth > innerWidth,
      thumbRatio: firstThumb
        ? Number((firstThumb.getBoundingClientRect().width / firstThumb.getBoundingClientRect().height).toFixed(2))
        : 0,
      railOverflow: firstRail ? firstRail.scrollWidth > firstRail.clientWidth : false,
      railMetrics: firstRail
        ? {
            client: firstRail.clientWidth,
            scroll: firstRail.scrollWidth,
            card: firstRail.querySelector('.spirit-gallery-card')?.getBoundingClientRect().width,
          }
        : null,
      bookmark: document.querySelector('.augnet-edge-bookmark')?.getAttribute('href'),
    };
  });

  await page.locator('[data-spirit-category-toggle="Chú Giải Thánh Vịnh"]').click();
  const hiddenCategory = await page.evaluate(() => ({
    hidden: document.querySelector('[data-spirit-category="Chú Giải Thánh Vịnh"]')?.hidden,
    count: document.querySelector('[data-spirit-visible-count]')?.textContent,
  }));
  await page.locator('[data-spirit-show-all]').first().click();

  let shifted = null;
  const firstNext = page.locator('[data-spirit-category="Chú Giải Thánh Vịnh"] [data-spirit-shift="next"]');
  if (await firstNext.isEnabled()) {
    const rail = page.locator('[data-spirit-category="Chú Giải Thánh Vịnh"] [data-spirit-rail]');
    const before = await rail.evaluate((element) => element.scrollLeft);
    await firstNext.click();
    await page.waitForTimeout(550);
    const after = await rail.evaluate((element) => element.scrollLeft);
    shifted = after > before;
  }

  await page.screenshot({ path: `temp_/linh-dao-${viewport.name}.png`, fullPage: true });
  const href = await page.locator('.spirit-gallery-card a').first().getAttribute('href');
  await page.goto(`http://127.0.0.1:4321${href}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `temp_/linh-dao-article-${viewport.name}.png`, fullPage: true });
  const article = await page.evaluate(() => ({
    title: document.querySelector('.article-hero h1')?.textContent?.trim(),
    heroWidth: document.querySelector('.article-hero')?.getBoundingClientRect().width,
    viewportWidth: innerWidth,
    heroImage: document.querySelector('.article-hero > img')?.getAttribute('src'),
    paragraphs: document.querySelectorAll('.spirit-reader-prose p').length,
    proseClasses: document.querySelector('.spirit-reader-prose')?.className,
    overflow: document.documentElement.scrollWidth > innerWidth,
    source: [...document.querySelectorAll('.spirit-reader-prose p')].at(-1)?.textContent?.trim(),
  }));

  results.push({ viewport, initial, hiddenCategory, shifted, href, article, errors });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
