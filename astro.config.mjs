import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  // Đổi thành domain thật khi deploy (cần cho SEO/sitemap)
  site: 'https://augusinh.github.io',
  // The Central News iframe is fetched from its source at request time.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  preview: { host: true, port: 4321 },
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkRehype: {
      footnoteLabel: 'Chú thích',
      footnoteBackLabel: 'Trở lại nội dung',
    },
  },
});
