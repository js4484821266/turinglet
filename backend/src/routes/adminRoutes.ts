import type express from 'express';
import type { Store } from '../db/store.js';

export function registerAdminRoutes(app: express.Express, store: Store): void {
  app.get('/api/admin/overview', async (_req, res) => {
    const [users, sessions, proactiveEvents] = await Promise.all([
      store.listUsers(),
      store.listSessions(),
      store.listProactiveEvents()
    ]);
    res.json({ users, sessions, proactiveEvents });
  });

  app.get('/api/admin/sessions/:sessionId/messages', async (req, res) => {
    const messages = await store.listMessagesForSession(req.params.sessionId);
    res.json({ messages });
  });
}
