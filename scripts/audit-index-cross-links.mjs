import { chromium } from 'playwright';

const baseUrl = process.env.AUGUSINH_BASE_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(`${baseUrl}/chi-muc/`, {
  waitUntil: 'domcontentloaded',
  timeout: 90_000,
});

const report = await page.evaluate(() => {
  const failures = [];
  const directLinks = Array.from(document.querySelectorAll('a[data-keyword-see]'));
  const directTargetLinks = directLinks.filter((link) => {
    const hash = link.getAttribute('href') ?? '';
    return /^#kw-\d+$/.test(hash);
  });
  const searchFallbackLinks = directLinks.filter((link) => link.dataset.keywordSearch);

  for (const link of directTargetLinks) {
    const hash = link.getAttribute('href') ?? '';
    const target = document.querySelector(hash);
    const sourceWork = link.closest('[data-index-work-panel]')?.getAttribute('data-index-work-panel');
    const targetWork = target?.closest('[data-index-work-panel]')?.getAttribute('data-index-work-panel');
    if (!target) {
      failures.push({ type: 'missing-keyword-target', text: link.textContent?.trim(), hash, sourceWork });
    } else if (sourceWork !== targetWork) {
      failures.push({
        type: 'cross-work-keyword-target',
        text: link.textContent?.trim(),
        hash,
        sourceWork,
        targetWork,
      });
    }
  }

  return {
    directKeywordLinkCount: directTargetLinks.length,
    searchFallbackCount: searchFallbackLinks.length,
    searchFallbackSamples: searchFallbackLinks.slice(0, 30).map((link) => ({
      work: link.closest('[data-index-work-panel]')?.getAttribute('data-index-work-panel'),
      text: link.textContent?.trim(),
      query: link.dataset.keywordSearch,
    })),
    failureCount: failures.length,
    failureSamples: failures.slice(0, 30),
  };
});

const runtimeChecks = [];
for (const work of ['confessions']) {
  await page.goto(`${baseUrl}/chi-muc/#tu-khoa`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  const link = page.locator(
    `[data-index-work-panel="${work}"] a[data-keyword-see][href^="#kw-"]`,
  ).first();
  if (await link.count() === 0) {
    runtimeChecks.push({ work, checked: false, reason: 'no-direct-see-link' });
    continue;
  }
  const hash = await link.getAttribute('href');
  await link.evaluate((element) => element.click());
  await page.waitForTimeout(80);
  runtimeChecks.push({
    work,
    checked: true,
    hash,
    locationHash: await page.evaluate(() => location.hash),
    targetHighlighted: await page.locator(`${hash}.is-jump-target`).count() === 1,
    workVisible: await page.locator(`[data-index-work-panel="${work}"]:not([hidden])`).count() === 1,
    keywordPanelVisible: await page.locator(
      `[data-index-work-panel="${work}"] [data-index-panel="keywords"]:not([hidden])`,
    ).count() === 1,
  });
}

const output = { ...report, runtimeChecks, pageErrors };
console.log(JSON.stringify(output, null, 2));
await browser.close();

if (
  output.failureCount
  || output.pageErrors.length
  || runtimeChecks.some((check) => (
    check.checked
    && (!check.targetHighlighted || !check.workVisible || !check.keywordPanelVisible || check.hash !== check.locationHash)
  ))
) {
  process.exitCode = 1;
}
