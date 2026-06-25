/**
 * backend가 포트를 열기 전에 로컬 LLM health 준비를 반복 확인한다.
 * 제한 시간을 넘기면 마지막 연결 오류를 포함한 예외로 시작을 중단한다.
 */

import { config } from '../config.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 설정된 시작 대기 시간 동안 로컬 LLM `/health`를 반복 확인한다.
 * 성공하면 반환하고, 제한 시간이 지나면 마지막 오류를 포함해 예외를 던진다.
 */
export async function waitForLocalLlm(): Promise<void> {
  const deadline = Date.now() + config.hfLocalStartupWaitMs;
  const healthUrl = `${config.hfLocalUrl.replace(/\/$/, '')}/health`;
  let lastError = 'unknown error';

  while (Date.now() <= deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(2000);
  }

  throw new Error(`Local LLM is not ready at ${healthUrl}: ${lastError}`);
}
