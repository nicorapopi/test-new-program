import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from '../src/store.js';
import { createWorld, advance } from '../src/engine.js';
import { snapshot } from '../scripts/backup.js';
import { digest, passwordHash } from '../src/security.js';

test('online WAL backup and restore preserve worlds and owners, revoke sessions, never overwrite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unlived-backup-'));
  const source = join(dir, 'source.sqlite'), saved = join(dir, 'backup.sqlite'), restored = join(dir, 'restore.sqlite');
  const store = openStore(source); let copy;
  try {
    const user = store.addUser('tester', await passwordHash('test-backup-password'));
    const world = store.create(advance(createWorld({ name: 'สำรอง', seed: 'x', laws: ['dream'] }), 15), user);
    store.addSession(digest('test-session'), user, Date.now() + 60000);
    await snapshot(source, saved);
    store.save(world.id, advance(world, 1), user);
    await snapshot(saved, restored, { restore: true });
    copy = openStore(restored);
    assert.deepEqual(copy.get(world.id, user), world); assert.equal(copy.get(world.id), null);
    assert.equal(copy.user('tester').id, user); assert.equal(copy.session(digest('test-session')), undefined);
    assert.equal(store.get(world.id, user).year, 16);
    await assert.rejects(snapshot(source, saved), /EEXIST/);
    await assert.rejects(snapshot(source, source), /differ/);
  } finally { copy?.close(); store.close(); await rm(dir, { recursive: true, force: true }); }
});
