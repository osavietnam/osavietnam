import { defineMiddleware } from 'astro:middleware';

const canonicalHost = 'osavietnam.org';

export const onRequest = defineMiddleware((context, next) => {
  if (context.isPrerendered) return next();

  const forwardedHost = context.request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || context.request.headers.get('host') || context.url.host;
  const hostname = requestHost.split(':')[0].toLowerCase();

  if (hostname === `www.${canonicalHost}`) {
    const target = new URL(context.url.pathname + context.url.search, `https://${canonicalHost}`);
    return context.redirect(target.toString(), 301);
  }

  return next();
});
