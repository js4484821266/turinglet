/**
 * ??? ????? ?? ?????.
 * ?? LLM health ?? ??? HTTP/Socket.IO ??? ??.
 * ?? ?? ??? ?? ???? ??? ?? exitCode? ??? ????.
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
