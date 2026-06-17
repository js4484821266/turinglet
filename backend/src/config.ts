import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('PORT', 4000),
  dbProvider: process.env.DB_PROVIDER === 'postgres' ? 'postgres' : 'sqlite',
  sqlitePath: process.env.SQLITE_PATH ?? './database/local-dev.db',
  postgresUrl: process.env.POSTGRES_URL ?? '',
  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 60000),
  rateLimitMax: num('RATE_LIMIT_MAX', 30),
  proactivePollMs: num('PROACTIVE_POLL_MS', 5000),
  proactiveMinSilenceMs: num('PROACTIVE_MIN_SILENCE_MS', 120000),
  proactiveCooldownMs: num('PROACTIVE_COOLDOWN_MS', 240000),
  userContinuationGraceMs: num('USER_CONTINUATION_GRACE_MS', 600),  // Reduced from 1800ms for faster response
  reactiveResponseMaxWaitMs: num('REACTIVE_RESPONSE_MAX_WAIT_MS', 20000),  // Reduced from 30s
  hfLocalUrl: process.env.HF_LOCAL_URL ?? 'http://127.0.0.1:8010',
  hfLocalTimeoutMs: num('HF_LOCAL_TIMEOUT_MS', 30000),  // Reduced from 40s
  hfLocalStartupWaitMs: num('HF_LOCAL_STARTUP_WAIT_MS', 120000)
} as const;
