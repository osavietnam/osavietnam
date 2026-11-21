import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:4321/tu-thuat/');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'C:/Users/jayce/AppData/Local/Temp/tu-thuat-after.png' });
const m = await page.evaluate(() => {
  const nav = document.querySelector('.tt-book-nav');
  const r = nav?.getBoundingClientRect();
  return { vw: window.innerWidth, navLeft: r?.left, navRight: r?.right, navWidth: r?.width };
});
console.log(JSON.stringify(m));
await browser.close();
