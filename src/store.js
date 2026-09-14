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
  db.exec('PRAGMA busy_timeout=5000;');
  if (!db.prepare('PRAGMA table_info(worlds)').all().some(c => c.name === 'owner_id')) db.exec("ALTER TABLE worlds ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'local'");
  db.exec(`CREATE INDEX IF NOT EXISTS worlds_owner ON worlds(owner_id);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);`);
  const decode = row => row ? ensurePeople({ ...JSON.parse(row.state), id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }) : null;
  return {
    list: (owner = 'local') => db.prepare('SELECT * FROM worlds WHERE owner_id = ? ORDER BY updated_at DESC').all(owner).map(decode),
    count: (owner = 'local') => db.prepare('SELECT count(*) AS n FROM worlds WHERE owner_id = ?').get(owner).n,
    total: () => db.prepare('SELECT count(*) AS n FROM worlds').get().n,
    get: (id, owner = 'local') => decode(db.prepare('SELECT * FROM worlds WHERE id = ? AND owner_id = ?').get(id, owner)),
    create(state, owner = 'local') {
      const id = randomUUID(), now = new Date().toISOString();
      if (!state.parentId) state.peopleOrigin = id;
      db.prepare('INSERT INTO worlds (id, state, created_at, updated_at, owner_id) VALUES (?, ?, ?, ?, ?)').run(id, JSON.stringify(state), now, now, owner);
      return this.get(id, owner);
    },
    save(id, state, owner = 'local') {
      db.prepare('UPDATE worlds SET state = ?, updated_at = ? WHERE id = ? AND owner_id = ?').run(JSON.stringify(state), new Date().toISOString(), id, owner);
      return this.get(id, owner);
    },
    remove: (id, owner = 'local') => db.prepare('DELETE FROM worlds WHERE id = ? AND owner_id = ?').run(id, owner).changes > 0,
    user: username => db.prepare('SELECT * FROM users WHERE username = ?').get(username),
    addUser(username, passwordHash) {
      if (!/^[a-z0-9_-]{3,32}$/.test(username) || username === 'local') throw new Error('Username must be 3–32 lowercase letters, numbers, underscore or hyphen; local is reserved');
      const id = randomUUID();
      db.prepare('INSERT INTO users VALUES (?, ?, ?)').run(id, username, passwordHash);
      return id;
    },
    changePassword(username, passwordHash) {
      const user = this.user(username); if (!user) throw new Error('User not found');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id); db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    claimLocal(username) {
      const user = this.user(username); if (!user) throw new Error('User not found');
      return db.prepare("UPDATE worlds SET owner_id = ? WHERE owner_id = 'local'").run(user.id).changes;
    },
    session(tokenHash) {
      return db.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires > ?').get(tokenHash, Date.now());
    },
    addSession(tokenHash, userId, expires) {
      db.prepare('DELETE FROM sessions WHERE expires <= ? OR user_id = ?').run(Date.now(), userId);
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash, userId, expires);
    },
    revokeSession: tokenHash => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash),
    healthy: () => db.prepare('SELECT 1').get(),
    close: () => db.close(),
  };
}
