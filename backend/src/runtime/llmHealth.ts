import { config } from '../config.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
