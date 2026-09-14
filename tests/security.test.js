import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.js';
import { openStore } from '../src/store.js';
import { passwordHash, digest, configFromEnv } from '../src/security.js';
import { createWorld } from '../src/engine.js';

test('production configuration fails closed and local mode cannot bind publicly', () => {
  assert.throws(() => configFromEnv({ NODE_ENV: 'production' }));
  assert.throws(() => configFromEnv({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'http://example.com' }));
  assert.throws(() => configFromEnv({ HOST: '0.0.0.0' }));
  assert.throws(() => configFromEnv({ AUTH_REQUIRED: 'true', PUBLIC_ORIGIN: 'https://example.com/path' }));
  assert.equal(configFromEnv({ NODE_ENV: 'production', AUTH_REQUIRED: 'false', PUBLIC_ORIGIN: 'https://example.com' }).authRequired, true);
});

test('HTTPS origin, sessions, ownership, revocation, quotas and request limits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unlived-auth-')), database = join(dir, 'test.sqlite');
  const store = openStore(database), secret = 'test-password-strong-123';
  const hash = await passwordHash(secret);
  store.addUser('alice', hash); store.addUser('bob', hash);
  const legacy = store.create(createWorld({ name: 'legacy', seed: 'x', laws: ['dream'] }));
  const server = makeServer({ database, authRequired: true, publicOrigin: 'https://museum.example', maxWorlds: 2, simulationLimit: 1, loginLimit: 7 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body, cookie = '', extra = {}) {
    return new Promise((done, reject) => {
      const req = httpRequest(base + path, { method, headers: { Host: 'museum.example', Origin: 'https://museum.example', Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra } }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
        res.on('end', () => done({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0].split(';')[0], headers: { get: key => res.headers[key]?.toString() }, data: JSON.parse(text) }));
      });
      req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  async function login(username, password = secret) { return request('/api/login', 'POST', { username, password }); }
  try {
    assert.equal((await request('/api/worlds')).status, 401);
    assert.equal((await request('/api/session')).data.authenticated, false);
    assert.equal((await login('alice', 'wrong')).status, 401);
    const a = await login('alice'), b = await login('bob');
    assert.equal(a.status, 200); assert.match(a.headers.get('set-cookie'), /__Host-unlived=.*HttpOnly.*SameSite=Strict.*Secure/);
    const created = await request('/api/worlds', 'POST', { name: 'private', seed: 'a', laws: ['dream'] }, a.cookie);
    assert.equal(created.status, 201); const id = created.data.id;
    assert.equal((await request('/api/worlds', 'GET', undefined, b.cookie)).data.length, 0);
    for (const [suffix, method, body] of [['', 'GET'], ['/export', 'GET'], ['', 'DELETE'], ['/advance', 'POST', { years: 1 }], ['/branch', 'POST', { name: 'stolen', laws: ['forest'] }], ['/people', 'PATCH', { id: created.data.people[0].id, followed: true }], ['/artifacts', 'PATCH', { id: 'artifact-1', note: 'changed' }]]) {
      assert.equal((await request(`/api/worlds/${id}${suffix}`, method, body, b.cookie)).status, 404);
    }
    assert.equal((await request(`/api/worlds/${legacy.id}`, 'GET', undefined, a.cookie)).status, 404);
    assert.equal((await request(`/api/worlds/${id}/advance`, 'POST', { years: 1 }, a.cookie, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request(`/api/worlds/${id}/advance`, 'POST', { years: 1 }, a.cookie, { Origin: '' })).status, 403);
    assert.equal((await request('/api/worlds', 'GET', undefined, a.cookie, { Host: 'evil.example' })).status, 403);
    assert.equal((await request(`/api/worlds/${id}/advance`, 'POST', { years: 1 }, a.cookie, { 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'evil.example' })).status, 200);
    assert.equal((await request(`/api/worlds/${id}/advance`, 'POST', { years: 1 }, a.cookie)).status, 429);
    assert.equal((await request(`/api/worlds/${id}/branch`, 'POST', { name: 'mine', laws: ['forest'] }, a.cookie)).status, 201);
    assert.equal((await request('/api/worlds', 'POST', { name: 'over', seed: 'b', laws: ['rain'] }, a.cookie)).status, 409);
    const rotated = await login('alice');
    assert.equal((await request('/api/worlds', 'GET', undefined, a.cookie)).status, 401);
    assert.equal((await request('/api/logout', 'POST', {}, rotated.cookie)).status, 200);
    assert.equal((await request('/api/worlds', 'GET', undefined, rotated.cookie)).status, 401);
    store.changePassword('bob', await passwordHash('replacement-password-123'));
    assert.equal((await request('/api/worlds', 'GET', undefined, b.cookie)).status, 401);
    store.addSession(digest('expired-token'), store.user('bob').id, Date.now() - 1);
    assert.equal((await request('/api/worlds', 'GET', undefined, '__Host-unlived=expired-token')).status, 401);
    assert.equal(store.claimLocal('alice'), 1); assert.ok(store.get(legacy.id, store.user('alice').id));
    for (let i = 0; i < 5; i++) await login('alice', 'wrong');
    assert.equal((await login('alice')).status, 429);
    assert.equal((await fetch(base + '/healthz')).status, 200);
  } finally { await new Promise(done => server.close(done)); store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('general API request budget returns 429', async () => {
  const server = makeServer({ database: ':memory:', requestLimit: 1 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { assert.equal((await fetch(base + '/api/catalog')).status, 200); assert.equal((await fetch(base + '/api/worlds')).status, 429); }
  finally { await new Promise(done => server.close(done)); }
});
