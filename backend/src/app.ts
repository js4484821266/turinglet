import type { Server as HttpServer } from 'node:http';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import QRCode from 'qrcode';
import { evaluateProactiveDecision } from '@turinglet/scheduler';
import type { MessageRecord, PresenceState } from '@turinglet/shared';
import { Server } from 'socket.io';
import { z } from 'zod';
import { createProvider } from './adapters/index.js';
import { config } from './config.js';
import { createStore } from './db/index.js';
import type { Store } from './db/store.js';
import { MessageGenerator } from './engine/messageGenerator.js';
import { ConversationOrchestrator } from './engine/orchestrator.js';
import { createRateLimiter } from './rateLimit.js';
import { decodeQrPayload, encodeQrPayload } from './utils/qrPayload.js';
import { generateLongPublicId, generateRecoveryCode, hashOptional } from './utils/security.js';

interface SocketLike {
  emit(event: string, payload: unknown): void;
  to(room: string): SocketLike;
}

export interface AppServices {
  app: express.Express;
  startScheduler: () => void;
  bindSocket: (socket: SocketLike) => void;
}

const RegisterSchema = z.object({
  displayName: z.string().optional(),
  enableRecoveryCode: z.boolean().default(false)
});

const LoginSchema = z.object({
  qrPayload: z.string().min(10)
});

const RecoverSchema = z.object({
  recoveryCode: z.string().min(8)
});

const MessageSchema = z.object({
  content: z.string().min(1).max(5000)
});

const TypingSchema = z.object({
  isTyping: z.boolean()
});

