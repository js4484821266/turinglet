/**
 * TypeScript 대화 도메인과 Python 로컬 LLM API 사이의 어댑터다.
 * 제한 시간, HTTP 실패, 응답 봉투 실패와 작업별 결과 검증을 담당한다.
 * 잘못된 모델 출력은 기본 응답으로 바꾸지 않고 예외로 노출한다.
 * 호출자는 이 실패를 정상 계획과 구분해 처리해야 한다.
 */

import type { ConversationSnapshot, LLMProviderAdapter, MessageRecord, MultiMessagePlan, SilenceMeaning } from '@turinglet/shared';
import { config } from '../config.js';
import type { HFResponseEnvelope, HFTask } from './hfLocalTypes.js';
import { isSilenceMeaning, normalizeMultiMessagePlan } from './hfLocalValidation.js';

export class HuggingFaceLocalProvider implements LLMProviderAdapter {
  /**
   * 작업 요청을 Python 서버로 보내고 성공 envelope의 result를 반환한다.
   * HTTP 오류, 서버 실패, timeout은 fallback 없이 예외가 된다.
   */
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

  /** 단일 메시지 결과가 비어 있거나 문자열이 아니면 예외를 던진다. */
  async generateMessage(input: {
    snapshot: ConversationSnapshot;
    intent: 'empathy' | 'question' | 'reflection' | 'checkin';
    userText?: string | undefined;
  }): Promise<string> {
    const result = await this.invoke('single_message', input as unknown as Record<string, unknown>);
    if (typeof result === 'string' && result.trim()) return result.trim();
    throw new Error('HF local endpoint returned an invalid single_message result.');
  }

  /** Python 응답을 검증된 다중 메시지 계획으로 정규화한다. */
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

  /** 감정 강도를 0~10 정수 범위로 제한하고 대화 요약을 반환한다. */
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

  /** 허용된 `SilenceMeaning` 값만 반환하고 다른 모델 출력은 거부한다. */
  async detectUserSilenceMeaning(input: {
    snapshot: ConversationSnapshot;
    recentMessages: MessageRecord[];
  }): Promise<SilenceMeaning> {
    const result = await this.invoke('silence_meaning', input as unknown as Record<string, unknown>);
    if (isSilenceMeaning(result)) return result;
    throw new Error('HF local endpoint returned an invalid silence_meaning result.');
  }
}
