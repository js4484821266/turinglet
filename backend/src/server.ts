/**
 * 백엔드 프로세스의 실제 진입점이다.
 * 로컬 LLM 상태 확인 뒤에만 HTTP/Socket.IO 포트를 연다.
 * 모델 준비 실패는 정상 서비스로 숨기지 않고 종료 코드와 오류로 드러낸다.
 */

import http from 'node:http';
import { createApp, attachSocket } from './app.js';
import { config } from './config.js';
import { waitForLocalLlm } from './runtime/llmHealth.js';

async function main(): Promise<void> {
  await waitForLocalLlm();

  const { app, startScheduler, bindSocket } = createApp();
  const server = http.createServer(app);
  const io = attachSocket(server);
  bindSocket(io);

  server.listen(config.port, '0.0.0.0', () => {
    startScheduler();
    console.log(`Backend listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
