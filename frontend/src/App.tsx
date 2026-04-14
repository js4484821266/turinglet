import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import axios from 'axios';
import { io } from 'socket.io-client';
import { api, type AdminProactiveEventRow, type AdminSessionRow, type AdminUserRow, type ChatMessage } from './api';
import { useAppStore } from './store';

type ViewMode = 'chat' | 'admin';

interface AdminOverview {
  users: AdminUserRow[];
  sessions: AdminSessionRow[];
  proactiveEvents: AdminProactiveEventRow[];
}

function AuthPanel() {
  const setAuth = useAppStore((s) => s.setAuth);
  const setRegistration = useAppStore((s) => s.setRegistration);
  const qrDataUrl = useAppStore((s) => s.qrDataUrl);
  const qrPayload = useAppStore((s) => s.qrPayload);
  const recoveryCode = useAppStore((s) => s.recoveryCode);

  const [displayName, setDisplayName] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useMemo(() => new BrowserQRCodeReader(), []);

  const register = async () => {
    setError(undefined);
    try {
      const res = await api.post('/auth/register', {
        displayName,
        enableRecoveryCode: true
      });
      setRegistration({
        qrPayload: res.data.qrPayload,
        qrDataUrl: res.data.qrDataUrl,
        recoveryCode: res.data.recoveryCode
      });
      setQrInput(res.data.qrPayload);
    } catch {
      setError('가입 중 오류가 발생했습니다.');
    }
  };

  const login = async (payload: string) => {
    setError(undefined);
    try {
      const res = await api.post('/auth/login', { qrPayload: payload });
      setAuth({ sessionId: res.data.sessionId, userId: res.data.userId });
    } catch {
      setError('로그인 실패: QR 형식/토큰을 확인해주세요.');
    }
  };

  const scanWithCamera = async () => {
    if (!videoRef.current) return;
    setError(undefined);
    try {
      const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current);
      setQrInput(result.getText());
      await login(result.getText());
    } catch {
      setError('카메라 스캔 실패. 업로드 방식도 시도해주세요.');
    }
  };

  const scanFromImage = async (file: File) => {
    setError(undefined);
    try {
      const imageUrl = URL.createObjectURL(file);
      const result = await codeReader.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      setQrInput(result.getText());
      await login(result.getText());
    } catch {
      setError('이미지에서 QR을 읽지 못했습니다.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="panel card">
        <h2>QR 기반 가입</h2>
        <input
          className="field"
          placeholder="표시 이름 (선택)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button className="btn primary" onClick={register}>
          가입 + QR 발급
        </button>
        {qrDataUrl ? (
          <div className="qr-block">
            <img src={qrDataUrl} alt="QR" className="qr" />
            <a className="btn ghost" href={qrDataUrl} download="turinglet-identity-qr.png">
              QR 다운로드
            </a>
            {recoveryCode ? <p className="hint">복구코드: {recoveryCode}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="panel card">
        <h2>QR 로그인</h2>
        <textarea
          className="field"
          placeholder="QR payload 붙여넣기"
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
        />
        <button className="btn primary" onClick={() => login(qrInput)}>
          로그인
        </button>

        <div className="scan-tools">
          <video ref={videoRef} className="video" muted />
          <button className="btn" onClick={scanWithCamera}>
            카메라로 스캔
          </button>
          <label className="btn ghost">
            이미지 업로드로 스캔
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void scanFromImage(file);
              }}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}

function formatTimestamp(createdAt: string): string {
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return createdAt;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}년 ${pad(d.getMonth() + 1)}월 ${pad(d.getDate())}일 ${pad(d.getHours())}시 ${pad(d.getMinutes())}분 ${pad(d.getSeconds())}초`;
}

function ChatPanel() {
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
    const socket = io('http://localhost:4000');
    socket.emit('join_session', sessionId);

    socket.on('message', (message: ChatMessage) => {
      appendMessage(message);
    });

    socket.on('presence', (event: { state: 'typing' | 'thinking' | 'organizing' | 'waiting' }) => {
      setAssistantPresence(event.state);
    });

    socket.on('user_typing', (event: { isTyping: boolean }) => {
      setUserTyping(event.isTyping);
    });

    void api
      .get('/chat/messages', {
        headers: { 'x-session-id': sessionId }
      })
      .then((res) => setMessages(res.data.messages as ChatMessage[]));

    return () => {
      socket.disconnect();
    };
  }, [appendMessage, sessionId, setAssistantPresence, setMessages, setUserTyping]);

  if (!sessionId) return null;

  const sendTyping = async (isTyping: boolean) => {
    try {
      await api.post(
        '/chat/typing',
        { isTyping },
        {
          headers: { 'x-session-id': sessionId }
        }
      );
    } catch {
      // Typing presence is advisory only; do not fail message delivery because of it.
    }
  };

  const refreshMessages = async () => {
    const res = await api.get('/chat/messages', {
      headers: { 'x-session-id': sessionId }
    });
    setMessages(res.data.messages as ChatMessage[]);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    void sendTyping(true);
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
    }
    typingTimer.current = window.setTimeout(() => {
      void sendTyping(false);
    }, 4000);
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || isSending) return;
    setSendError(undefined);
    setIsSending(true);
    setDraft('');
    try {
      await api.post(
        '/chat/messages',
        { content },
        {
          headers: { 'x-session-id': sessionId }
        }
      );
    } catch (error: unknown) {
      let message = '전송 실패: 잠시 후 다시 시도해주세요.';
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          message = '전송 실패: 요청이 너무 많아요(429). 2~3초 후 다시 보내주세요.';
        } else if (status === 401) {
          message = '전송 실패: 세션이 만료되었습니다. 다시 로그인해주세요.';
        } else if (status) {
          message = `전송 실패: 서버 응답 오류(${status}).`;
        }
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
        <h2>관계형 상담 챗 프로토타입</h2>
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

function AdminPanel() {
  const [overview, setOverview] = useState<AdminOverview | undefined>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadOverview = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.get('/admin/overview');
      const data = res.data as AdminOverview;
      setOverview(data);
      if (!selectedSessionId && data.sessions[0]) {
        setSelectedSessionId(data.sessions[0].id);
      }
    } catch {
      setError('관리자 대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const res = await api.get(`/admin/sessions/${sessionId}/messages`);
      setSessionMessages(res.data.messages as ChatMessage[]);
    } catch {
      setSessionMessages([]);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    void loadSessionMessages(selectedSessionId);
  }, [selectedSessionId]);

  return (
    <div className="admin-shell card">
      <div className="chat-head">
        <h2>관리자 대시보드</h2>
        <button className="btn" onClick={() => void loadOverview()}>
          새로고침
        </button>
      </div>

      {loading ? <div className="typing-row">불러오는 중...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="admin-grid">
        <section className="admin-card">
          <h3>사용자</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Display</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {overview?.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.publicId.slice(0, 12)}...</td>
                    <td>{user.displayName ?? '-'}</td>
                    <td>{user.sessionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h3>세션</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Messages</th>
                  <th>Seen</th>
                </tr>
              </thead>
              <tbody>
                {overview?.sessions.map((session) => (
                  <tr key={session.id} className={session.id === selectedSessionId ? 'selected' : ''} onClick={() => setSelectedSessionId(session.id)}>
                    <td>{session.id.slice(0, 10)}...</td>
                    <td>{session.messageCount}</td>
                    <td>{new Date(session.lastSeenAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h3>세션 메시지</h3>
          <div className="admin-log">
            {sessionMessages.map((message) => (
              <div key={message.id} className={`admin-message ${message.role}`}>
                <strong>{message.role}</strong>
                <div>{message.content}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <h3>최근 선제 이벤트</h3>
          <div className="admin-log compact">
            {overview?.proactiveEvents.map((event) => (
              <div key={event.id} className="admin-event">
                <strong>{event.decision}</strong>
                <div>{event.reason}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function App() {
  const sessionId = useAppStore((s) => s.sessionId);
  const [view, setView] = useState<ViewMode>('chat');

  return (
    <main className="page">
      <div className="top-bar">
        <button className={view === 'chat' ? 'btn primary' : 'btn'} onClick={() => setView('chat')}>
          채팅
        </button>
        <button className={view === 'admin' ? 'btn primary' : 'btn'} onClick={() => setView('admin')}>
          관리자
        </button>
      </div>

      {view === 'admin' ? <AdminPanel /> : sessionId ? <ChatPanel /> : <AuthPanel />}
    </main>
  );
}
