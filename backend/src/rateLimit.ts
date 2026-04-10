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
