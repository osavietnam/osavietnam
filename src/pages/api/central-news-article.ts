const SOURCE_ORIGIN = 'https://www.augustinianorder.org';

export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const path = url.searchParams.get('path') ?? '';
  const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';
  if (!path.startsWith('/post/')) return new Response('Invalid article path', { status: 400 });

  try {
    const response = await fetch(new URL(path, SOURCE_ORIGIN), { headers: { 'user-agent': 'augusinh-news-embed/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    let html = await response.text();
    html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    const fitCss = `<meta name="viewport" content="width=device-width,initial-scale=1">
      <base href="${SOURCE_ORIGIN}/">
      <style id="augusinh-article-fit">
        :root{--osa-article-max:1760px;--site-width:100vw!important;--section-max-width:100vw!important;color-scheme:${theme}}
        html,body{margin:0!important;width:100%!important;min-width:0!important;max-width:none!important;overflow-x:hidden!important}
        html[data-augusinh-theme="dark"],html[data-augusinh-theme="dark"] body{background:#08111f!important;color:#f1e8d8!important}
        html[data-augusinh-theme="light"],html[data-augusinh-theme="light"] body{background:#faf7ef!important;color:#27382e!important}
        #SITE_CONTAINER,#SITE_ROOT,#site-root,#masterPage,.site-root,.mesh-layout,main,[role="main"]{width:100%!important;min-width:0!important;max-width:none!important;margin-inline:0!important}
        main>div,main>section,[data-hook="post-page"],[data-testid="blog-post-page"],.blog-post-page,.post-page{width:100%!important;min-width:0!important;max-width:none!important;margin-inline:0!important;box-sizing:border-box!important}
        article,[data-hook="post-content"],[data-testid="post-content"],[data-testid*="post-content"],.post-content{width:min(calc(100% - 12px),var(--osa-article-max))!important;max-width:var(--osa-article-max)!important;margin-inline:auto!important;padding-inline:6px!important;box-sizing:border-box!important}
        article>*,[data-hook="post-content"]>*,[data-testid*="post-content"]>*{max-width:none!important}
        [data-testid="richTextElement"],[data-hook*="rich-text"],.blog-post-description{width:100%!important;max-width:none!important}
        img,picture,video,svg,canvas,iframe{max-width:100%!important;height:auto!important}
        @media(max-width:640px){#content-wrapper{width:calc(100% - 8px)!important;min-width:0!important;max-width:100%!important;margin-inline:4px!important}#content-wrapper>*,#content-wrapper>*>*,#content-wrapper>*>*>*,#content-wrapper>*>*>*>*,#content-wrapper>*>*>*>*>*,#content-wrapper>*>*>*>*>*>*{width:100%!important;min-width:0!important;max-width:100%!important;margin-inline:0!important}article,[data-hook="post-content"],[data-testid="post-content"],[data-testid*="post-content"],.post-content{width:100%!important;max-width:none!important;padding-inline:4px!important}main h1,[role="main"] h1,[data-hook="post-page"] h1,[data-testid="blog-post-page"] h1{font-size:28px!important;line-height:1.22!important}article h2,[data-hook="post-content"] h2,[data-testid*="post-content"] h2,.post-content h2{font-size:20px!important;line-height:1.32!important}article h3,[data-hook="post-content"] h3,[data-testid*="post-content"] h3,.post-content h3{font-size:18px!important;line-height:1.35!important}article p,article li,[data-hook="post-content"] p,[data-hook="post-content"] li,[data-testid*="post-content"] p,[data-testid*="post-content"] li,.post-content p,.post-content li{font-size:15px!important;line-height:1.65!important}article time,[data-hook="post-page"] time,[data-testid="blog-post-page"] time{font-size:12px!important}}
      </style>`;
    const resizeScript = `<script id="augusinh-article-resize">(function(){var report=function(){var root=document.documentElement;var body=document.body;var height=Math.max(root?root.scrollHeight:0,body?body.scrollHeight:0);if(height>0)parent.postMessage({type:'central-news-resize',kind:'article',height:Math.ceil(height)},location.origin)};var fitMobile=function(){if(innerWidth>640)return;var full=function(node){node.style.setProperty('width','100%','important');node.style.setProperty('min-width','0','important');node.style.setProperty('max-width','100%','important');node.style.setProperty('margin-inline','0','important')};var wrapper=document.querySelector('#content-wrapper');if(!wrapper)return;var parent=wrapper;while(parent&&parent!==document.body){full(parent);parent=parent.parentElement}wrapper.style.setProperty('width','calc(100% - 8px)','important');wrapper.style.setProperty('margin-inline','4px','important');var article=document.querySelector('article');var node=article;while(node&&node!==wrapper.parentElement){full(node);node=node.parentElement}document.querySelectorAll('article p,article li').forEach(function(item){var holder=item.parentElement;if(holder){holder.style.setProperty('padding-left','0','important');holder.style.setProperty('padding-right','0','important')}})};var schedule=function(){fitMobile();requestAnimationFrame(report)};var setZoom=function(scale){var zoom=Math.min(1.25,Math.max(1,Number(scale)||1));document.body.style.zoom=String(zoom);document.body.style.width=(100/zoom)+'%';schedule()};window.addEventListener('message',function(event){if(event.origin===location.origin&&event.data&&event.data.type==='central-news-zoom')setZoom(event.data.scale)});window.addEventListener('load',schedule);window.addEventListener('resize',schedule);setTimeout(schedule,0);setTimeout(schedule,600);setTimeout(schedule,1800);setTimeout(schedule,3600)})()</script>`;
    html = html.replace(/<html([^>]*)>/i, `<html$1 data-augusinh-theme="${theme}">`);
    html = html.includes('</head>') ? html.replace('</head>', `${fitCss}</head>`) : `${fitCss}${html}`;
    html = html.includes('</body>') ? html.replace('</body>', `${resizeScript}</body>`) : `${html}${resizeScript}`;
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load article';
    return new Response('<p style="font:16px system-ui;padding:2rem">Unable to load article: ' + message + '</p>', { status: 502, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
