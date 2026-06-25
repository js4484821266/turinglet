/**
 * Socket.IO 서버와 세션 room 기반 message·presence emitter를 만든다.
 * 연결 전 emit은 선택적으로 무시되며 영속 저장은 이 모듈의 책임이 아니다.
 */

import type { Server as HttpServer } from 'node:http';
import type { MessageRecord, PresenceState } from '@turinglet/shared';
import { Server } from 'socket.io';

export interface SocketLike {
  emit(event: string, payload: unknown): void;
  to(room: string): SocketLike;
}

export function createRealtimeEmitter(getSocket: () => SocketLike | undefined) {
  const emitPresence = (sessionId: string, state: PresenceState): void => {
    getSocket()?.to(`session:${sessionId}`).emit('presence', { sessionId, state });
  };

  const emitMessage = (message: MessageRecord): void => {
    getSocket()?.to(`session:${message.sessionId}`).emit('message', message);
  };

  const emitUserTyping = (sessionId: string, isTyping: boolean): void => {
    getSocket()?.to(`session:${sessionId}`).emit('user_typing', { sessionId, isTyping });
  };

  return { emitPresence, emitMessage, emitUserTyping };
}

// Socket rooms isolate conversation streams by session id. The HTTP API remains
// responsible for auth; sockets only subscribe to a session-specific channel.
export function attachSocket(httpServer: HttpServer): SocketLike {
  const io = new Server(httpServer, {
    cors: {
      origin: '*'
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
    });
  });

  return io as unknown as SocketLike;
}
