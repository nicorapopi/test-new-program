import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, intervene, branch } from '../src/engine.js';
const initial = () => createWorld({ name: 'เมืองทดสอบ', seed: 'one-possible-future', laws: ['dream', 'memory'] });
test('same seed and rules reproduce the same world', () => {
  assert.deepEqual(advance(initial(), 30), advance(initial(), 30));
  assert.notDeepEqual(advance(initial(), 30), advance(createWorld({ name: 'เมืองทดสอบ', seed: 'different', laws: ['dream', 'memory'] }), 30));
});
test('batching years does not alter the simulation', () => {
  let world = initial();
  for (let i = 0; i < 30; i++) world = advance(world);
  assert.deepEqual(world, advance(initial(), 30));
});
test('simulation preserves input and bounds over 2000 years', () => {
  const input = initial(), copy = structuredClone(input);
  let world = input;
  for (let i = 0; i < 40; i++) world = advance(world, 50);
  assert.deepEqual(input, copy); assert.equal(world.year, 2000); assert.equal(world.history.length, 2000);
  assert.equal(new Set(world.artifacts.map(a => a.id)).size, world.artifacts.length);
  assert.ok(world.population >= 50 && world.population <= 1000000);
  assert.ok(world.snapshots.every(s => Object.values(s.metrics).every(v => Number.isFinite(v) && v >= 0 && v <= 100)));
  assert.throws(() => advance(world), /2,000/);
});
test('branch inherits history but edits stay isolated', () => {
  const parent = advance(initial(), 10), copy = structuredClone(parent);
  const child = branch(parent, { name: 'อีกทาง', laws: ['forest', 'rain'] }, 'parent-id');
  assert.equal(child.parentId, 'parent-id'); assert.equal(child.branchYear, 10);
  assert.deepEqual(child.history, parent.history); assert.equal(child.rng, parent.rng);
  child.artifacts[0].note = 'child only'; assert.deepEqual(parent, copy);
  assert.notDeepEqual(advance(parent, 10).metrics, advance(child, 10).metrics);
});
test('interventions consume power and recover at year 5', () => {
  let world = initial();
  for (let i = 0; i < 3; i++) world = intervene(world, 'archive');
  assert.equal(world.credits, 0); assert.equal(world.history.length, 3); assert.equal(world.metrics.knowledge, 86);
  assert.throws(() => intervene(world, 'archive'), /หมด/);
  world = advance(world, 5); assert.equal(world.credits, 1); assert.equal(intervene(world, 'festival').credits, 0);
});
test('invalid rules and inputs fail', () => {
  for (const laws of [[], ['memory', 'memory'], ['invalid'], ['time', 'memory', 'dream', 'rain']]) assert.throws(() => createWorld({ name: 'test', seed: 'x', laws }));
  for (const years of [0, -1, 51, 1.5, '10', null]) assert.throws(() => advance(initial(), years));
  assert.throws(() => createWorld({ name: ' ', seed: 'x', laws: ['time'] })); assert.throws(() => intervene(initial(), 'invalid'));
});
