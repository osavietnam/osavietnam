import type { APIRoute } from 'astro';
import { proxyStudio } from '../../lib/studio-proxy';
export const prerender = false;
const handler: APIRoute = ({ request }) => proxyStudio(request, '/api/on-goi');
export const GET = handler;
export const PUT = handler;
