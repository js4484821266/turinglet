import crypto from 'node:crypto';
import type express from 'express';
import { config } from '../config.js';
import type { Store } from '../db/store.js';

const adminTokens = new Set<string>();

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function adminCredentialsAreConfigured(): boolean {
  return config.achraiId.length > 0 && /^[a-f0-9]{64}$/.test(config.achraiPwSha256);
}

function readBearerToken(req: express.Request): string | undefined {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice('Bearer '.length).trim();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = readBearerToken(req);
  if (!token || !adminTokens.has(token)) {
    res.status(401).json({ error: 'Admin login required' });
    return;
  }
  next();
}

export function registerAdminRoutes(app: express.Express, store: Store): void {
  app.post('/api/admin/login', (req, res) => {
    if (!adminCredentialsAreConfigured()) {
      res.status(503).json({ error: 'Admin credentials are not configured' });
      return;
    }

    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const passwordSha256 =
      typeof req.body?.passwordSha256 === 'string' ? req.body.passwordSha256.trim().toLowerCase() : '';

    if (!/^[a-f0-9]{64}$/.test(passwordSha256)) {
      res.status(401).json({ error: 'Invalid admin credentials' });
      return;
    }

    const idMatches = constantTimeEqual(id, config.achraiId);
    const passwordMatches = constantTimeEqual(passwordSha256, config.achraiPwSha256);
    if (!idMatches || !passwordMatches) {
      res.status(401).json({ error: 'Invalid admin credentials' });
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
