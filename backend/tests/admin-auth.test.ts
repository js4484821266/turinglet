/**
 * 실행별 BMP 관리자 키의 형식과 보호 route 인증을 검증한다.
 * 임시 SQLite DB와 주입된 bitmap을 사용해 외부 파일 의존성을 줄인다.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRandomAdminBitmap, isValidAdminBitmap } from '../src/utils/adminBitmap.js';

function prepareTempDb(dbPath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const migrationPath = path.resolve(process.cwd(), '../database/migrations/001_init.sql');
  db.exec(fs.readFileSync(migrationPath, 'utf8'));
  db.close();
}

async function createTestApp(adminBitmap: Buffer) {
  const dbName = `test-admin-auth-${crypto.randomUUID()}.db`;
  prepareTempDb(path.resolve(process.cwd(), `../database/${dbName}`));
  process.env.DB_PROVIDER = 'sqlite';
  process.env.SQLITE_PATH = `./database/${dbName}`;
  const mod = await import('../src/app.js');
  return mod.createApp({ adminBitmap }).app;
}

function loginBody(bitmap: Buffer): { bitmapBase64: string } {
  return { bitmapBase64: bitmap.toString('base64') };
}

function isBlackModule(bitmap: Buffer, x: number, y: number): boolean {
  const pixelOffset = bitmap.readUInt32LE(10);
  const rowStride = 8;
  const bmpRow = 64 - 1 - y;
  const pixelByte = bitmap.readUInt8(pixelOffset + bmpRow * rowStride + Math.floor(x / 8));
  return (pixelByte & (1 << (7 - (x % 8)))) === 0;
}

describe('admin bitmap auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates a valid 64 by 64 pseudo QR bitmap', () => {
    const bitmap = createRandomAdminBitmap();
    expect(isValidAdminBitmap(bitmap)).toBe(true);
    expect(isBlackModule(bitmap, 12, 10)).toBe(true);
    expect(isBlackModule(bitmap, 13, 10)).toBe(false);
    expect(isBlackModule(bitmap, 10, 12)).toBe(true);
    expect(isBlackModule(bitmap, 10, 13)).toBe(false);
    expect(isBlackModule(bitmap, 48, 48)).toBe(true);
  });

  it('logs in with the bitmap generated for this app run', async () => {
    const bitmap = createRandomAdminBitmap();
    const app = await createTestApp(bitmap);
    const res = await request(app).post('/api/admin/login').send(loginBody(bitmap)).expect(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects another valid bitmap', async () => {
    const app = await createTestApp(createRandomAdminBitmap());
    await request(app).post('/api/admin/login').send(loginBody(createRandomAdminBitmap())).expect(401);
  });

  it('rejects a bitmap with the wrong dimensions', async () => {
    const bitmap = createRandomAdminBitmap();
    const invalidBitmap = Buffer.from(bitmap);
    invalidBitmap.writeInt32LE(512, 18);
    const app = await createTestApp(bitmap);
    await request(app).post('/api/admin/login').send(loginBody(invalidBitmap)).expect(401);
  });

  it('protects admin data routes with bearer token auth', async () => {
    const bitmap = createRandomAdminBitmap();
    const app = await createTestApp(bitmap);
    await request(app).get('/api/admin/overview').expect(401);
    const loginRes = await request(app).post('/api/admin/login').send(loginBody(bitmap)).expect(200);
    await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .expect(200);
  });
});
