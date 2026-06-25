/**
 * 비어 있는 SQLite 개발 DB에 학습·시연용 사용자 한 명을 추가하는 CLI 진입점이다.
 * 기존 사용자가 있으면 데이터를 바꾸지 않으며, 모든 경로에서 DB 연결을 닫는다.
 */

import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { resolveSqlitePath } from './env.js';

function main(): number {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const db = new Database(resolveSqlitePath());

  try {
    const exists = db.prepare('SELECT id FROM users LIMIT 1').get();
    if (exists) {
      console.log('Seed skipped: users already exist.');
      return 0;
    }

    const userId = crypto.randomUUID();
    const publicId = crypto.randomBytes(48).toString('base64url');
    const now = Date.now();

    db.prepare(
      'INSERT INTO users (id, public_id, display_name, created_at) VALUES (?, ?, ?, ?)'
    ).run(userId, publicId, 'Demo User', now);

    console.log('Seed inserted one demo user with long public_id.');
    return 0;
  } finally {
    db.close();
  }
}

main();
