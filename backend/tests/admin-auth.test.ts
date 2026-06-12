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
  process.env.MOCK_PROVIDER = 'true';
  const mod = await import('../src/app.js');
  return mod.createApp({ adminBitmap }).app;
}

function loginBody(bitmap: Buffer): { bitmapBase64: string } {
  return { bitmapBase64: bitmap.toString('base64') };
}

describe('admin bitmap auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates a valid 1024 by 1 monochrome bitmap', () => {
    expect(isValidAdminBitmap(createRandomAdminBitmap())).toBe(true);
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
