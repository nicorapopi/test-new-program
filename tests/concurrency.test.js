import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from '../server.js';
test('concurrent simulation requests retain every completed year', async () => {
  const server = makeServer({ database: ':memory:' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const world = await (await post('/api/worlds', { name: 'concurrent', seed: 'x', laws: ['forest'] })).json();
    const responses = await Promise.all(Array.from({ length: 8 }, () => post(`/api/worlds/${world.id}/advance`, { years: 10 })));
    assert.ok(responses.every(r => r.status === 200));
    await Promise.all(responses.map(r => r.arrayBuffer()));
    const final = await (await fetch(`${url}/api/worlds/${world.id}`)).json();
    assert.equal(final.year, 80); assert.equal(final.history.length, 80);
    assert.equal(new Set(final.history.map(e => e.id)).size, 80);
    assert.equal((await fetch(url + '/healthz')).status, 200);
  } finally { await new Promise(done => server.close(done)); }
});
