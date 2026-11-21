const SOURCE_ORIGIN = 'https://www.augustinianorder.org';

export async function proxyNews(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const sourcePath = requestUrl.pathname.startsWith('/news') ? requestUrl.pathname : '/news';
    const sourceUrl = new URL(sourcePath, SOURCE_ORIGIN);
    sourceUrl.search = requestUrl.search;
    const response = await fetch(sourceUrl, { headers: { 'user-agent': 'augusinh-news-embed/1.0' } });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);

    let html = await response.text();
    const css = `<style id="augusinh-news-isolation">html,body{margin:0!important;min-width:0!important;overflow-x:hidden!important}</style>`;
    const script = `<script>(()=>{const isolate=()=>{const target=document.getElementById('comp-mn54cd9a');if(!target||!target.parentElement)return;let keep=target;while(keep.parentElement&&keep.parentElement!==document.body){const parent=keep.parentElement;Array.from(parent.children).forEach(child=>{if(child!==keep)child.style.display='none'});keep=parent}Array.from(document.body.children).forEach(child=>{if(child!==keep)child.style.display='none'});keep.style.display='';document.documentElement.style.overflowX='hidden'};const routeNewsLinks=(event)=>{const anchor=event.target instanceof Element?event.target.closest('a'):null;if(!anchor)return;let url;try{url=new URL(anchor.href,location.href)}catch{return}if(url.hostname==='www.augustinianorder.org'&&url.pathname.startsWith('/news')){event.preventDefault();location.href=url.pathname+url.search+url.hash}};document.addEventListener('click',routeNewsLinks,true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',isolate,{once:true});else isolate();new MutationObserver(isolate).observe(document.documentElement,{childList:true,subtree:true})})();</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${css}</head>`) : `${css}${html}`;
    html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load source';
    return new Response(`<p style="font:16px system-ui;padding:2rem">Unable to load news: ${message}</p>`, { status: 502, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
