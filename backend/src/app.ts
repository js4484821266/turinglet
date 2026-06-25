/**
 * Express app? ?? ????.
 * DB, LLM adapter, ?? ???, ?? queue? route? ????.
 * app ??? port listen? ??? ???? ?? ??? ?? ?? ??.
 * ??, ??? key, production frontend build ??? ?? ? ??? ??.
 */

import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { createProvider } from './adapters/index.js';
import { config } from './config.js';
import { findRepoRoot } from './db/common.js';
import { createStore } from './db/index.js';
import { MessageGenerator } from './engine/messageGenerator.js';
import { ConversationOrchestrator } from './engine/orchestrator.js';
import { createRateLimiter } from './rateLimit.js';
import { registerAdminRoutes } from './routes/adminRoutes.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerChatRoutes } from './routes/chatRoutes.js';
import { createMessageQueue } from './runtime/messageQueue.js';
import { createProactiveScheduler } from './runtime/proactiveLoop.js';
import { createReactivePlanner } from './runtime/reactivePlanner.js';
import { attachSocket, createRealtimeEmitter, type SocketLike } from './runtime/realtime.js';
import { createAndSaveAdminBitmap } from './utils/adminBitmap.js';

export interface CreateAppOptions {
  adminBitmap?: Buffer;
}

export interface AppServices {
  app: express.Express;
  startScheduler: () => void;
  bindSocket: (socket: SocketLike) => void;
}

export { attachSocket };

// createApp is now the composition root: it wires dependencies together while
// keeping route behavior, timers, and realtime details in smaller files.
export function createApp(options: CreateAppOptions = {}): AppServices {
  const app = express();
  let io: SocketLike | undefined;

  const store = createStore();
  const provider = createProvider();
  const generator = new MessageGenerator(provider);
  const orchestrator = new ConversationOrchestrator(provider);
  const adminBitmap = options.adminBitmap ?? createAndSaveAdminBitmap();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(createRateLimiter(config.rateLimitWindowMs, config.rateLimitMax));

  const realtime = createRealtimeEmitter(() => io);
  const queue = createMessageQueue({
    store,
    emitPresence: realtime.emitPresence,
    emitMessage: realtime.emitMessage
  });
  const reactive = createReactivePlanner({
    store,
    provider,
    orchestrator,
    emitPresence: realtime.emitPresence,
    queuePlanMessages: queue.queuePlanMessages
  });
  const proactive = createProactiveScheduler({
    store,
    generator,
    orchestrator,
    queuePlanMessages: queue.queuePlanMessages
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  registerAuthRoutes(app, { store });
  registerChatRoutes(app, {
    store,
    provider,
    emitMessage: realtime.emitMessage,
    emitUserTyping: realtime.emitUserTyping,
    scheduleReactivePlan: reactive.scheduleReactivePlan
  });
  registerAdminRoutes(app, store, adminBitmap);

  if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(findRepoRoot(process.cwd()), 'frontend', 'dist');
    if (!fs.existsSync(path.join(frontendDist, 'index.html'))) {
      throw new Error(`Frontend build is missing: ${frontendDist}`);
    }

    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
      const isBackendPath =
        req.path === '/api' ||
        req.path.startsWith('/api/') ||
        req.path === '/socket.io' ||
        req.path.startsWith('/socket.io/');
      if (req.method !== 'GET' || isBackendPath) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return {
    app,
    startScheduler: proactive.startScheduler,
    bindSocket: (socket: SocketLike) => {
      io = socket;
    }
  };
}
