import type { ConversationSnapshot, LLMProviderAdapter, MessageRecord, MultiMessagePlan, SilenceMeaning } from '@turinglet/shared';
import { config } from '../config.js';
import { MockProvider } from './mockProvider.js';
import type { HFResponseEnvelope, HFTask } from './hfLocalTypes.js';
import { isSilenceMeaning, normalizeMultiMessagePlan } from './hfLocalValidation.js';

export class HuggingFaceLocalProvider implements LLMProviderAdapter {
  private readonly fallback = new MockProvider();

  private async invoke(task: HFTask, payload: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.hfLocalTimeoutMs);

    try {
      const response = await fetch(`${config.hfLocalUrl.replace(/\/$/, '')}/v1/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, payload }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`HF local endpoint failed: ${response.status}`);

      const body = (await response.json()) as HFResponseEnvelope;
      if (!body.ok) throw new Error(body.error ?? 'HF local endpoint returned failure');
      return body.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateMessage(input: {
    snapshot: ConversationSnapshot;
    intent: 'empathy' | 'question' | 'reflection' | 'checkin';
    userText?: string | undefined;
  }): Promise<string> {
    try {
      const result = await this.invoke('single_message', input as unknown as Record<string, unknown>);
      if (typeof result === 'string' && result.trim()) return result.trim();
    } catch {
      // Local LLM is optional; mock text keeps the prototype usable offline.
    }
    const fallbackInput = input.userText
      ? { snapshot: input.snapshot, intent: input.intent, userText: input.userText }
      : { snapshot: input.snapshot, intent: input.intent };
    return this.fallback.generateMessage(fallbackInput);
  }

  async generateMultiMessagePlan(input: {
    snapshot: ConversationSnapshot;
    userText?: string | undefined;
    silenceMeaning?: SilenceMeaning;
  }): Promise<MultiMessagePlan> {
    try {
      const result = await this.invoke('multi_plan', input as unknown as Record<string, unknown>);
      const plan = normalizeMultiMessagePlan(result);
      if (plan) return plan;
    } catch {
      // Fall through to lighter fallbacks.
    }

    const aiFallback = await this.aiSinglePlanFallback({
      snapshot: input.snapshot,
      userText: input.userText
    });
    if (aiFallback) return aiFallback;
    const fallbackInput: { snapshot: ConversationSnapshot; userText?: string; silenceMeaning?: SilenceMeaning } = {
      snapshot: input.snapshot
    };
    if (input.userText) fallbackInput.userText = input.userText;
    if (input.silenceMeaning) fallbackInput.silenceMeaning = input.silenceMeaning;
    return this.fallback.generateMultiMessagePlan(fallbackInput);
  }

  async summarizeConversationState(input: {
    sessionId: string;
    recentMessages: MessageRecord[];
  }): Promise<{ emotionalIntensity: number; summary: string }> {
    try {
      const result = await this.invoke('summary', input as unknown as Record<string, unknown>);
      if (result && typeof result === 'object') {
        const obj = result as { emotionalIntensity?: unknown; summary?: unknown };
        if (typeof obj.emotionalIntensity === 'number' && typeof obj.summary === 'string') {
          return {
            emotionalIntensity: Math.max(0, Math.min(10, Math.floor(obj.emotionalIntensity))),
            summary: obj.summary
          };
        }
      }
    } catch {
      // Mock summary is deterministic enough for local tests.
    }

    return this.fallback.summarizeConversationState(input);
  }

  async detectUserSilenceMeaning(input: {
    snapshot: ConversationSnapshot;
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning> {
    try {
      const result = await this.invoke('silence_meaning', input as unknown as Record<string, unknown>);
      if (isSilenceMeaning(result)) return result;
    } catch {
      // Silence meaning is advisory; fallback keeps proactive flow moving.
    }

    return this.fallback.detectUserSilenceMeaning(input);
  }

  private async aiSinglePlanFallback(input: {
    snapshot: ConversationSnapshot;
    userText?: string | undefined;
  }): Promise<MultiMessagePlan | undefined> {
    try {
      const messageInput: {
        snapshot: ConversationSnapshot;
        intent: 'reflection';
        userText?: string;
      } = {
        snapshot: input.snapshot,
        intent: 'reflection'
      };
      if (input.userText) messageInput.userText = input.userText;

      const text = await this.generateMessage(messageInput);
      if (!text.trim()) return undefined;
      return {
        sendCount: 1,
        reason: 'hf single-message fallback plan',
        nextState: 'reflective_pause',
        messages: [{ content: text, delayMs: 550, presenceBeforeSend: 'typing' }]
      };
    } catch {
      return undefined;
    }
  }
}
