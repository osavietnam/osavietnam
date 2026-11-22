import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { githubPagesEnvironment } from './scripts/github-pages-env.mjs';

const { site, base } = githubPagesEnvironment();

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
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return !pathname.startsWith('/hien-chuong')
          && !pathname.startsWith('/admin')
          && !pathname.startsWith('/api/');
      },
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
