/**
 * Python 로컬 LLM의 unknown 응답을 공유 도메인 타입으로 검증·정규화한다.
 * 잘못된 항목은 실행 계획에 넣지 않으며 유효한 메시지 수를 sendCount의 기준으로 삼는다.
 */

import type { MultiMessagePlan, OutboundMessageInstruction, PresenceState, SessionMachineState, SilenceMeaning } from '@turinglet/shared';

export function isSilenceMeaning(value: unknown): value is SilenceMeaning {
  return (
    value === 'crying' ||
    value === 'organizing_thoughts' ||
    value === 'emotionally_overwhelmed' ||
    value === 'away' ||
    value === 'typing'
  );
}

function isPresenceState(value: unknown): value is PresenceState {
  return value === 'typing' || value === 'thinking' || value === 'organizing' || value === 'waiting';
}

function isSessionMachineState(value: unknown): value is SessionMachineState {
  return (
    value === 'idle' ||
    value === 'waiting_after_empathy' ||
    value === 'user_typing' ||
    value === 'reflective_pause' ||
    value === 'proactive_checkin_candidate' ||
    value === 'cooldown_after_outreach' ||
    value === 'high_emotional_load'
  );
}

function normalizeMessage(item: unknown): OutboundMessageInstruction | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const entry = item as { content?: unknown; delayMs?: unknown; presenceBeforeSend?: unknown };
  if (typeof entry.content !== 'string') return undefined;
  const content = entry.content.trim();
  if (!content) return undefined;

  const delayMs = typeof entry.delayMs === 'number' ? Math.max(0, Math.floor(entry.delayMs)) : 500;
  const presenceBeforeSend = isPresenceState(entry.presenceBeforeSend) ? entry.presenceBeforeSend : undefined;
  return presenceBeforeSend
    ? { content, delayMs, presenceBeforeSend }
    : { content, delayMs };
}

export function normalizeMultiMessagePlan(result: unknown): MultiMessagePlan | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const obj = result as { sendCount?: unknown; reason?: unknown; nextState?: unknown; messages?: unknown };
  if (
    typeof obj.sendCount !== 'number' ||
    typeof obj.reason !== 'string' ||
    !isSessionMachineState(obj.nextState) ||
    !Array.isArray(obj.messages)
  ) {
    return undefined;
  }

  const messages = obj.messages
    .map(normalizeMessage)
    .filter((item): item is OutboundMessageInstruction => Boolean(item));
  return {
    sendCount: messages.length,
    reason: obj.reason,
    nextState: obj.nextState,
    messages
  };
}
