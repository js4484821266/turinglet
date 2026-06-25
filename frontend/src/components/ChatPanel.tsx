import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { io } from 'socket.io-client';
import { api, backendOrigin, type ChatMessage } from '../api';
import { useAppStore } from '../store';
import { formatTimestamp } from '../utils/time';

/**
 * 인증된 세션의 실시간 대화 화면과 입력 수명주기를 관리한다.
 * 사용자 의도는 REST로 보내고 지연된 메시지와 presence는 Socket.IO로 받는다.
 */
export function ChatPanel() {
  const sessionId = useAppStore((s) => s.sessionId);
  const messages = useAppStore((s) => s.messages);
  const assistantPresence = useAppStore((s) => s.assistantPresence);
  const userTyping = useAppStore((s) => s.userTyping);
  const setMessages = useAppStore((s) => s.setMessages);
  const appendMessage = useAppStore((s) => s.appendMessage);
  const setAssistantPresence = useAppStore((s) => s.setAssistantPresence);
  const setUserTyping = useAppStore((s) => s.setUserTyping);

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const typingTimer = useRef<number | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = io(backendOrigin);
    socket.emit('join_session', sessionId);

    socket.on('message', (message: ChatMessage) => appendMessage(message));
    socket.on('presence', (event: { state: 'typing' | 'thinking' | 'organizing' | 'waiting' }) => {
      setAssistantPresence(event.state);
    });
    socket.on('user_typing', (event: { isTyping: boolean }) => setUserTyping(event.isTyping));

    void api
      .get('/chat/messages', { headers: { 'x-session-id': sessionId } })
      .then((res) => setMessages(res.data.messages as ChatMessage[]));

    return () => {
      socket.disconnect();
    };
  }, [appendMessage, sessionId, setAssistantPresence, setMessages, setUserTyping]);

  if (!sessionId) return null;

  const sendTyping = async (isTyping: boolean) => {
    try {
      await api.post('/chat/typing', { isTyping }, { headers: { 'x-session-id': sessionId } });
    } catch {
      // Typing is advisory; losing it should never block message delivery.
    }
  };

  const refreshMessages = async () => {
    const res = await api.get('/chat/messages', { headers: { 'x-session-id': sessionId } });
    setMessages(res.data.messages as ChatMessage[]);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    void sendTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => void sendTyping(false), 4000);
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || isSending) return;
    setSendError(undefined);
    setIsSending(true);
    setDraft('');
    try {
      await api.post('/chat/messages', { content }, { headers: { 'x-session-id': sessionId } });
    } catch (error: unknown) {
      let message = '전송 실패: 잠시 후 다시 시도해주세요.';
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) message = '전송 실패: 요청이 너무 많아요(429). 2~3초 후 다시 보내주세요.';
        else if (status === 401) message = '전송 실패: 세션이 만료되었습니다. 다시 로그인해주세요.';
        else if (status) message = `전송 실패: 서버 응답 오류(${status}).`;
      }
      setSendError(message);
      setDraft(content);
      void refreshMessages().catch(() => undefined);
    } finally {
      setIsSending(false);
    }
  };

  const threadStatusText =
    assistantPresence === 'typing'
      ? '상대가 답장을 작성 중입니다...'
      : assistantPresence === 'thinking'
        ? '상대가 내용을 생각 중입니다...'
        : assistantPresence === 'organizing'
          ? '상대가 답변을 정리 중입니다...'
          : undefined;

  return (
    <div className="chat-shell card">
      <header className="chat-head">
        <h2>AI 말동무 프로토타입</h2>
      </header>

      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.role === 'user' ? 'mine' : 'theirs'}`}>
            <div className="bubble-col">
              <div className={`bubble ${m.role === 'user' ? 'mine' : 'theirs'}`}>{m.content}</div>
              <div className="msg-timestamp">{formatTimestamp(m.createdAt)}</div>
            </div>
          </div>
        ))}
        {threadStatusText ? <div className="thread-status">{threadStatusText}</div> : null}
        <div ref={messagesEndRef} />
      </div>

      {userTyping ? <div className="typing-row">입력 중...</div> : null}

      <div className="composer">
        <textarea
          className="field"
          value={draft}
          placeholder="지금 상태를 짧게 적어도 괜찮아요"
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button className="btn primary" onClick={sendMessage}>
          {isSending ? '보내는 중...' : '보내기'}
        </button>
        {sendError ? <div className="error">{sendError}</div> : null}
      </div>
    </div>
  );
}
