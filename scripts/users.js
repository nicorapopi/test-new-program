import { createInterface, emitKeypressEvents } from 'node:readline';
import { resolve } from 'node:path';
import { openStore } from '../src/store.js';
import { passwordHash } from '../src/security.js';

async function secret(prompt) {
  if (!process.stdin.isTTY) throw new Error('Run interactively in a terminal (docker compose exec -it app ...). Passwords are never accepted as command arguments.');
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((done, reject) => {
    let value = '';
    function finish(error) { process.stdin.off('keypress', keypress); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); error ? reject(error) : done(value); }
    function keypress(text, key) {
      if (key?.ctrl && key.name === 'c') return finish(new Error('Cancelled'));
      if (key?.name === 'return') return finish();
      if (key?.name === 'backspace') { value = value.slice(0, -1); return; }
      if (text && !key?.ctrl && !/[\r\n\x00-\x1f]/.test(text) && value.length < 128) value += text;
    }
    process.stdin.on('keypress', keypress);
  });
}
const [action, username] = process.argv.slice(2);
let store;
try {
  if (!['add', 'password', 'claim-local'].includes(action) || !username) throw new Error('Usage: node scripts/users.js add|password|claim-local USERNAME');
  store = openStore(resolve(process.env.DATABASE_PATH || 'data/museum.sqlite'));
  if (action === 'claim-local') {
    if (!store.user(username)) throw new Error('User not found');
    if (!process.stdin.isTTY) throw new Error('Interactive confirmation required');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(done => rl.question(`Assign all unclaimed local worlds to ${username}? Type the username: `, done)); rl.close();
    if (answer !== username) throw new Error('Cancelled');
    console.log(`Assigned ${store.claimLocal(username)} worlds.`);
  } else {
    const password = await secret('Password (12–128 characters; hidden): ');
    if (password !== await secret('Repeat password: ')) throw new Error('Passwords do not match');
    const hash = await passwordHash(password);
    if (action === 'add') store.addUser(username, hash); else store.changePassword(username, hash);
    console.log(action === 'add' ? 'User created.' : 'Password updated; all sessions revoked.');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { store?.close(); }
