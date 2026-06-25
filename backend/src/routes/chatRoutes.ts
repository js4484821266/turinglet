/**
 * ??? ??? typing, history, message HTTP endpoint? ????.
 * ?? ???? ?? ??? ??? ??? ????? ????.
 * LLM ?? ??? ?? ??? ?? ??? ???? ???.
 * ??? POST /messages? 202? assistant ?? ??? ???.
 */

import type express from 'express';
import type { LLMProviderAdapter, MessageRecord } from '@turinglet/shared';
import type { Store } from '../db/store.js';
import type { ScheduleReactivePlan } from '../runtime/reactivePlanner.js';
import { requireSession } from './sessionAuth.js';
import { MessageSchema, TypingSchema } from './schemas.js';

interface ChatRouteDeps {
  store: Store;
  provider: LLMProviderAdapter;
  emitMessage: (message: MessageRecord) => void;
  emitUserTyping: (sessionId: string, isTyping: boolean) => void;
  scheduleReactivePlan: ScheduleReactivePlan;
}

export function registerChatRoutes(app: express.Express, deps: ChatRouteDeps): void {
  app.post('/api/chat/typing', async (req, res) => {
    const identity = await requireSession(deps.store, req, res);
    if (!identity) return;

    const parsed = TypingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid typing payload' });
      return;
    }

    await deps.store.setTypingPresence({
      sessionId: identity.sessionId,
      userId: identity.userId,
      isTyping: parsed.data.isTyping
    });
    deps.emitUserTyping(identity.sessionId, parsed.data.isTyping);
    res.status(204).send();
  });

  app.get('/api/chat/messages', async (req, res) => {
    const identity = await requireSession(deps.store, req, res);
    if (!identity) return;

    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const messages = await deps.store.listMessages(identity.sessionId, Number.isFinite(limit) ? limit : 200);
    res.json({ messages });
  });

  app.post('/api/chat/messages', async (req, res) => {
    const identity = await requireSession(deps.store, req, res);
    if (!identity) return;

    const parsed = MessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid message' });
      return;
    }

    const userMessage = await deps.store.appendMessage({
      sessionId: identity.sessionId,
      role: 'user',
      content: parsed.data.content,
      metadata: { source: 'user_input' }
    });
    deps.emitMessage(userMessage);
    deps.scheduleReactivePlan({ sessionId: identity.sessionId, userText: parsed.data.content });

    res.status(202).json({
      accepted: true,
      planReason: 'deferred_reactive_planning',
      sendCount: null
    });

    // Summaries are useful but non-blocking; a failure here should not make the
    // user's message send feel broken.
    setImmediate(() => {
      void (async () => {
        try {
          const recent = await deps.store.listMessages(identity.sessionId, 30);
          const summary = await deps.provider.summarizeConversationState({
            sessionId: identity.sessionId,
            recentMessages: recent
          });
          await deps.store.upsertEmotionalSnapshot({
            sessionId: identity.sessionId,
            intensity: summary.emotionalIntensity,
            summary: summary.summary
          });
        } catch (error) {
          console.error('Background summarization failed', error);
        }
      })();
    });
  });
}
