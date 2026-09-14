import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const digest = text => createHash('sha256').update(text).digest('hex');
export async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('รหัสผ่านต้องยาว 12–128 ตัวอักษร');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, expected] = (encoded || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const key = await derive(password, salt, 64);
  const stored = Buffer.from(expected, 'hex');
  return key.length === stored.length && timingSafeEqual(key, stored);
}
export function limiter(max, windowMs, capacity = 2048) {
  const buckets = new Map();
  return key => {
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || entry.until <= now) {
      if (buckets.size >= capacity) {
        for (const [k, value] of buckets) if (value.until <= now) buckets.delete(k);
        if (buckets.size >= capacity) return false;
      }
      entry = { count: 0, until: now + windowMs }; buckets.set(key, entry);
    }
    return ++entry.count <= max;
  };
}
export function configFromEnv(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const authRequired = production || env.AUTH_REQUIRED === 'true';
  const origin = env.PUBLIC_ORIGIN || '';
  if (authRequired && !origin) throw new Error('PUBLIC_ORIGIN is required when authentication is enabled');
  if (origin) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('PUBLIC_ORIGIN must be an exact origin without a trailing slash');
    if (production && parsed.protocol !== 'https:') throw new Error('Production requires an HTTPS PUBLIC_ORIGIN');
  }
  const host = env.HOST || (authRequired ? '0.0.0.0' : '127.0.0.1');
  if (!authRequired && !['127.0.0.1', '::1'].includes(host)) throw new Error('Local mode must listen on loopback only');
  return { authRequired, publicOrigin: origin, host, database: env.DATABASE_PATH, port: Number(env.PORT || 4317) };
}
