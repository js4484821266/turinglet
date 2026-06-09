import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function createTestApp(adminEnv?: { id: string; passwordHash: string }) {
  const dbName = `test-admin-auth-${crypto.randomUUID()}.db`;
  const dbPath = path.resolve(process.cwd(), `../database/${dbName}`);
  prepareTempDb(dbPath);

  process.env.DB_PROVIDER = 'sqlite';
  process.env.SQLITE_PATH = `./database/${dbName}`;
  process.env.MOCK_PROVIDER = 'true';
  if (adminEnv) {
    process.env.ACHRAI_ID = adminEnv.id;
    process.env.ACHRAI_PW_SHA2_256 = adminEnv.passwordHash;
  } else {
    delete process.env.ACHRAI_ID;
    delete process.env.ACHRAI_PW_SHA2_256;
  }

  const mod = await import('../src/app.js');
  return mod.createApp().app;
}

describe('admin auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('logs in with configured admin id and password hash', async () => {
    const app = await createTestApp({ id: 'achrai', passwordHash: sha256('secret') });

    const res = await request(app)
      .post('/api/admin/login')
      .send({ id: 'achrai', passwordSha256: sha256('secret') })
      .expect(200);

    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects invalid admin credentials', async () => {
    const app = await createTestApp({ id: 'achrai', passwordHash: sha256('secret') });

    await request(app)
      .post('/api/admin/login')
      .send({ id: 'achrai', passwordSha256: sha256('wrong') })
      .expect(401);
  });

  it('fails clearly when admin credentials are not configured', async () => {
    const app = await createTestApp();

    await request(app)
      .post('/api/admin/login')
      .send({ id: 'achrai', passwordSha256: sha256('secret') })
      .expect(503);
  });

  it('protects admin data routes with bearer token auth', async () => {
    const app = await createTestApp({ id: 'achrai', passwordHash: sha256('secret') });

    await request(app).get('/api/admin/overview').expect(401);

    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ id: 'achrai', passwordSha256: sha256('secret') })
      .expect(200);

    await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .expect(200);
  });
});
