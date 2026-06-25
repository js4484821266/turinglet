/**
 * 클라이언트 IP별 요청 횟수를 메모리에서 제한하는 Express middleware다.
 * typing 신호는 대화 타이밍 정확성을 위해 제한 대상에서 제외한다.
 */

import type { Request, Response, NextFunction } from 'express';

export function createRateLimiter(windowMs: number, max: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path.endsWith('/chat/typing')) {
      next();
      return;
    }

    const key = req.ip || 'local';
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    entry.count += 1;
    next();
  };
}
