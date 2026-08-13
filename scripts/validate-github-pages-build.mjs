import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubPagesEnvironment } from './github-pages-env.mjs';

const dist = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const { base } = githubPagesEnvironment();
const missing = [];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else files.push(path);
  }
  return files;
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

async function localTargetExists(sourceFile, rawUrl) {
  const clean = rawUrl.trim().replace(/&amp;/g, '&').split('#')[0].split('?')[0];
  if (!clean || clean === '/' || /^(?:[a-z]+:|#|\/\/)/i.test(clean)) return true;
  let pathname = clean;
  if (base && pathname.startsWith(`${base}/`)) pathname = pathname.slice(base.length);
  else if (base && pathname === base) pathname = '/';
  else if (pathname.startsWith('/')) return false;

  let candidate;
  if (pathname.startsWith('/')) candidate = join(dist, pathname.slice(1));
  else candidate = resolve(dirname(sourceFile), pathname);
  candidate = normalize(candidate);
  if (!candidate.startsWith(dist + sep) && candidate !== dist) return false;

  const candidates = [candidate];
  if (pathname.endsWith('/')) candidates.push(join(candidate, 'index.html'));
  if (!extname(candidate)) candidates.push(`${candidate}.html`, join(candidate, 'index.html'));
  return (await Promise.all(candidates.map(exists))).some(Boolean);
}

async function validateCssUrls(file, source) {
  const pattern = /url\((?:\s*)(["']?)([^"')]+)\1(?:\s*)\)/gi;
  for (const match of source.matchAll(pattern)) {
    if (!(await localTargetExists(file, match[2].trim()))) missing.push(`${relative(dist, file)} -> ${match[2].trim()}`);
  }
}

const files = await filesIn(dist);
for (const file of files) {
  const extension = extname(file).toLowerCase();
  if (extension !== '.html' && extension !== '.css') continue;
  const source = await readFile(file, 'utf8');
  if (extension === '.css') { await validateCssUrls(file, source); continue; }

  const htmlMarkup = source.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  const attributePattern = /\b(?:href|src|poster|action|formaction|data-href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of htmlMarkup.matchAll(attributePattern)) {
    if (!(await localTargetExists(file, match[1]))) missing.push(`${relative(dist, file)} -> ${match[1]}`);
  }
  const srcsetPattern = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  for (const match of htmlMarkup.matchAll(srcsetPattern)) {
    for (const candidate of match[1].split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean)) {
      if (!(await localTargetExists(file, candidate))) missing.push(`${relative(dist, file)} -> ${candidate}`);
    }
  }
  await validateCssUrls(file, htmlMarkup);
}

for (const required of ['index.html', '.nojekyll']) {
  if (!(await exists(join(dist, required)))) missing.push(`missing required output: ${required}`);
}

if (missing.length) {
  console.error('Missing local targets:', missing.slice(0, 60));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} GitHub Pages output files; no missing local targets found.`);
}
