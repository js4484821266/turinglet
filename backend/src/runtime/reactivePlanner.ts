/**
 * 사용자 메시지 직후의 반응 계획을 타이머 기반으로 지연 실행한다.
 * HTTP는 먼저 202를 반환하고 이 모듈은 후속 입력과 입력 중 상태를 관찰한다.
 * 세션별 순번과 타이머가 오래된 계획의 뒤늦은 전송을 막는다.
 * DB 또는 LLM 실패는 비동기 콜백의 오류 경계에서 관찰해야 한다.
 */

import type { LLMProviderAdapter, PresenceState } from '@turinglet/shared';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import type { ConversationOrchestrator } from '../engine/orchestrator.js';
import type { QueuePlanMessages } from './messageQueue.js';

interface ReactiveDeps {
  store: Store;
  provider: LLMProviderAdapter;
  orchestrator: ConversationOrchestrator;
  emitPresence: (sessionId: string, state: PresenceState) => void;
  queuePlanMessages: QueuePlanMessages;
}

/**
 * 세션별 timer와 sequence를 소유하는 reactive planner를 만든다.
 * 반환된 scheduler는 사용자 입력 종료를 기다리며 비동기 오류는 HTTP 응답과 분리된다.
 */
export function createReactivePlanner(deps: ReactiveDeps) {
  const reactivePlanTimers = new Map<string, NodeJS.Timeout>();
  const reactiveSequence = new Map<string, number>();

  const clearReactivePlanTimer = (sessionId: string): void => {
    const timer = reactivePlanTimers.get(sessionId);
    if (!timer) return;
    clearTimeout(timer);
    reactivePlanTimers.delete(sessionId);
  };

  const scheduleReactivePlan = (input: {
    sessionId: string;
    userText: string;
    attempt?: number;
    sequence?: number;
    startedAt?: number;
  }): void => {
    const attempt = input.attempt ?? 0;
    const sequence = input.sequence ?? (reactiveSequence.get(input.sessionId) ?? 0) + 1;
    const startedAt = input.startedAt ?? Date.now();
    reactiveSequence.set(input.sessionId, sequence);

    clearReactivePlanTimer(input.sessionId);
    const delay = attempt === 0 ? config.userContinuationGraceMs : 900;

    const timer = setTimeout(async () => {
      if (reactiveSequence.get(input.sessionId) !== sequence) return;

      const typing = await deps.store.isUserTyping(input.sessionId);
      if (typing) {
        if (attempt < 20) {
          scheduleReactivePlan({ ...input, attempt: attempt + 1, sequence, startedAt });
        }
        deps.emitPresence(input.sessionId, 'waiting');
        return;
      }

      deps.emitPresence(input.sessionId, 'thinking');
      const snapshot = await deps.store.getConversationSnapshot(input.sessionId);
      const plan = await deps.orchestrator.planForUserMessage({ snapshot, userText: input.userText });

      if (plan.sendCount === 0) {
        const elapsed = Date.now() - startedAt;
        const holdForContinuation = /continuation|typing|defer/i.test(plan.reason);
        if (holdForContinuation && elapsed < config.reactiveResponseMaxWaitMs && attempt < 20) {
          deps.emitPresence(input.sessionId, 'organizing');
          scheduleReactivePlan({ ...input, attempt: attempt + 1, sequence, startedAt });
          return;
        }

        const forcedPlan = await deps.provider.generateMultiMessagePlan({ snapshot, userText: input.userText });
        deps.queuePlanMessages({
          sessionId: input.sessionId,
          messages: forcedPlan.messages,
          source: 'reactive'
        });
        return;
      }

      deps.queuePlanMessages({
        sessionId: input.sessionId,
        messages: plan.messages,
        source: 'reactive'
      });
    }, delay);

    reactivePlanTimers.set(input.sessionId, timer);
  };

  return { clearReactivePlanTimer, scheduleReactivePlan };
}

export type ScheduleReactivePlan = ReturnType<typeof createReactivePlanner>['scheduleReactivePlan'];
