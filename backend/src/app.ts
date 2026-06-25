/**
 * Express 애플리케이션의 조립 지점이다.
 * DB, LLM 어댑터, 반응 계획기, 전송 대기열과 경로를 연결한다.
 * 애플리케이션 생성과 포트 수신을 분리해 테스트가 실제 서버를 열지 않게 한다.
 * 설정, 관리자 키, 운영용 프론트엔드 빌드 문제는 생성 중 예외가 된다.
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

/**
 * 애플리케이션의 장기 생명주기를 담당하는 서비스를 조립한다.
 *
 * @param options 테스트에서 현재 실행용 관리자 BMP를 주입할 때 사용한다.
 * @returns Express app, scheduler 시작 함수, Socket.IO 결합 함수를 반환한다.
 * @throws DB 설정이 잘못되었거나 운영용 frontend build가 없으면 예외가 발생한다.
 * @remarks 포트를 열지는 않지만 기본 호출에서는 관리자 BMP 파일을 생성한다.
 */
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

  app.use((err: unknown, _req: Request, res: Response, next: express.NextFunction) => {
    // Express는 인자가 네 개인 함수를 오류 middleware로 판별하므로 next를 생략할 수 없다.
    void next;
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
