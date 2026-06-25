/**
 * Python 로컬 LLM HTTP API의 작업 이름과 응답 봉투 타입을 정의한다.
 * result는 신뢰하지 않고 작업별 validation 모듈에서 다시 검사한다.
 */

export type HFTask = 'single_message' | 'multi_plan' | 'summary' | 'silence_meaning';

export interface HFResponseEnvelope {
  ok: boolean;
  result?: unknown;
  error?: string;
}
