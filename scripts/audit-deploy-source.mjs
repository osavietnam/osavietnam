import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoots = ['src', 'public'];
const textExtensions = new Set(['.astro', '.css', '.html', '.js', '.json', '.md', '.mdx', '.mjs', '.ts', '.xml', '.yml', '.yaml']);
const problems = [];
const caseMap = new Map();

async function filesIn(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { return []; }
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

const files = (await Promise.all(sourceRoots.map((directory) => filesIn(join(root, directory))))).flat();
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  const key = rel.normalize('NFC').toLocaleLowerCase('en-US');
  if (caseMap.has(key)) problems.push(`Case/Unicode path conflict: ${caseMap.get(key)} <> ${rel}`);
  else caseMap.set(key, rel);
  if (rel !== rel.normalize('NFC')) problems.push(`Non-NFC filename: ${rel}`);

  const unsafeSegments = rel.split('/').filter((segment) =>
    /[<>:"\\|?*#%]/.test(segment) || /#U[0-9A-Fa-f]{4,6}/.test(segment) || /[. ]$/.test(segment)
  );
  if (unsafeSegments.length) problems.push(`Unsafe cross-platform filename: ${rel}`);

  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch (error) { problems.push(`Cannot read UTF-8: ${rel}: ${error.message}`); continue; }
  if (source.charCodeAt(0) === 0xfeff) problems.push(`UTF-8 BOM: ${rel}`);

  if (extname(file).toLowerCase() === '.json') {
    try { JSON.parse(source); } catch (error) { problems.push(`Invalid JSON: ${rel}: ${error.message}`); }
  }

  const publicUrls = new Set();
  const publicUrlPattern = /\b(?:src|poster)\s*=\s*["'](\/[^"'#?]+)["']/gi;
  for (const match of source.matchAll(publicUrlPattern)) publicUrls.add(match[1]);

  const cssUrlPattern = /url\(\s*["']?(\/(?!\/)[^"')?#]+)["']?\s*\)/gi;
  for (const match of source.matchAll(cssUrlPattern)) publicUrls.add(match[1]);

  for (const publicUrl of publicUrls) {
    let pathname;
    try { pathname = decodeURIComponent(publicUrl); }
    catch { problems.push(`Invalid encoded public URL: ${rel} -> ${publicUrl}`); continue; }
    const target = join(root, 'public', pathname.replace(/^\/+/, ''));
    if (!(await exists(target))) problems.push(`Missing public asset: ${rel} -> ${publicUrl}`);
  }
}


// Detect direct page-route collisions and coming-soon routes shadowing real pages.
const pageRoot = join(root, 'src', 'pages');
const pageFiles = await filesIn(pageRoot);
const staticRoutes = new Map();
for (const file of pageFiles) {
  const rel = relative(pageRoot, file).split(sep).join('/');
  if (!/\.(?:astro|md|mdx|html)$/.test(rel) || rel.includes('[')) continue;
  let route = '/' + rel.replace(/\.(?:astro|md|mdx|html)$/, '');
  route = route.replace(/\/index$/, '/').replace(/\/+/g, '/');
  if (!route.endsWith('/') && !extname(route)) route += '/';
  if (staticRoutes.has(route)) problems.push(`Duplicate static route ${route}: ${staticRoutes.get(route)} <> ${rel}`);
  else staticRoutes.set(route, rel);
}
try {
  const comingSoon = await readFile(join(pageRoot, '[...comingsoon].astro'), 'utf8');
  const block = comingSoon.match(/const PENDING[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  for (const match of block.matchAll(/['"]([^'"]+)['"]\s*:/g)) {
    const route = `/${match[1]}/`;
    if (staticRoutes.has(route)) problems.push(`Coming-soon route shadows real page ${route}: ${staticRoutes.get(route)}`);
  }
} catch {}

// Detect duplicate slug fields inside individual JSON datasets.
for (const file of files.filter((item) => extname(item).toLowerCase() === '.json')) {
  let value;
  try { value = JSON.parse(await readFile(file, 'utf8')); } catch { continue; }
  const seen = new Map();
  const walk = (node, path = '$') => {
    if (Array.isArray(node)) { node.forEach((item, index) => walk(item, `${path}[${index}]`)); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.slug === 'string') {
      const key = node.slug.normalize('NFC').toLocaleLowerCase('en-US');
      if (seen.has(key)) problems.push(`Duplicate JSON slug in ${relative(root, file)}: ${node.slug} at ${seen.get(key)} and ${path}`);
      else seen.set(key, path);
    }
    for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`);
  };
  walk(value);
}

const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (lock.lockfileVersion !== 3) problems.push(`Unsupported package-lock version: ${lock.lockfileVersion}`);
if (lock.packages?.['']?.name !== pkg.name) problems.push('package.json and package-lock.json names differ');
if (!pkg.engines?.node) problems.push('Missing Node.js engine constraint');
if (!pkg.packageManager) problems.push('Missing packageManager pin');

const required = [
  '.github/workflows/deploy.yml',
  '.gitignore',
  '.nvmrc',
  'astro.config.github.mjs',
  'scripts/build-github-pages.mjs',
  'scripts/validate-github-pages-build.mjs',
];
for (const item of required) {
  if (!(await exists(join(root, item)))) problems.push(`Missing deploy file: ${item}`);
}

if (problems.length) {
  console.error(`Source audit failed with ${problems.length} problem(s):`);
  for (const problem of problems.slice(0, 120)) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Source audit passed: ${files.length} files checked, paths are cross-platform safe, JSON and referenced public assets are valid.`);
}
