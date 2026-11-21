import { chromium } from 'playwright';

const baseUrl = process.env.AUGUSINH_BASE_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true });
const output = [];

for (const viewport of [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/chi-muc/#tu-khoa`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => ({
    confessionsVisible: !document.querySelector('[data-index-work-panel="confessions"]')?.hidden,
    keywordsVisible: !document.querySelector(
      '[data-index-work-panel="confessions"] [data-index-panel="keywords"]',
    )?.hidden,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));

  const link = page.locator(
    '[data-index-work-panel="confessions"] a[data-keyword-see]',
  ).first();
  await link.evaluate((element) => element.click());
  await page.waitForTimeout(80);

  const after = await page.evaluate(() => ({
    hash: location.hash,
    highlighted: Boolean(document.querySelector(
      '[data-index-work-panel="confessions"] .is-jump-target',
    )),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }));

  output.push({ viewport: viewport.name, before, after, pageErrors });
  await page.close();
}

console.log(JSON.stringify(output, null, 2));
await browser.close();

if (output.some((row) => (
  !row.before.confessionsVisible
  || !row.before.keywordsVisible
  || row.before.horizontalOverflow
  || row.after.horizontalOverflow
  || !row.after.highlighted
  || row.pageErrors.length
))) {
  process.exitCode = 1;
}
