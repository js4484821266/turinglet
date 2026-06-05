import type { Request, Response } from 'express';
import type { Store } from '../db/store.js';

export interface SessionIdentity {
  sessionId: string;
  userId: string;
}

// Session auth is header-based in this prototype. Keeping it in one helper
// makes the chat routes easier to scan and highlights the security boundary.
export async function requireSession(
  store: Store,
  req: Request,
  res: Response
): Promise<SessionIdentity | undefined> {
  const sessionId = req.header('x-session-id');
  if (!sessionId) {
    res.status(401).json({ error: 'Missing session header' });
    return undefined;
  }

  const session = await store.getSessionById(sessionId);
  if (!session) {
    res.status(401).json({ error: 'Invalid session' });
    return undefined;
  }

  await store.touchSession(sessionId);
  return { sessionId, userId: session.userId };
}
