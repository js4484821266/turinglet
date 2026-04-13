import type { LLMProviderAdapter } from '@turinglet/shared';
import { config } from '../config.js';
import { HuggingFaceLocalProvider } from './hfLocalProvider.js';
import { MockProvider } from './mockProvider.js';

class PlaceholderExternalProvider implements LLMProviderAdapter {
  async generateMessage(): Promise<string> {
    throw new Error('External provider not configured. Set MOCK_PROVIDER=true for local demo.');
  }
  async generateMultiMessagePlan(): Promise<never> {
    throw new Error('External provider not configured.');
  }
  async summarizeConversationState(): Promise<never> {
    throw new Error('External provider not configured.');
  }
  async detectUserSilenceMeaning(): Promise<never> {
    throw new Error('External provider not configured.');
  }
}

export function createProvider(): LLMProviderAdapter {
  if (config.llmProvider === 'mock') return new MockProvider();
  if (config.llmProvider === 'hf-local') return new HuggingFaceLocalProvider();
  return config.mockProvider ? new MockProvider() : new PlaceholderExternalProvider();
}
