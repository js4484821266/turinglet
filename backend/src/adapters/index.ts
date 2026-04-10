import type { LLMProviderAdapter } from '@turinglet/shared';
import { config } from '../config.js';
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
  return config.mockProvider ? new MockProvider() : new PlaceholderExternalProvider();
}
