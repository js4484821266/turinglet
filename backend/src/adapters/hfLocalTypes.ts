export type HFTask = 'single_message' | 'multi_plan' | 'summary' | 'silence_meaning';

export interface HFResponseEnvelope {
  ok: boolean;
  result?: unknown;
  error?: string;
}
