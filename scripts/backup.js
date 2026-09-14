import { DatabaseSync, backup } from 'node:sqlite';
import { open, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function snapshot(source, destination, { restore = false } = {}) {
  if (resolve(source) === resolve(destination)) throw new Error('Source and destination must differ');
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Source database failed integrity check');
    const columns = db.prepare('PRAGMA table_info(worlds)').all().map(c => c.name);
    if (!['id', 'state', 'created_at', 'updated_at'].every(c => columns.includes(c))) throw new Error('Not an UNLIVED database');
    await mkdir(dirname(resolve(destination)), { recursive: true });
    const reserved = await open(destination, 'wx', 0o600); await reserved.close();
    await backup(db, destination);
    const copy = new DatabaseSync(destination);
    try {
      if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Snapshot failed integrity check');
      if (restore && copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get()) copy.exec('DELETE FROM sessions;');
      copy.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } finally { copy.close(); }
    return destination;
  } finally { db.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, source, target] = process.argv.slice(2);
  try {
    if (!['backup', 'restore'].includes(mode) || !source || !target) throw new Error('Usage: node scripts/backup.js backup|restore SOURCE.sqlite NEW_DESTINATION.sqlite');
    await snapshot(source, target, { restore: mode === 'restore' });
    console.log(`${mode} complete: ${resolve(target)}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
