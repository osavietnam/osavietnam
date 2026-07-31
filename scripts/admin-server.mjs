/**
 * Admin API server — CRUD cho src/content/kinh-sach/
 * Chạy: npm run admin  (port 4322)
 * Sau mỗi thao tác ghi/xóa, tự rebuild src/data/kinh-sach-index.json
 * Astro dev server sẽ hot-reload tự động khi file thay đổi.
 */
import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT          = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT       = path.join(ROOT, 'src/content/kinh-sach');
const SAINTS_DIR    = path.join(ROOT, 'src/content/thanh-chan-phuoc');
const INDEX_PATH    = path.join(ROOT, 'src/data/kinh-sach-index.json');
const BANNERS_PATH  = path.join(ROOT, 'src/data/banners.json');
const HEADERS_PATH  = path.join(ROOT, 'src/data/page-headers.json');
const ON_GOI_PATH   = path.join(ROOT, 'src/data/on-goi-content.json');
const BANNERS_IMG   = path.join(ROOT, 'public/images/banners');
const PORT          = 4322;
const UTF8          = { encoding: 'utf8' };

// ─── Frontmatter helpers ────────────────────────────────────────────────────

function splitMd(raw) {
  raw = raw.replace(/^﻿/, ''); // strip UTF-8 BOM (PowerShell 5.1 adds it)
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  return { fm: parseFm(m[1]), body: m[2] };
}

function parseFm(text) {
  const fm = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v === 'true')       v = true;
    else if (v === 'false') v = false;
    else if (/^\d+$/.test(v)) v = +v;
    else if (/^["'][\s\S]*["']$/.test(v)) v = v.slice(1, -1);
    fm[m[1]] = v;
  }
  return fm;
}

const FM_KEYS       = ['title','season','seasonKey','source','excerpt','liturgy','rank','order','draft','manualFill'];
const SAINT_FM_KEYS = ['title','subtitle','rank','feastDay','feastMonth','imageFile','draft','manualFill'];

