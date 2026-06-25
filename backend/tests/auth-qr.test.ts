/**
 * 임시 SQLite DB에서 QR 등록 후 정상·변조 로그인을 검증한다.
 * 테스트 데이터는 repo 내부 ignore 대상 DB에 만들고 실제 사용자 DB와 분리한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function prepareTempDb(dbPath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const migrationPath = path.resolve(process.cwd(), '../database/migrations/001_init.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  db.exec(migration);
  db.close();
}

describe('QR auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('login success and failure by QR payload', async () => {
    const dbPath = path.resolve(process.cwd(), '../database/test-auth.db');
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
    prepareTempDb(dbPath);

    process.env.DB_PROVIDER = 'sqlite';
    process.env.SQLITE_PATH = './database/test-auth.db';

    const mod = await import('../src/app.js');
    const { app } = mod.createApp();

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ displayName: 'Tester', enableRecoveryCode: true })
      .expect(201);

    const okLogin = await request(app)
      .post('/api/auth/login')
      .send({ qrPayload: regRes.body.qrPayload })
      .expect(200);

    expect(okLogin.body.sessionId).toBeTruthy();

    await request(app)
      .post('/api/auth/login')
      .send({ qrPayload: regRes.body.qrPayload + 'tampered' })
      .expect(400);
  });
});
