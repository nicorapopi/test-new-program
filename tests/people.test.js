import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, branch } from '../src/engine.js';
import { ensurePeople } from '../src/people.js';
import { openStore } from '../src/store.js';

const setup = () => createWorld({ name: 'ชีวิต', seed: 'people-test', laws: ['memory', 'dream'] });
test('legacy migration is repeatable and preserves past history and RNG', () => {
  const old = advance(setup(), 10);
  delete old.people; delete old.peopleVersion; delete old.peopleStartedAt; delete old.peopleOrigin;
  old.id = 'legacy-world';
  const history = structuredClone(old.history), rng = old.rng;
  const a = ensurePeople(structuredClone(old)), b = ensurePeople(structuredClone(old));
  assert.deepEqual(a, b); assert.deepEqual(ensurePeople(a), b);
  assert.deepEqual(a.history, history); assert.equal(a.rng, rng);
  assert.equal(a.peopleStartedAt, 10); assert.equal(a.peopleOrigin, 'legacy-world');
  assert.ok(a.people.every(p => p.memories.every(m => m.year >= 10)));
});
test('resident decisions have provenance and artifacts reference known people', () => {
  const world = advance(setup(), 30), ids = new Set(world.people.map(p => p.id));
  assert.ok(world.history.every(e => ids.has(e.resident.id) && e.resident.reason && e.resident.effect >= 0));
  assert.ok(world.artifacts.every(a => ids.has(a.keeperId)));
  assert.ok(world.people.every(p => p.memories.every(m => !m.eventId || world.history.some(e => e.id === m.eventId))));
});
test('changed laws change careers without rewriting the parent life', () => {
  const original = advance(setup(), 10), copy = structuredClone(original);
  const child = advance(branch(original, { name: 'ป่า', laws: ['forest'] }, 'parent'), 5);
  assert.deepEqual(original, copy);
  assert.ok(child.people.filter(p => p.deathYear === null).every(p => p.job === 'ล่ามประจำต้นไม้'));
  assert.ok(child.people.some(p => p.memories.some(m => m.text.includes('อาชีพเดิม'))));
});
test('following is observational and does not change simulation results', () => {
  const a = setup(), b = setup(); b.people[0].followed = true;
  const x = advance(a, 50), y = advance(b, 50);
  assert.deepEqual(x.metrics, y.metrics); assert.deepEqual(x.history, y.history); assert.equal(x.rng, y.rng);
});
test('generations preserve archives and valid relationships over 2000 years', () => {
  let w = setup(); w.people[0].followed = true;
  for (let i = 0; i < 40; i++) w = advance(w, 50);
  const ids = new Set(w.people.map(p => p.id));
  assert.equal(ids.size, w.people.length); assert.equal(w.people.filter(p => p.deathYear === null).length, 8);
  assert.ok(w.people.length > 100);
  for (const p of w.people) {
    assert.ok(Object.values(p.needs).every(v => v >= 0 && v <= 100));
    assert.ok(p.relationships.every(r => ids.has(r.id) && r.strength >= 0 && r.strength <= 100));
    assert.ok(p.memories.every(m => m.year >= p.joinedYear && (p.deathYear === null || m.year <= p.deathYear)));
    if (p.predecessorId) assert.ok(ids.has(p.predecessorId));
  }
  assert.ok(w.people.find(p => p.family === 0 && p.deathYear === null).followed);
});
test('independent worlds have distinct origins; branches share existing identities', () => {
  const store = openStore(':memory:');
  try {
    const a = store.create(setup()), b = store.create(setup());
    assert.notEqual(a.peopleOrigin, b.peopleOrigin);
    let replayA = a, replayB = b;
    for (let i = 0; i < 3; i++) { replayA = advance(replayA, 50); replayB = advance(replayB, 50); }
    assert.deepEqual(replayA.metrics, replayB.metrics);
    assert.deepEqual(replayA.people.map(p => [p.name, p.needs, p.age]), replayB.people.map(p => [p.name, p.needs, p.age]));
    const c = store.create(branch(a, { name: 'ทางใหม่', laws: ['forest'] }, a.id));
    assert.equal(c.peopleOrigin, a.peopleOrigin); assert.equal(c.people[0].id, a.people[0].id);
    a.people.forEach(p => { p.lifespan = p.age + 1; }); c.people.forEach(p => { p.lifespan = p.age + 1; });
    const nextA = advance(a), nextC = advance(c);
    assert.notEqual(nextA.people.at(-1).id, nextC.people.at(-1).id);
  } finally { store.close(); }
});
