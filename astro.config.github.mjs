import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { githubPagesEnvironment } from './scripts/github-pages-env.mjs';

const { site, base } = githubPagesEnvironment();

export default defineConfig({
  site,
  ...(base ? { base } : {}),
  srcDir: process.env.GITHUB_SRC_DIR || './src',
  output: 'static',
  integrations: [mdx(), sitemap()],
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
