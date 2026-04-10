import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { resolveSqlitePath } from './env.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const db = new Database(resolveSqlitePath());

const userId = crypto.randomUUID();
const publicId = crypto.randomBytes(48).toString('base64url');
const now = Date.now();

const exists = db.prepare('SELECT id FROM users LIMIT 1').get();
if (exists) {
  console.log('Seed skipped: users already exist.');
  process.exit(0);
}

db.prepare(
  'INSERT INTO users (id, public_id, display_name, created_at) VALUES (?, ?, ?, ?)'
).run(userId, publicId, 'Demo User', now);

console.log('Seed inserted one demo user with long public_id.');
