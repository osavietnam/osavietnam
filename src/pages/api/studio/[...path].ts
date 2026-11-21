import type { APIRoute } from 'astro';
import { proxyStudio } from '../../../lib/studio-proxy';

export const prerender = false;
const handler: APIRoute = ({ request, params }) => proxyStudio(request, `/api/studio/${params.path || ''}`);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
