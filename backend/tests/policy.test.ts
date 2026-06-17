import { evaluateProactiveDecision } from '@turinglet/scheduler';
import type { LLMProviderAdapter, MultiMessagePlan, SilenceMeaning } from '@turinglet/shared';
import { describe, expect, it } from 'vitest';
import { ConversationOrchestrator } from '../src/engine/orchestrator.js';

class TestProvider implements LLMProviderAdapter {
  async generateMessage(): Promise<string> {
    return 'test message';
  }

  async generateMultiMessagePlan(): Promise<MultiMessagePlan> {
    return {
      sendCount: 1,
      reason: 'test plan',
      nextState: 'waiting_after_empathy',
      messages: [{ content: 'test message', delayMs: 100, presenceBeforeSend: 'typing' }]
    };
  }

  async summarizeConversationState(): Promise<{ emotionalIntensity: number; summary: string }> {
    return { emotionalIntensity: 5, summary: 'test summary' };
  }

  async detectUserSilenceMeaning(): Promise<SilenceMeaning> {
    return 'emotionally_overwhelmed';
  }
}

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
    const orchestrator = new ConversationOrchestrator(new TestProvider());
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
    const orchestrator = new ConversationOrchestrator(new TestProvider());
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
