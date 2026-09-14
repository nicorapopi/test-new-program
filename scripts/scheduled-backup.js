import { snapshot } from './backup.js';
import { resolve } from 'node:path';
const database = process.env.DATABASE_PATH || '/app/data/museum.sqlite';
const directory = process.env.BACKUP_DIR || '/app/backups';
async function run() {
  const file = resolve(directory, `museum-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  await snapshot(database, file);
  console.log(`Backup completed: ${file}`);
}
// Stop on failure so the container reports a failed run instead of silently skipping it.
try {
  await run();
  setInterval(() => run().catch(error => { console.error(error.message); process.exit(1); }), 24 * 3600000);
} catch (error) { console.error(error.message); process.exitCode = 1; }
