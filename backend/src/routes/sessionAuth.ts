/**
 * 요청 헤더의 세션 ID를 Store의 사용자 세션과 대조하는 인증 경계다.
 * 실패 시 401 응답을 끝내고 성공한 경우에만 sessionId와 userId를 반환한다.
 */

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
