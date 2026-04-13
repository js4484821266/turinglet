import type {
  ConversationSnapshot,
  LLMProviderAdapter,
  MessageRecord,
  MultiMessagePlan,
  OutboundMessageInstruction,
  PresenceState,
  SilenceMeaning
} from '@turinglet/shared';
import { config } from '../config.js';
import { MockProvider } from './mockProvider.js';

type HFTask = 'single_message' | 'multi_plan' | 'summary' | 'silence_meaning';

interface HFResponseEnvelope {
  ok: boolean;
  result?: unknown;
  error?: string;
}

function isPresenceState(value: unknown): value is PresenceState {
  return value === 'typing' || value === 'thinking' || value === 'organizing' || value === 'waiting';
}

function isSilenceMeaning(value: unknown): value is SilenceMeaning {
  return (
    value === 'crying' ||
    value === 'organizing_thoughts' ||
    value === 'emotionally_overwhelmed' ||
    value === 'away' ||
    value === 'typing'
  );
}

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

      if (!response.ok) {
        throw new Error(`HF local endpoint failed: ${response.status}`);
      }

      const body = (await response.json()) as HFResponseEnvelope;
      if (!body.ok) {
        throw new Error(body.error ?? 'HF local endpoint returned failure');
      }
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
      // fall through to mock provider
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
      if (result && typeof result === 'object') {
        const obj = result as {
          sendCount?: unknown;
          reason?: unknown;
          nextState?: unknown;
          messages?: unknown;
        };

        if (
          typeof obj.sendCount === 'number' &&
          typeof obj.reason === 'string' &&
          typeof obj.nextState === 'string' &&
          Array.isArray(obj.messages)
        ) {
          const messages: OutboundMessageInstruction[] = obj.messages
            .map((item): OutboundMessageInstruction | undefined => {
              if (!item || typeof item !== 'object') return undefined;
              const entry = item as { content?: unknown; delayMs?: unknown; presenceBeforeSend?: unknown };
              if (typeof entry.content !== 'string') return undefined;
              const delayMs = typeof entry.delayMs === 'number' ? Math.max(0, Math.floor(entry.delayMs)) : 500;
              const presence = isPresenceState(entry.presenceBeforeSend)
                ? entry.presenceBeforeSend
                : undefined;
              return presence
                ? {
                    content: entry.content,
                    delayMs,
                    presenceBeforeSend: presence
                  }
                : {
                    content: entry.content,
                    delayMs
                  };
            })
            .filter((item): item is OutboundMessageInstruction => Boolean(item));

          return {
            sendCount: Math.max(0, Math.floor(obj.sendCount)),
            reason: obj.reason,
            nextState: obj.nextState as MultiMessagePlan['nextState'],
            messages
          };
        }
      }
    } catch {
      // fall through to mock provider
    }

    const fallbackInput: {
      snapshot: ConversationSnapshot;
      userText?: string;
      silenceMeaning?: SilenceMeaning;
    } = { snapshot: input.snapshot };
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
      // fall through to mock provider
    }

    return this.fallback.summarizeConversationState(input);
  }

  async detectUserSilenceMeaning(input: {
    snapshot: ConversationSnapshot;
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning> {
    try {
      const result = await this.invoke('silence_meaning', input as unknown as Record<string, unknown>);
      if (isSilenceMeaning(result)) {
        return result;
      }
    } catch {
      // fall through to mock provider
    }

    return this.fallback.detectUserSilenceMeaning(input);
  }
}
