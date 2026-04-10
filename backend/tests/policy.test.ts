import { evaluateProactiveDecision } from '@turinglet/scheduler';
import { describe, expect, it } from 'vitest';
import { MockProvider } from '../src/adapters/mockProvider.js';
import { ConversationOrchestrator } from '../src/engine/orchestrator.js';

describe('proactive scheduler conditions', () => {
  it('sends short check-in when silence is long and cooldown passed', () => {
    const now = Date.now();
    const decision = evaluateProactiveDecision({
      snapshot: {
        sessionId: 's1',
        lastUserMessageAt: now - 200_000,
        lastAssistantMessageAt: now - 300_000,
        lastMessageAt: now - 200_000,
        recentEmotionalIntensity: 4,
        userTyping: false,
        state: 'idle'
      },
      now,
      lastOutreachAt: now - 500_000,
      minSilenceMs: 120_000,
      cooldownMs: 240_000
    });

    expect(decision.shouldSend).toBe(true);
  });

  it('does not interject while user is typing', async () => {
    const orchestrator = new ConversationOrchestrator(new MockProvider());
    const plan = await orchestrator.planForUserMessage({
      snapshot: {
        sessionId: 's1',
        lastUserMessageAt: Date.now(),
        lastAssistantMessageAt: Date.now(),
        lastMessageAt: Date.now(),
        recentEmotionalIntensity: 5,
        userTyping: true,
        state: 'user_typing'
      },
      userText: '아직 쓰는 중'
    });

    expect(plan.sendCount).toBe(0);
  });

  it('uses empathy then wait policy for high emotional load silence', async () => {
    const orchestrator = new ConversationOrchestrator(new MockProvider());
    const plan = await orchestrator.planForSilence({
      snapshot: {
        sessionId: 's1',
        lastUserMessageAt: Date.now() - 300_000,
        lastAssistantMessageAt: Date.now() - 400_000,
        lastMessageAt: Date.now() - 300_000,
        recentEmotionalIntensity: 8,
        userTyping: false,
        state: 'high_emotional_load'
      }
    });

    expect(plan.sendCount).toBe(1);
    expect(plan.nextState).toBe('waiting_after_empathy');
  });
});
