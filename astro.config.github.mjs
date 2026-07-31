import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const repository = process.env.GITHUB_REPOSITORY || 'osavietnam/osavietnam';
const [owner = 'osavietnam', repo = 'osavietnam'] = repository.split('/');
const userSiteRepository = `${owner}.github.io`;
const isUserSite = repo.toLowerCase() === userSiteRepository.toLowerCase();
const site = process.env.GITHUB_PAGES_SITE || `https://${owner}.github.io`;
const base = process.env.GITHUB_PAGES_BASE ?? (isUserSite ? undefined : `/${repo}`);

export default defineConfig({
  site,
  ...(base ? { base } : {}),
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
