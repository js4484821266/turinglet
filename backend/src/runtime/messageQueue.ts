/**
 * ??? assistant ???? ?? ? ???? Socket.IO? ????.
 * ??? ?? timer? ??? ?? ??? ???.
 * ?? ?? ?? typing ??? ?? ??? ??? ????? ???.
 * timer callback? DB ??? ?? HTTP ??? ???? ??.
 */

import type { MessageRecord, PresenceState } from '@turinglet/shared';
import type { Store } from '../db/store.js';

interface QueuedMessage {
  content: string;
  delayMs: number;
  presenceBeforeSend?: PresenceState;
}

interface QueueDeps {
  store: Store;
  emitPresence: (sessionId: string, state: PresenceState) => void;
  emitMessage: (message: MessageRecord) => void;
}

// A plan can contain multiple short messages. This queue owns the timers and
// performs the last typing check immediately before each assistant message.
export function createMessageQueue(deps: QueueDeps) {
  const sessionTimers = new Map<string, NodeJS.Timeout[]>();

  const clearSessionTimers = (sessionId: string): void => {
    const timers = sessionTimers.get(sessionId) ?? [];
    timers.forEach(clearTimeout);
    sessionTimers.delete(sessionId);
  };

  const queuePlanMessages = (input: {
    sessionId: string;
    messages: QueuedMessage[];
    source: 'reactive' | 'proactive';
  }): void => {
    clearSessionTimers(input.sessionId);

    const timers = input.messages.map((item) =>
      setTimeout(async () => {
        if (await deps.store.isUserTyping(input.sessionId)) return;

        if (item.presenceBeforeSend) deps.emitPresence(input.sessionId, item.presenceBeforeSend);
        const message = await deps.store.appendMessage({
          sessionId: input.sessionId,
          role: 'assistant',
          content: item.content,
          metadata: { source: input.source }
        });
        deps.emitMessage(message);
        deps.emitPresence(input.sessionId, 'waiting');
      }, item.delayMs)
    );

    sessionTimers.set(input.sessionId, timers);
  };

  return { clearSessionTimers, queuePlanMessages };
}

export type QueuePlanMessages = ReturnType<typeof createMessageQueue>['queuePlanMessages'];
