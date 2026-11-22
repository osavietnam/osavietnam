import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { githubPagesEnvironment } from './scripts/github-pages-env.mjs';

const { site, base } = githubPagesEnvironment();

function isTopLevelIndexable(pathname) {
  const routePath = base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/'
    : pathname;
  const segments = routePath.split('/').filter(Boolean);
  const excludedTopLevelRoutes = new Set(['admin', 'api', '404', 'hien-chuong']);
  return segments.length <= 1 && !excludedTopLevelRoutes.has(segments[0]);
}

export default defineConfig({
  site,
  ...(base ? { base } : {}),
  // Giữ cách xử lý khoảng trắng của Astro 5 sau khi nâng cấp lên Astro 7.
  compressHTML: true,
  srcDir: process.env.GITHUB_SRC_DIR || './src',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => isTopLevelIndexable(new URL(page).pathname),
    }),
  ],
  markdown: {
    remarkRehype: {
      footnoteLabel: 'Chú thích',
      footnoteBackLabel: 'Trở lại nội dung',
    },
  },
  vite: {
    define: {
      'import.meta.env.GITHUB_PAGES': JSON.stringify('true'),
    },
  },
});
