import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ensurePeople } from './people.js';

export function openStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );`);
  const decode = row => row ? ensurePeople({ ...JSON.parse(row.state), id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }) : null;
  return {
    list: () => db.prepare('SELECT * FROM worlds ORDER BY updated_at DESC').all().map(decode),
    get: id => decode(db.prepare('SELECT * FROM worlds WHERE id = ?').get(id)),
    create(state) {
      const id = randomUUID(), now = new Date().toISOString();
      if (!state.parentId) state.peopleOrigin = id;
      db.prepare('INSERT INTO worlds VALUES (?, ?, ?, ?)').run(id, JSON.stringify(state), now, now);
      return this.get(id);
    },
    save(id, state) {
      db.prepare('UPDATE worlds SET state = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), new Date().toISOString(), id);
      return this.get(id);
    },
    remove: id => db.prepare('DELETE FROM worlds WHERE id = ?').run(id).changes > 0,
    close: () => db.close(),
  };
}
