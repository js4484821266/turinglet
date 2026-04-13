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

function providerMode(): 'mock' | 'hf-local' {
  const mode = process.env.LLM_PROVIDER?.trim();
  if (mode === 'hf-local' || mode === 'mock') return mode;
  return process.env.MOCK_PROVIDER === 'false' ? 'hf-local' : 'mock';
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
  userContinuationGraceMs: num('USER_CONTINUATION_GRACE_MS', 1800),
  reactiveResponseMaxWaitMs: num('REACTIVE_RESPONSE_MAX_WAIT_MS', 30000),
  mockProvider: process.env.MOCK_PROVIDER !== 'false',
  llmProvider: providerMode(),
  hfLocalUrl: process.env.HF_LOCAL_URL ?? 'http://127.0.0.1:8010',
  hfLocalTimeoutMs: num('HF_LOCAL_TIMEOUT_MS', 40000)
} as const;
