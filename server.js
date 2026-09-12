import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { openStore } from './src/store.js';
import { createWorld, advance, intervene, branch } from './src/engine.js';
import { LAWS, METRICS, INTERVENTIONS } from './src/catalog.js';

const root = fileURLToPath(new URL('.', import.meta.url));
export function makeServer({ database = resolve(root, 'data/museum.sqlite') } = {}) {
  const store = openStore(database);
  const server = createServer(async (req, res) => {
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(403, { error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' });
      if (url.pathname.startsWith('/api/')) {
        let body = {};
        if (['POST', 'PATCH'].includes(req.method)) {
          if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'ต้องส่งข้อมูล JSON' });
          let raw = '';
          for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 20000) return json(413, { error: 'ข้อมูลใหญ่เกินไป' }); }
          try { body = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'ข้อมูล JSON ไม่ถูกต้อง' }); }
          if (!body || Array.isArray(body) || typeof body !== 'object') return json(400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
        }
        if (req.method === 'GET' && url.pathname === '/api/catalog') return json(200, { laws: LAWS, metrics: METRICS, interventions: INTERVENTIONS });
        if (url.pathname === '/api/worlds') {
          if (req.method === 'GET') return json(200, store.list().map(({ history, artifacts, snapshots, ...w }) => ({ ...w, artifactCount: artifacts.length })));
          if (req.method === 'POST') return json(201, store.create(createWorld(body)));
        }
        const match = url.pathname.match(/^\/api\/worlds\/([a-f0-9-]+)(?:\/(advance|intervene|branch|artifacts|export))?$/);
        if (!match) return json(404, { error: 'ไม่พบเส้นทาง' });
        const [, id, action] = match, world = store.get(id);
        if (!world) return json(404, { error: 'ไม่พบโลกนี้' });
        if (req.method === 'GET' && (!action || action === 'export')) return json(200, world);
        if (req.method === 'DELETE' && !action) { store.remove(id); return json(200, { deleted: true }); }
        if (req.method === 'POST' && action === 'advance') return json(200, store.save(id, advance(world, body.years)));
        if (req.method === 'POST' && action === 'intervene') return json(200, store.save(id, intervene(world, body.id)));
        if (req.method === 'POST' && action === 'branch') return json(201, store.create(branch(world, body, id)));
        if (req.method === 'PATCH' && action === 'artifacts') {
          const item = world.artifacts.find(a => a.id === body.id);
          if (!item) return json(404, { error: 'ไม่พบวัตถุ' });
          if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) throw new Error('บันทึกยาวได้ไม่เกิน 2,000 ตัวอักษร');
          if (body.featured !== undefined && typeof body.featured !== 'boolean') throw new Error('สถานะจัดแสดงไม่ถูกต้อง');
          if (body.note !== undefined) item.note = body.note;
          if (body.featured !== undefined) item.featured = body.featured;
          return json(200, store.save(id, world));
        }
        return json(405, { error: 'ไม่รองรับคำสั่งนี้' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'ไม่รองรับคำสั่งนี้' });
      const files = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg' };
      const file = files[url.pathname];
      if (!file) return json(404, { error: 'ไม่พบไฟล์' });
      const content = await readFile(resolve(root, 'public', file));
      res.writeHead(200, {
        'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' })[extname(file)],
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error.code) { console.error(error); json(500, { error: 'ระบบจัดเก็บขัดข้อง กรุณาลองใหม่' }); }
      else json(400, { error: error.message });
    }
  });
  server.on('close', () => store.close());
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4317);
  makeServer().listen(port, '127.0.0.1', () => console.log(`Museum is open: http://127.0.0.1:${port}`));
}
