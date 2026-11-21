import type { APIRoute } from 'astro';
import { proxyStudio } from '../../../lib/studio-proxy';
export const prerender = false;
const handler: APIRoute = ({ request, params }) => proxyStudio(request, `/api/banners/${params.path || ''}`);
export const PUT = handler;
