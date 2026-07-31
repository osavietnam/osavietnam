import { proxyNews } from '../../lib/news-proxy';

export const prerender = true;

export function getStaticPaths() {
  return [];
}

export const GET = proxyNews;
