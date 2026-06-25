/**
 * 계획된 assistant 메시지를 지연 뒤 저장하고 Socket.IO로 전송한다.
 * 세션별 기존 타이머를 취소해 계획 중복을 막는다.
 * 실제 전송 직전 입력 중 상태를 다시 확인해 뒤늦은 끼어들기를 줄인다.
 * 타이머 콜백의 DB 실패는 상위 HTTP 요청과 분리되어 있다.
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

/**
 * 세션별 전송 timer를 소유하는 메시지 queue를 만든다.
 * 새 계획은 이전 timer를 취소하고 저장 성공 후 실시간 이벤트를 발생시킨다.
 */
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
