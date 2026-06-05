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

// Reactive planning is deliberately asynchronous: the HTTP handler can return
// 202 immediately, while this loop waits for continuation and typing signals.
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
