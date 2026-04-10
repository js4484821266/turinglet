import http from 'node:http';
import { createApp, attachSocket } from './app.js';
import { config } from './config.js';

const { app, startScheduler, bindSocket } = createApp();
const server = http.createServer(app);
const io = attachSocket(server);
bindSocket(io);

server.listen(config.port, () => {
  startScheduler();
  console.log(`Backend listening on http://localhost:${config.port}`);
});
