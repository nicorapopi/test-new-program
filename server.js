import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { openStore } from './src/store.js';
import { createWorld, advance, intervene, branch } from './src/engine.js';
import { LAWS, METRICS, INTERVENTIONS } from './src/catalog.js';
import { randomBytes } from 'node:crypto';
import { digest, verifyPassword, limiter, configFromEnv } from './src/security.js';

const root = fileURLToPath(new URL('.', import.meta.url));
export function makeServer({ database = resolve(root, 'data/museum.sqlite'), authRequired = false, publicOrigin = '', maxWorlds = 20, maxTotalWorlds = 200, requestLimit = 120, simulationLimit = 12, loginLimit = 20 } = {}) {
  if (authRequired && !publicOrigin) throw new Error('Authentication requires PUBLIC_ORIGIN');
  const store = openStore(database);
  const allowedOrigin = publicOrigin ? new URL(publicOrigin).origin : null;
  const secure = allowedOrigin?.startsWith('https:');
  const cookieName = secure ? '__Host-unlived' : 'unlived-session';
  const cookie = (token, age) => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const loginAllowed = limiter(loginLimit, 600000), requestsAllowed = limiter(requestLimit, 60000), simulationAllowed = limiter(simulationLimit, 60000);
  let pendingLogins = 0;
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      // Health probes never expose data and need no proxy Host override.
      if (req.method === 'GET' && url.pathname === '/healthz') { store.healthy(); return json(200, { status: 'ok' }); }
      const expectedOrigin = allowedOrigin || `http://${req.headers.host}`;
      const allowedHost = allowedOrigin ? req.headers.host === new URL(allowedOrigin).host : /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(req.headers.host || '');
      if (!allowedHost) return json(403, { error: 'Host ไม่ได้รับอนุญาต' });
      const mutating = !['GET', 'HEAD'].includes(req.method);
      if ((req.headers.origin && req.headers.origin !== expectedOrigin) || (authRequired && mutating && req.headers.origin !== expectedOrigin)) return json(403, { error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' });
      if (url.pathname.startsWith('/api/')) {
        const rawToken = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
        const tokenHash = digest(rawToken);
        const user = authRequired ? store.session(tokenHash) : { id: 'local', username: 'โหมดส่วนตัว' };
        if (url.pathname === '/api/session' && req.method === 'GET') return json(200, { authenticated: !!user, authRequired, username: user?.username });
        const isLogin = url.pathname === '/api/login' && req.method === 'POST';
        if (isLogin) {
          if (!authRequired) return json(400, { error: 'โหมดนี้ไม่ต้องเข้าสู่ระบบ' });
          // Deliberately do not trust forwarded IP headers. Beta proxy shares one login budget.
          if (!loginAllowed(req.socket.remoteAddress || 'unknown') || pendingLogins >= 4) { res.setHeader('Retry-After', '600'); return json(429, { error: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 10 นาที' }); }
        } else if (!user) return json(401, { error: 'กรุณาเข้าสู่ระบบ' });
        if (!isLogin && !requestsAllowed(user.id)) { res.setHeader('Retry-After', '60'); return json(429, { error: 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่' }); }
        let body = {};
        if (['POST', 'PATCH'].includes(req.method)) {
          if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'ต้องส่งข้อมูล JSON' });
          let chunks = [], size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 20000) return json(413, { error: 'ข้อมูลใหญ่เกินไป' }); chunks.push(chunk); }
          const raw = Buffer.concat(chunks).toString('utf8');
          try { body = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'ข้อมูล JSON ไม่ถูกต้อง' }); }
          if (!body || Array.isArray(body) || typeof body !== 'object') return json(400, { error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
        }
        if (isLogin) {
          if (typeof body.username !== 'string' || !/^[a-z0-9_-]{3,32}$/.test(body.username) || typeof body.password !== 'string' || body.password.length > 128) return json(401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
          const account = store.user(body.username);
          pendingLogins++;
          let valid;
          try { valid = await verifyPassword(body.password, account?.password_hash); } finally { pendingLogins--; }
          if (!valid || !account) return json(401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
          // A password reset during the asynchronous hash check must invalidate this login.
          if (store.user(body.username)?.password_hash !== account.password_hash) return json(401, { error: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
          const token = randomBytes(32).toString('hex');
          store.addSession(digest(token), account.id, Date.now() + 12 * 3600000);
          res.setHeader('Set-Cookie', cookie(token, 12 * 3600));
          return json(200, { authenticated: true, username: account.username });
        }
        const owner = user.id;
        if (url.pathname === '/api/logout' && req.method === 'POST') {
          store.revokeSession(tokenHash); res.setHeader('Set-Cookie', cookie('', 0)); return json(200, { loggedOut: true });
        }
        const roomAvailable = () => store.count(owner) < maxWorlds && store.total() < maxTotalWorlds;
        if (req.method === 'GET' && url.pathname === '/api/catalog') return json(200, { laws: LAWS, metrics: METRICS, interventions: INTERVENTIONS });
        if (url.pathname === '/api/worlds') {
          if (req.method === 'GET') return json(200, store.list(owner).map(({ history, artifacts, snapshots, people, ...w }) => ({ ...w, artifactCount: artifacts.length, residentCount: people.filter(p => p.deathYear === null).length })));
          if (req.method === 'POST') {
            if (!roomAvailable()) return json(409, { error: 'ถึงขีดจำกัดจำนวนโลกแล้ว กรุณาส่งออกและลบโลกที่ไม่ใช้' });
            return json(201, store.create(createWorld(body), owner));
          }
        }
        const match = url.pathname.match(/^\/api\/worlds\/([a-f0-9-]+)(?:\/(advance|intervene|branch|artifacts|people|export))?$/);
        if (!match) return json(404, { error: 'ไม่พบเส้นทาง' });
        const [, id, action] = match, world = store.get(id, owner);
        if (!world) return json(404, { error: 'ไม่พบโลกนี้' });
        if (req.method === 'GET' && (!action || action === 'export')) return json(200, world);
        if (req.method === 'DELETE' && !action) { store.remove(id, owner); return json(200, { deleted: true }); }
        if (req.method === 'POST' && action === 'advance') {
          if (!simulationAllowed(owner)) { res.setHeader('Retry-After', '60'); return json(429, { error: 'จำลองบ่อยเกินไป กรุณารอ 1 นาที' }); }
          return json(200, store.save(id, advance(world, body.years), owner));
        }
        if (req.method === 'POST' && action === 'intervene') return json(200, store.save(id, intervene(world, body.id), owner));
        if (req.method === 'POST' && action === 'branch') {
          if (!roomAvailable()) return json(409, { error: 'ถึงขีดจำกัดจำนวนโลกแล้ว' });
          return json(201, store.create(branch(world, body, id), owner));
        }
        if (req.method === 'PATCH' && action === 'people') {
          const person = world.people.find(p => p.id === body.id);
          if (!person) return json(404, { error: 'ไม่พบคนนี้ในทะเบียน' });
          if (typeof body.followed !== 'boolean') throw new Error('สถานะติดตามไม่ถูกต้อง');
          person.followed = body.followed;
          return json(200, store.save(id, world, owner));
        }
        if (req.method === 'PATCH' && action === 'artifacts') {
          const item = world.artifacts.find(a => a.id === body.id);
          if (!item) return json(404, { error: 'ไม่พบวัตถุ' });
          if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) throw new Error('บันทึกยาวได้ไม่เกิน 2,000 ตัวอักษร');
          if (body.featured !== undefined && typeof body.featured !== 'boolean') throw new Error('สถานะจัดแสดงไม่ถูกต้อง');
          if (body.note !== undefined) item.note = body.note;
          if (body.featured !== undefined) item.featured = body.featured;
          return json(200, store.save(id, world, owner));
        }
        return json(405, { error: 'ไม่รองรับคำสั่งนี้' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'ไม่รองรับคำสั่งนี้' });
      const files = { '/': 'index.html', '/app.js': 'app.js', '/people-ui.js': 'people-ui.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg' };
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
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxRequestsPerSocket = 200;
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = configFromEnv();
  const server = makeServer(config);
  server.listen(config.port, config.host, () => console.log(`Museum listening on ${config.host}:${config.port} (${config.authRequired ? 'private beta' : 'local'})`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15000).unref();
  });
}