export function createApp(): AppServices {
  const app = express();
  let io: SocketLike | undefined;
  const store: Store = createStore();
  const provider = createProvider();
  const generator = new MessageGenerator(provider);
  const orchestrator = new ConversationOrchestrator(provider);

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(createRateLimiter(config.rateLimitWindowMs, config.rateLimitMax));

  const sessionTimers = new Map<string, NodeJS.Timeout[]>();

  const emitPresence = (sessionId: string, state: PresenceState): void => {
    io?.to(`session:${sessionId}`).emit('presence', { sessionId, state });
  };

  const emitMessage = (message: MessageRecord): void => {
    io?.to(`session:${message.sessionId}`).emit('message', message);
  };

  const clearSessionTimers = (sessionId: string): void => {
    const timers = sessionTimers.get(sessionId) ?? [];
    timers.forEach(clearTimeout);
    sessionTimers.delete(sessionId);
  };

  const queuePlanMessages = (input: {
    sessionId: string;
    messages: Array<{ content: string; delayMs: number; presenceBeforeSend?: PresenceState }>;
    source: 'reactive' | 'proactive';
  }): void => {
    clearSessionTimers(input.sessionId);

    const timers = input.messages.map((item) =>
      setTimeout(async () => {
        if (await store.isUserTyping(input.sessionId)) {
          return;
        }
        if (item.presenceBeforeSend) emitPresence(input.sessionId, item.presenceBeforeSend);
        const message = await store.appendMessage({
          sessionId: input.sessionId,
          role: 'assistant',
          content: item.content,
          metadata: { source: input.source }
        });
        emitMessage(message);
        emitPresence(input.sessionId, 'waiting');
      }, item.delayMs)
    );

    sessionTimers.set(input.sessionId, timers);
  };

  const auth = async (req: Request, res: Response): Promise<{ sessionId: string; userId: string } | undefined> => {
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
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const publicId = generateLongPublicId();
    const recoveryCode = parsed.data.enableRecoveryCode ? generateRecoveryCode() : undefined;
    const user = await store.createUser({
      publicId,
      displayName: parsed.data.displayName,
      recoveryCodeHash: hashOptional(recoveryCode)
    });
    await store.createIdentityToken(user.id, publicId);

    const qrPayload = encodeQrPayload({ v: 1, type: 'turinglet-id', token: publicId });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'H' });

    res.status(201).json({
      userId: user.id,
      publicId: user.publicId,
      qrPayload,
      qrDataUrl,
      recoveryCode
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid login payload' });
      return;
    }

    try {
      const payload = decodeQrPayload(parsed.data.qrPayload);
      const user = await store.findUserByToken(payload.token);
      if (!user) {
        res.status(401).json({ error: 'Unknown QR token' });
        return;
      }
      const existingSession = await store.getLatestSessionByUserId(user.id);
      const session = existingSession ?? (await store.createSession(user.id));
      if (!existingSession) {
        await store.appendMessage({
          sessionId: session.id,
          role: 'assistant',
          content: '안녕하세요. 지금은 천천히 시작해도 괜찮아요.',
          metadata: { source: 'system_greeting' }
        });
      }
      res.status(200).json({ sessionId: session.id, userId: user.id, resumed: Boolean(existingSession) });
    } catch {
      res.status(400).json({ error: 'Malformed or forged QR payload' });
    }
  });

  app.post('/api/auth/recover', async (req, res) => {
    const parsed = RecoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid recovery payload' });
      return;
    }

    const user = await store.findUserByRecoveryCode(parsed.data.recoveryCode);
    if (!user) {
      res.status(401).json({ error: 'Recovery code mismatch' });
      return;
    }

    const replacementPublicId = generateLongPublicId();
    await store.createIdentityToken(user.id, replacementPublicId);
    const qrPayload = encodeQrPayload({ v: 1, type: 'turinglet-id', token: replacementPublicId });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: 'H' });
    res.status(200).json({ qrPayload, qrDataUrl });
  });

  app.post('/api/chat/typing', async (req, res) => {
    const identity = await auth(req, res);
    if (!identity) return;

    const parsed = TypingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid typing payload' });
      return;
    }

    await store.setTypingPresence({
      sessionId: identity.sessionId,
      userId: identity.userId,
      isTyping: parsed.data.isTyping
    });
    io?.to(`session:${identity.sessionId}`).emit('user_typing', {
      sessionId: identity.sessionId,
      isTyping: parsed.data.isTyping
    });
    res.status(204).send();
  });

  app.get('/api/chat/messages', async (req, res) => {
    const identity = await auth(req, res);
    if (!identity) return;

    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const messages = await store.listMessages(identity.sessionId, Number.isFinite(limit) ? limit : 200);
    res.json({ messages });
  });

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

  app.post('/api/chat/messages', async (req, res) => {
    const identity = await auth(req, res);
    if (!identity) return;

    const parsed = MessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid message' });
      return;
    }

    await store.setTypingPresence({
      sessionId: identity.sessionId,
      userId: identity.userId,
      isTyping: false
    });

    const userMessage = await store.appendMessage({
      sessionId: identity.sessionId,
      role: 'user',
      content: parsed.data.content,
      metadata: { source: 'user_input' }
    });
    emitMessage(userMessage);

    const recent = await store.listMessages(identity.sessionId, 30);
    const summary = await provider.summarizeConversationState({
      sessionId: identity.sessionId,
      recentMessages: recent
    });
    await store.upsertEmotionalSnapshot({
      sessionId: identity.sessionId,
      intensity: summary.emotionalIntensity,
      summary: summary.summary
    });

    const snapshot = await store.getConversationSnapshot(identity.sessionId);
    const plan = await orchestrator.planForUserMessage({
      snapshot,
      userText: parsed.data.content
    });

    queuePlanMessages({
      sessionId: identity.sessionId,
      messages: plan.messages,
      source: 'reactive'
    });

    res.status(202).json({ accepted: true, planReason: plan.reason, sendCount: plan.sendCount });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const runProactiveLoop = async (): Promise<void> => {
    const sessions = await store.listActiveSessions();
    for (const session of sessions) {
      const snapshot = await store.getConversationSnapshot(session.id);
      const lastOutreach = await store.getLastProactiveEventAt(session.id);
      const decision = evaluateProactiveDecision({
        snapshot,
        now: Date.now(),
        lastOutreachAt: lastOutreach,
        minSilenceMs: config.proactiveMinSilenceMs,
        cooldownMs: config.proactiveCooldownMs
      });

      if (!decision.shouldSend) {
        continue;
      }

      const recent = await store.listMessages(session.id, 20);
      const silenceMeaning = await generator.inferSilence({ snapshot, recentMessages: recent });
      if (silenceMeaning === 'typing') continue;

      const plan = await orchestrator.planForSilence({ snapshot });
      queuePlanMessages({
        sessionId: session.id,
        messages: plan.messages,
        source: 'proactive'
      });
      await store.recordProactiveEvent({
        sessionId: session.id,
        decision: 'sent',
        reason: `${decision.reason}; silenceMeaning=${silenceMeaning}`
      });
    }
  };

  let interval: NodeJS.Timeout | undefined;

  const startScheduler = (): void => {
    if (interval) return;
    interval = setInterval(() => {
      runProactiveLoop().catch((error) => console.error('Proactive loop failed', error));
    }, config.proactivePollMs);
  };

  return {
    app,
    startScheduler,
    bindSocket: (socket: SocketLike) => {
      io = socket;
    }
  };
}

export function attachSocket(httpServer: HttpServer): SocketLike {
  const io = new Server(httpServer, {
    cors: {
      origin: '*'
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
    });
  });

  return io as unknown as SocketLike;
}
