import type { APIRoute } from 'astro';
import { proxyStudio } from '../../../lib/studio-proxy';
export const prerender = false;
export const GET: APIRoute = ({ request }) => proxyStudio(request, '/api/page-headers');
