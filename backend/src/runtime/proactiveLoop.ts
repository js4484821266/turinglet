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

// The proactive loop is separate from HTTP routes because it is a background
// observer: it scans active sessions and only speaks when timing rules allow.
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
