/**
 * 활성 세션을 주기적으로 확인해 선제 발화 후보를 처리한다.
 * 시점 정책, 침묵 해석, 문장 계획, 전송 대기열을 순서대로 연결한다.
 * 한 세션의 DB 또는 LLM 실패는 격리해 다른 세션 검사를 계속한다.
 * 최근 메시지는 5개로 제한해 작은 모델의 문맥 길이 초과를 줄인다.
 */

import { evaluateProactiveDecision } from '@turinglet/scheduler';
import { config } from '../config.js';
import type { Store } from '../db/store.js';
import type { MessageGenerator } from '../engine/messageGenerator.js';
import type { ConversationOrchestrator } from '../engine/orchestrator.js';
import type { QueuePlanMessages } from './messageQueue.js';

interface ProactiveDeps {
  store: Store;
  generator: MessageGenerator;
  orchestrator: ConversationOrchestrator;
  queuePlanMessages: QueuePlanMessages;
}

/**
 * 활성 세션을 독립적으로 검사하는 proactive loop와 시작 함수를 만든다.
 * 같은 인스턴스는 interval 하나만 유지하고 세션별 실패를 격리한다.
 */
export function createProactiveScheduler(deps: ProactiveDeps) {
  let interval: NodeJS.Timeout | undefined;

  const runProactiveLoop = async (): Promise<void> => {
    const sessions = await deps.store.listActiveSessions();
    for (const session of sessions) {
      try {
        const snapshot = await deps.store.getConversationSnapshot(session.id);
        const lastOutreach = await deps.store.getLastProactiveEventAt(session.id);
        const decision = evaluateProactiveDecision({
          snapshot,
          now: Date.now(),
          lastOutreachAt: lastOutreach,
          minSilenceMs: config.proactiveMinSilenceMs,
          cooldownMs: config.proactiveCooldownMs
        });

        if (!decision.shouldSend) continue;

        const recent = await deps.store.listMessages(session.id, 5);
        const silenceMeaning = await deps.generator.inferSilence({ snapshot, recentMessages: recent });
        if (silenceMeaning === 'typing') continue;

        const plan = await deps.orchestrator.planForSilence({ snapshot });
        deps.queuePlanMessages({ sessionId: session.id, messages: plan.messages, source: 'proactive' });
        await deps.store.recordProactiveEvent({
          sessionId: session.id,
          decision: 'sent',
          reason: `${decision.reason}; silenceMeaning=${silenceMeaning}`
        });
      } catch (error) {
        console.error(`Proactive loop skipped session ${session.id}`, error);
      }
    }
  };

  const startScheduler = (): void => {
    if (interval) return;
    interval = setInterval(() => {
      runProactiveLoop().catch((error) => console.error('Proactive loop failed', error));
    }, config.proactivePollMs);
  };

  return { runProactiveLoop, startScheduler };
}
