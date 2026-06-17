import type { ConversationSnapshot, LLMProviderAdapter, MessageRecord, MultiMessagePlan, SilenceMeaning } from '@turinglet/shared';
import { config } from '../config.js';
import type { HFResponseEnvelope, HFTask } from './hfLocalTypes.js';
import { isSilenceMeaning, normalizeMultiMessagePlan } from './hfLocalValidation.js';

export class HuggingFaceLocalProvider implements LLMProviderAdapter {
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
    const result = await this.invoke('single_message', input as unknown as Record<string, unknown>);
    if (typeof result === 'string' && result.trim()) return result.trim();
    throw new Error('HF local endpoint returned an invalid single_message result.');
  }

  async generateMultiMessagePlan(input: {
    snapshot: ConversationSnapshot;
    userText?: string | undefined;
    silenceMeaning?: SilenceMeaning;
  }): Promise<MultiMessagePlan> {
    const result = await this.invoke('multi_plan', input as unknown as Record<string, unknown>);
    const plan = normalizeMultiMessagePlan(result);
    if (plan) return plan;
    throw new Error('HF local endpoint returned an invalid multi_plan result.');
  }

  async summarizeConversationState(input: {
    sessionId: string;
    recentMessages: MessageRecord[];
  }): Promise<{ emotionalIntensity: number; summary: string }> {
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
    throw new Error('HF local endpoint returned an invalid summary result.');
  }

  async detectUserSilenceMeaning(input: {
    snapshot: ConversationSnapshot;
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning> {
    const result = await this.invoke('silence_meaning', input as unknown as Record<string, unknown>);
    if (isSilenceMeaning(result)) return result;
    throw new Error('HF local endpoint returned an invalid silence_meaning result.');
  }
}
