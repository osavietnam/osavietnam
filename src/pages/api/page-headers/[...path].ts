import type { APIRoute } from 'astro';
import { proxyStudio } from '../../../lib/studio-proxy';
export const prerender = false;
export const PUT: APIRoute = ({ request, params }) => proxyStudio(request, `/api/page-headers/${params.path || ''}`);
