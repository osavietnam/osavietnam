import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  // Domain production (dùng cho canonical URL và sitemap).
  site: 'https://osavietnam.org',
  // Giữ cách xử lý khoảng trắng của Astro 5 sau khi nâng cấp lên Astro 7.
  compressHTML: true,
  // The Central News iframe is fetched from its source at request time.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  preview: { host: true, port: 4321 },
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
});
