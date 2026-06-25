/**
 * 로컬 LLM 계획 정규화와 지연 메시지 큐의 핵심 불변식을 검증한다.
 * 외부 모델이나 실제 DB 없이 다중 말풍선 보존과 전송 직전 typing 차단을 재현한다.
 */

import type { MessageRecord } from '@turinglet/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeMultiMessagePlan } from '../src/adapters/hfLocalValidation.js';
import type { Store } from '../src/db/store.js';
import { createMessageQueue } from '../src/runtime/messageQueue.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('multi-message plan normalization', () => {
  it('keeps three or more valid messages and derives sendCount from them', () => {
    const plan = normalizeMultiMessagePlan({
      sendCount: 99,
      reason: 'split naturally',
      nextState: 'reflective_pause',
      messages: [
        { content: '첫 번째', delayMs: 100, presenceBeforeSend: 'typing' },
        { content: '두 번째', delayMs: 200, presenceBeforeSend: 'organizing' },
        { content: '세 번째', delayMs: 300, presenceBeforeSend: 'waiting' },
        { content: '   ', delayMs: 400 }
      ]
    });

    expect(plan).toBeDefined();
    expect(plan?.sendCount).toBe(3);
    expect(plan?.messages.map((message) => message.content)).toEqual(['첫 번째', '두 번째', '세 번째']);
  });
});

describe('message queue', () => {
  it('stores and emits every message in a plan with more than two messages', async () => {
    vi.useFakeTimers();
    const storedContents: string[] = [];
    const emittedContents: string[] = [];
    const store = createQueueStore(() => false, storedContents);
    const queue = createMessageQueue({
      store,
      emitPresence: () => undefined,
      emitMessage: (message) => emittedContents.push(message.content)
    });

    queue.queuePlanMessages({
      sessionId: 'session-many',
      source: 'reactive',
      messages: [
        { content: '하나', delayMs: 10 },
        { content: '둘', delayMs: 20 },
        { content: '셋', delayMs: 30 }
      ]
    });

    await vi.runAllTimersAsync();

    expect(storedContents).toEqual(['하나', '둘', '셋']);
    expect(emittedContents).toEqual(['하나', '둘', '셋']);
  });

  it('checks typing again before each delayed send', async () => {
    vi.useFakeTimers();
    let userTyping = false;
    const storedContents: string[] = [];
    const store = createQueueStore(() => userTyping, storedContents);
    const queue = createMessageQueue({
      store,
      emitPresence: () => undefined,
      emitMessage: () => undefined
    });

    queue.queuePlanMessages({
      sessionId: 'session-typing',
      source: 'reactive',
      messages: [
        { content: '먼저 전송', delayMs: 10 },
        { content: '입력 중이면 취소', delayMs: 20 }
      ]
    });

    await vi.advanceTimersByTimeAsync(10);
    userTyping = true;
    await vi.advanceTimersByTimeAsync(10);

    expect(storedContents).toEqual(['먼저 전송']);
  });
});

function createQueueStore(isTyping: () => boolean, storedContents: string[]): Store {
  return {
    async isUserTyping() {
      return isTyping();
    },
    async appendMessage(input: Parameters<Store['appendMessage']>[0]) {
      storedContents.push(input.content);
      return {
        id: `message-${storedContents.length}`,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        eventType: 'append',
        createdAt: new Date().toISOString(),
        metadata: input.metadata
      } satisfies MessageRecord;
    }
  } as unknown as Store;
}
