import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubPagesEnvironment } from './github-pages-env.mjs';

const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const { base: basePath } = githubPagesEnvironment();
const processedExtensions = new Set(['.html', '.css']);
const CENTRAL_NEWS_ORIGIN = 'https://www.augustinianorder.org';
const PROVINCE_NEWS_ORIGIN = 'https://www.osa.org.au';

function decodeHtmlAttribute(value) {
  return value.replace(/&amp;/gi, '&').replace(/&#38;/g, '&').replace(/&#x26;/gi, '&');
}

function encodeHtmlAttribute(value, quote) {
  let output = value.replace(/&/g, '&amp;');
  output = quote === '"' ? output.replace(/"/g, '&quot;') : output.replace(/'/g, '&#39;');
  return output;
}

function addBaseToRootPath(value) {
  if (!basePath || !value.startsWith('/') || value.startsWith('//')) return value;
  if (value === basePath || value.startsWith(`${basePath}/`)) return value;
  return `${basePath}${value}`;
}

function rewriteServerOnlyNewsUrl(rawValue) {
  const decoded = decodeHtmlAttribute(rawValue);
  let url;
  try { url = new URL(decoded, 'https://static.local'); } catch { return decoded; }
  let routePath = url.pathname;
  if (basePath && (routePath === basePath || routePath.startsWith(`${basePath}/`))) {
    routePath = routePath.slice(basePath.length) || '/';
  }
  if (routePath === '/api/central-news-article') {
    const articlePath = url.searchParams.get('path');
    if (articlePath?.startsWith('/post/')) {
      try { return new URL(articlePath, CENTRAL_NEWS_ORIGIN).href; } catch {}
    }
  }
  if (routePath === '/api/province-news-article') {
    const sourceUrl = url.searchParams.get('url');
    try {
      const external = new URL(sourceUrl || '', PROVINCE_NEWS_ORIGIN);
      if (external.protocol === 'https:' || external.protocol === 'http:') return external.href;
    } catch {}
  }
  return decoded;
}

function rewriteCssUrls(source) {
  if (!basePath) return source;
  return source.replace(/url\((\s*)(["']?)(\/(?!\/)[^"')]*?)\2(\s*)\)/gi, (full, before, quote, value, after) => {
    return `url(${before}${quote}${addBaseToRootPath(value)}${quote}${after})`;
  });
}

function rewriteSrcset(value) {
  return value.split(',').map((candidate) => {
    const leading = candidate.match(/^\s*/)?.[0] ?? '';
    const trailing = candidate.match(/\s*$/)?.[0] ?? '';
    const body = candidate.trim();
    if (!body || /^data:/i.test(body)) return candidate;
    const match = body.match(/^(\S+)([\s\S]*)$/);
    if (!match) return candidate;
    return `${leading}${addBaseToRootPath(decodeHtmlAttribute(match[1]))}${match[2]}${trailing}`;
  }).join(',');
}

function rewriteHtmlMarkup(source) {
  const urlAttributePattern = /\b(href|src|poster|action|formaction|data-href|data-url|data-src|data-original-src)\s*=\s*(["'])([^"']*)\2/gi;
  let output = source.replace(urlAttributePattern, (full, name, quote, rawValue) => {
    let value = decodeHtmlAttribute(rawValue);
    if (String(name).toLowerCase() === 'href') value = rewriteServerOnlyNewsUrl(value);
    value = addBaseToRootPath(value);
    return `${name}=${quote}${encodeHtmlAttribute(value, quote)}${quote}`;
  });
  output = output.replace(/\bsrcset\s*=\s*(["'])([\s\S]*?)\1/gi, (full, quote, value) => {
    return `srcset=${quote}${encodeHtmlAttribute(rewriteSrcset(value), quote)}${quote}`;
  });
  return rewriteCssUrls(output);
}

function rewriteHtmlDocument(source) {
  const scripts = [];
  const protectedSource = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) => {
    const openEnd = block.indexOf('>');
    const openingTag = openEnd >= 0 ? rewriteHtmlMarkup(block.slice(0, openEnd + 1)) : block;
    const protectedBlock = openEnd >= 0 ? openingTag + block.slice(openEnd + 1) : block;
    const token = `__OSA_SCRIPT_BLOCK_${scripts.length}__`;
    scripts.push(protectedBlock);
    return token;
  });
  let output = rewriteHtmlMarkup(protectedSource);
  scripts.forEach((block, index) => { output = output.replace(`__OSA_SCRIPT_BLOCK_${index}__`, block); });
  return output;
}

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

const files = (await filesIn(outputDirectory)).filter((path) => processedExtensions.has(extname(path).toLowerCase()));
let changed = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const extension = extname(file).toLowerCase();
  const output = extension === '.html' ? rewriteHtmlDocument(source) : rewriteCssUrls(source);
  if (output !== source) {
    await writeFile(file, output, 'utf8');
    changed += 1;
  }
}

await writeFile(join(outputDirectory, '.nojekyll'), '', 'utf8');
const root404 = join(outputDirectory, '404.html');
const nested404 = join(outputDirectory, '404', 'index.html');
try { await stat(root404); } catch {
  try { await mkdir(outputDirectory, { recursive: true }); await copyFile(nested404, root404); } catch {}
}
console.log(`GitHub Pages base path ${basePath || '/'} safely applied to ${changed} HTML/CSS files.`);
