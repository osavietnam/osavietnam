import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = resolve(root, process.env.GITHUB_SRC_DIR || 'src');
const sourceFile = (relative) => pathToFileURL(resolve(sourceRoot, relative));
const files = {
  centralIndex: sourceFile('pages/api/central-news.html.ts'),
  centralPages: sourceFile('pages/api/central-news-page/[page].html.ts'),
  provinceIndex: sourceFile('pages/api/province-news.html.ts'),
  provincePages: sourceFile('pages/api/province-news-page/[page].html.ts'),
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
  'pages/api/central-news-article.ts',
  'pages/api/central-news-frame.ts',
  'pages/api/province-news-article.ts',
]) {
  await rm(sourceFile(relative), { force: true });
}

console.log(`Prepared static GitHub Pages sources in ${sourceRoot}`);