function toMd(fm, body) {
  const q = v =>
    typeof v === 'boolean' ? String(v) :
    typeof v === 'number'  ? String(v) :
    `"${String(v ?? '').replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
  const lines = ['---', ...FM_KEYS.filter(k => k in fm).map(k => `${k}: ${q(fm[k])}`), '---', ''];
  return lines.join('\n') + (body || '').trim();
}

// ─── Index rebuild ───────────────────────────────────────────────────────────

function rebuildIndex() {
  const index = {};
  for (const season of fs.readdirSync(CONTENT).sort()) {
    const dir = path.join(CONTENT, season);
    if (!fs.statSync(dir).isDirectory()) continue;
    const entries = [];
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
      const slug = file.slice(0, -3);
      const { fm } = splitMd(fs.readFileSync(path.join(dir, file), UTF8));
      if (fm.draft === true) continue;
      entries.push({
        id:      `${season}/${slug}`,
        slug,
        url:     `/kinh-sach/${season}/${slug}/`,
        author:  String(fm.source  || ''),
        excerpt: String(fm.excerpt || ''),
        liturgy: String(fm.liturgy || fm.title || ''),
        rank:    String(fm.rank    || ''),
        _ord:    Number(fm.order)  || 0,
      });
    }
    entries.sort((a, b) => a._ord - b._ord).forEach(e => delete e._ord);
    if (entries.length) index[season] = entries;
  }
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index), UTF8);
  console.log(`[rebuild] index.json — ${Object.values(index).flat().length} bài`);
  return index;
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const p    = url.pathname;
  const json = (d, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json;charset=utf-8' }); res.end(JSON.stringify(d)); };
  const err  = (msg, s = 400) => json({ error: msg }, s);

  try {
    // ── GET /api/entries ── list all entries (from filesystem)
    if (p === '/api/entries' && req.method === 'GET') {
      const result = {};
      for (const season of fs.readdirSync(CONTENT).sort()) {
        const dir = path.join(CONTENT, season);
        if (!fs.statSync(dir).isDirectory()) continue;
        result[season] = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(file => {
          const slug = file.slice(0, -3);
          const { fm, body } = splitMd(fs.readFileSync(path.join(dir, file), UTF8));
          return { id: `${season}/${slug}`, slug, title: String(fm.title || slug),
            author: String(fm.source || ''), liturgy: String(fm.liturgy || ''),
            seasonLabel: String(fm.season || season), draft: !!fm.draft, order: Number(fm.order) || 0,
            hasContent: body.trim().length > 0 };
        }).sort((a, b) => a.order - b.order);
      }
      return json(result);
    }

    // ── GET /api/entry?id=season/slug ── full entry
    if (p === '/api/entry' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const [season, ...rest] = id.split('/');
      const file = path.join(CONTENT, season, rest.join('/') + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      const { fm, body } = splitMd(fs.readFileSync(file, UTF8));
      return json({ fm, body });
    }

    // ── POST /api/entry ── create new
    if (p === '/api/entry' && req.method === 'POST') {
      const { seasonKey, slug, fm, body } = await readBody(req);
      if (!seasonKey || !slug) return err('Thiếu seasonKey hoặc slug');
      if (!/^[a-z0-9-]+$/.test(slug)) return err('Slug chỉ dùng chữ thường, số và gạch nối');
      const dir  = path.join(CONTENT, seasonKey);
      const file = path.join(dir, slug + '.md');
      if (fs.existsSync(file)) return err('File đã tồn tại. Dùng PUT để cập nhật.');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, toMd(fm, body), UTF8);
      rebuildIndex();
      return json({ ok: true, id: `${seasonKey}/${slug}`, url: `/kinh-sach/${seasonKey}/${slug}/` });
    }

    // ── PUT /api/entry?id=... ── update (rename slug / change season supported)
    if (p === '/api/entry' && req.method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const { fm, body, newSlug } = await readBody(req);
      const [oldSeason, ...oldRest] = id.split('/');
      const oldSlug   = oldRest.join('/');
      const newSeason = fm.seasonKey || oldSeason;
      const finalSlug = newSlug || oldSlug;
      if (!/^[a-z0-9-]+$/.test(finalSlug)) return err('Slug không hợp lệ');
      const oldFile = path.join(CONTENT, oldSeason, oldSlug + '.md');
      const newDir  = path.join(CONTENT, newSeason);
      const newFile = path.join(newDir, finalSlug + '.md');
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      if (oldFile !== newFile && fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      fs.writeFileSync(newFile, toMd(fm, body), UTF8);
      rebuildIndex();
      return json({ ok: true, id: `${newSeason}/${finalSlug}` });
    }

    // ── DELETE /api/entry?id=... ── delete
    if (p === '/api/entry' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const [season, ...rest] = id.split('/');
      const file = path.join(CONTENT, season, rest.join('/') + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      fs.unlinkSync(file);
      rebuildIndex();
      return json({ ok: true });
    }

    // ── GET /api/saints ── list all thanh-chan-phuoc entries
    if (p === '/api/saints' && req.method === 'GET') {
      const entries = fs.readdirSync(SAINTS_DIR).filter(f => f.endsWith('.md')).sort().map(file => {
        const slug = file.slice(0, -3);
        const { fm, body } = splitMd(fs.readFileSync(path.join(SAINTS_DIR, file), UTF8));
        return { id: slug, title: String(fm.title || slug), subtitle: String(fm.subtitle || ''),
          rank: String(fm.rank || 'none'), feastDay: fm.feastDay, feastMonth: fm.feastMonth,
          draft: !!fm.draft, manualFill: !!fm.manualFill, hasContent: body.trim().length > 0 };
      });
      return json(entries);
    }

    // ── GET /api/saint?id=slug ── full entry
    if (p === '/api/saint' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const file = path.join(SAINTS_DIR, id + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      const { fm, body } = splitMd(fs.readFileSync(file, UTF8));
      return json({ fm, body });
    }

    // ── PUT /api/saint?id=slug ── update entry
    if (p === '/api/saint' && req.method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return err('Thiếu id');
      const { fm, body } = await readBody(req);
      const file = path.join(SAINTS_DIR, id + '.md');
      if (!fs.existsSync(file)) return err('Không tìm thấy', 404);
      const q = v =>
        typeof v === 'boolean' ? String(v) :
        typeof v === 'number'  ? String(v) :
        `"${String(v ?? '').replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
      const lines = ['---', ...SAINT_FM_KEYS.filter(k => k in fm).map(k => `${k}: ${q(fm[k])}`), '---', ''];
      fs.writeFileSync(file, lines.join('\n') + (body || '').trim(), UTF8);
      return json({ ok: true });
    }

    // ── GET /api/banners ── return all banner config
    if (p === '/api/banners' && req.method === 'GET') {
      return json(JSON.parse(fs.readFileSync(BANNERS_PATH, UTF8)));
    }

    // ── PUT /api/banners/:key ── update one banner key
    if (p.startsWith('/api/banners/') && req.method === 'PUT') {
      const key = decodeURIComponent(p.slice('/api/banners/'.length));
      const body = await readBody(req);
      const all = JSON.parse(fs.readFileSync(BANNERS_PATH, UTF8));
      if (!(key in all)) return err('Không tìm thấy banner key: ' + key, 404);
      all[key] = body;
      fs.writeFileSync(BANNERS_PATH, JSON.stringify(all, null, 2), UTF8);
      return json({ ok: true });
    }

    // ── GET /api/banner-images ── list available banner image files
    if (p === '/api/banner-images' && req.method === 'GET') {
      const files = fs.readdirSync(BANNERS_IMG)
        .filter(f => /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(f))
        .map(f => '/images/banners/' + f);
      return json(files);
    }

    // ── POST /api/banner-images ── upload a new banner image (base64 JSON)
    if (p === '/api/banner-images' && req.method === 'POST') {
      const { filename, data } = await readBody(req);
      if (!filename || !data) return err('Thiếu filename hoặc data');
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(safeName)) return err('Định dạng không hỗ trợ');
      const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (buf.length > 8 * 1024 * 1024) return err('File quá lớn (tối đa 8 MB)');
      fs.writeFileSync(path.join(BANNERS_IMG, safeName), buf);
      return json({ ok: true, url: '/images/banners/' + safeName });
    }

    // ── GET /api/on-goi ── return on-goi page content
    if (p === '/api/on-goi' && req.method === 'GET') {
      return json(JSON.parse(fs.readFileSync(ON_GOI_PATH, UTF8)));
    }

    // ── PUT /api/on-goi ── update on-goi page content
    if (p === '/api/on-goi' && req.method === 'PUT') {
      const body = await readBody(req);
      fs.writeFileSync(ON_GOI_PATH, JSON.stringify(body, null, 2), UTF8);
      return json({ ok: true });
    }

    // ── GET /api/page-headers ── return all masthead config
    if (p === '/api/page-headers' && req.method === 'GET') {
      return json(JSON.parse(fs.readFileSync(HEADERS_PATH, UTF8)));
    }

    // ── PUT /api/page-headers/:key ── update one page header key
    if (p.startsWith('/api/page-headers/') && req.method === 'PUT') {
      const key = decodeURIComponent(p.slice('/api/page-headers/'.length));
      const body = await readBody(req);
      const all = JSON.parse(fs.readFileSync(HEADERS_PATH, UTF8));
      if (!(key in all)) return err('Không tìm thấy page-header key: ' + key, 404);
      all[key] = body;
      fs.writeFileSync(HEADERS_PATH, JSON.stringify(all, null, 2), UTF8);
      return json({ ok: true });
    }

    err('Không tìm thấy endpoint', 404);
  } catch (e) {
    console.error(e);
    err(e.message, 500);
  }
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  Admin API  →  http://localhost:${PORT}     ║`);
  console.log('║  Admin     →  http://localhost:4321/admin/      ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
