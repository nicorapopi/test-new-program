import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { makeServer } from '../server.js';
test('API lifecycle, persistence, branching, curation and validation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unlived-test-'));
  let server;
  async function start() { server = makeServer({ database: join(dir, 'test.sqlite') }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; }
  async function stop() { await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
  let base = await start();
  const request = async (path, method = 'GET', body) => {
    const res = await fetch(`${base}/api${path}`, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    return { status: res.status, data: await res.json() };
  };
  try {
    assert.equal((await fetch(base)).status, 200); assert.equal((await fetch(`${base}/app.js`)).status, 200);
    assert.equal((await request('/catalog')).data.laws.length, 8);
    const created = await request('/worlds', 'POST', { name: '<script>test</script>', seed: 'test', laws: ['memory'] });
    assert.equal(created.status, 201); const id = created.data.id;
    assert.equal((await request('/worlds')).data.length, 1);
    const advanced = await request(`/worlds/${id}/advance`, 'POST', { years: 10 }); assert.equal(advanced.data.year, 10);
    const artifact = advanced.data.artifacts[0];
    const saved = await request(`/worlds/${id}/artifacts`, 'PATCH', { id: artifact.id, note: 'หลักฐานที่ต้องเก็บ', featured: true });
    assert.equal(saved.data.artifacts[0].featured, true);
    const child = await request(`/worlds/${id}/branch`, 'POST', { name: 'อีกโลก', laws: ['forest'] });
    assert.equal(child.status, 201); assert.equal(child.data.parentId, id); assert.equal(child.data.branchYear, 10);
    await request(`/worlds/${child.data.id}/advance`, 'POST', { years: 10 });
    assert.equal((await request(`/worlds/${id}`)).data.year, 10);
    await stop(); base = await start();
    assert.equal((await request(`/worlds/${id}/export`)).data.artifacts[0].note, 'หลักฐานที่ต้องเก็บ');
    assert.equal((await request(`/worlds/${id}/advance`, 'POST', { years: 51 })).status, 400);
    assert.equal((await request(`/worlds/${id}/artifacts`, 'PATCH', { id: artifact.id, featured: 'yes' })).status, 400);
    assert.equal((await request('/worlds', 'POST', { name: 'invalid', seed: 'test', laws: [] })).status, 400);
    assert.equal((await fetch(`${base}/api/worlds`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/api/worlds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await request(`/worlds/${id}`, 'DELETE')).status, 200); assert.equal((await request(`/worlds/${id}`)).status, 404);
    assert.equal((await request(`/worlds/${child.data.id}`)).status, 200);
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
