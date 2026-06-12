import crypto from 'node:crypto';
import type express from 'express';
import type { Store } from '../db/store.js';
import { adminBitmapDigest, isValidAdminBitmap } from '../utils/adminBitmap.js';

function readBearerToken(req: express.Request): string | undefined {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice('Bearer '.length).trim();
}

export function registerAdminRoutes(app: express.Express, store: Store, adminBitmap: Buffer): void {
  const adminTokens = new Set<string>();
  const expectedDigest = adminBitmapDigest(adminBitmap);

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const token = readBearerToken(req);
    if (!token || !adminTokens.has(token)) {
      res.status(401).json({ error: 'Admin login required' });
      return;
    }
    next();
  };

  app.post('/api/admin/login', (req, res) => {
    const bitmapBase64 = typeof req.body?.bitmapBase64 === 'string' ? req.body.bitmapBase64 : '';
    const uploadedBitmap = Buffer.from(bitmapBase64, 'base64');
    if (!isValidAdminBitmap(uploadedBitmap)) {
      res.status(401).json({ error: 'Invalid admin bitmap' });
      return;
    }

    const uploadedDigest = adminBitmapDigest(uploadedBitmap);
    if (!crypto.timingSafeEqual(uploadedDigest, expectedDigest)) {
      res.status(401).json({ error: 'Invalid admin bitmap' });
      return;
    }

    const token = crypto.randomBytes(32).toString('base64url');
    adminTokens.add(token);
    res.json({ token });
  });

  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    const [users, sessions, proactiveEvents] = await Promise.all([
      store.listUsers(),
      store.listSessions(),
      store.listProactiveEvents()
    ]);
    res.json({ users, sessions, proactiveEvents });
  });

  app.get('/api/admin/sessions/:sessionId/messages', requireAdmin, async (req, res) => {
    const sessionId = req.params.sessionId;
    if (typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }
    const messages = await store.listMessagesForSession(sessionId);
    res.json({ messages });
  });
}
