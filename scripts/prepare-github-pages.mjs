import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = {
  centralIndex: new URL('../src/pages/api/central-news.html.ts', import.meta.url),
  centralPages: new URL('../src/pages/api/central-news-page/[page].html.ts', import.meta.url),
  provinceIndex: new URL('../src/pages/api/province-news.html.ts', import.meta.url),
  provincePages: new URL('../src/pages/api/province-news-page/[page].html.ts', import.meta.url),
};

async function makeStatic(file, staticPaths = '') {
  let source = await readFile(file, 'utf8');
  source = source.replace('export const prerender = false;', 'export const prerender = true;');
  if (staticPaths && !source.includes('export function getStaticPaths()')) {
    source = source.replace('export const prerender = true;', `export const prerender = true;\n\n${staticPaths}`);
  }
  await writeFile(file, source, 'utf8');
}

await makeStatic(files.centralIndex);
await makeStatic(files.centralPages, `export function getStaticPaths() {\n  return Array.from({ length: 11 }, (_, index) => ({ params: { page: String(index + 2) } }));\n}`);
await makeStatic(files.provinceIndex);
await makeStatic(files.provincePages, `export function getStaticPaths() {\n  return Array.from({ length: 56 }, (_, index) => ({ params: { page: String(index + 2) } }));\n}`);

for (const relative of [
  'src/pages/api/central-news-article.ts',
  'src/pages/api/central-news-frame.ts',
  'src/pages/api/province-news-article.ts',
]) {
  await rm(new URL(`../${relative}`, import.meta.url), { force: true });
}

console.log(`Prepared static GitHub Pages sources in ${root}`);
