import type { ProactiveDecision, ProactiveDecisionInput, SessionMachineState } from '@turinglet/shared';

function isHighEmotionalLoad(intensity: number): boolean {
  return intensity >= 7;
}

function resolveState(input: ProactiveDecisionInput): SessionMachineState {
  if (input.snapshot.userTyping) return 'user_typing';
  if (isHighEmotionalLoad(input.snapshot.recentEmotionalIntensity)) return 'high_emotional_load';
  return 'proactive_checkin_candidate';
}

export function evaluateProactiveDecision(input: ProactiveDecisionInput): ProactiveDecision {
  const state = resolveState(input);

  if (input.snapshot.userTyping) {
    return {
      shouldSend: false,
      reason: 'User is typing; avoid interruption.',
      suggestedState: state
    };
  }

  if (!input.snapshot.lastUserMessageAt) {
    return {
      shouldSend: false,
      reason: 'No user speech yet; no outreach.',
      suggestedState: 'idle'
    };
  }

  const silenceMs = input.now - input.snapshot.lastUserMessageAt;
  if (silenceMs < input.minSilenceMs) {
    return {
      shouldSend: false,
      reason: 'Silence window too short for outreach.',
      suggestedState: 'reflective_pause'
    };
  }

  if (input.lastOutreachAt && input.now - input.lastOutreachAt < input.cooldownMs) {
    return {
      shouldSend: false,
      reason: 'Outreach cooldown active.',
      suggestedState: 'cooldown_after_outreach'
    };
  }

  return {
    shouldSend: true,
    reason: isHighEmotionalLoad(input.snapshot.recentEmotionalIntensity)
      ? 'High emotional load + long silence: send gentle empathy then wait.'
      : 'Long silence and no cooldown: eligible for short check-in.',
    suggestedState: state
  };
}
