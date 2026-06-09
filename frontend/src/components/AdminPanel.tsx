import { useEffect, useState } from 'react';
import { api, type AdminProactiveEventRow, type AdminSessionRow, type AdminUserRow, type ChatMessage } from '../api';

const ADMIN_TOKEN_STORAGE_KEY = 'achraiAdminToken';

interface AdminOverview {
  users: AdminUserRow[];
  sessions: AdminSessionRow[];
  proactiveEvents: AdminProactiveEventRow[];
}

function adminAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// The admin panel is a local observability surface for the prototype. It shows
// whether sessions, messages, and proactive outreach records are being created.
export function AdminPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '');
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [overview, setOverview] = useState<AdminOverview | undefined>();
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const clearAdminSession = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken('');
    setOverview(undefined);
    setSelectedSessionId(undefined);
    setSessionMessages([]);
  };

  const handleAuthError = () => {
    clearAdminSession();
    setError('관리자 로그인이 필요합니다.');
  };

  const login = async () => {
    setLoginLoading(true);
    setError(undefined);
    try {
      const passwordSha256 = await sha256Hex(adminPassword);
      const res = await api.post('/admin/login', { id: adminId, passwordSha256 });
      const nextToken = typeof res.data?.token === 'string' ? res.data.token : '';
      if (!nextToken) throw new Error('Admin token was not returned.');
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, nextToken);
      setToken(nextToken);
      setAdminPassword('');
    } catch {
      setError('관리자 ID 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  const loadOverview = async () => {
    if (!token) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.get('/admin/overview', { headers: adminAuthHeaders(token) });
      const data = res.data as AdminOverview;
      setOverview(data);
      if (!selectedSessionId && data.sessions[0]) setSelectedSessionId(data.sessions[0].id);
    } catch (err) {
      const status = typeof err === 'object' && err !== null && 'response' in err ? (err.response as { status?: number }).status : undefined;
      if (status === 401 || status === 403) {
        handleAuthError();
        return;
      }
      setError('관리자 대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await api.get(`/admin/sessions/${sessionId}/messages`, { headers: adminAuthHeaders(token) });
      setSessionMessages(res.data.messages as ChatMessage[]);
    } catch (err) {
      const status = typeof err === 'object' && err !== null && 'response' in err ? (err.response as { status?: number }).status : undefined;
      if (status === 401 || status === 403) handleAuthError();
      setSessionMessages([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadOverview();
  }, [token]);

  useEffect(() => {
    if (!selectedSessionId) return;
    void loadSessionMessages(selectedSessionId);
  }, [selectedSessionId]);

  if (!token) {
    return (
      <div className="admin-shell card">
        <form
          className="admin-login"
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          <h2>관리자 로그인</h2>
          <label>
            ID
            <input value={adminId} onChange={(event) => setAdminId(event.target.value)} autoComplete="username" />
          </label>
          <label>
            비밀번호
            <input
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button className="btn primary" type="submit" disabled={loginLoading || !adminId || !adminPassword}>
            {loginLoading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell card">
      <div className="chat-head">
        <h2>관리자 대시보드</h2>
        <div className="admin-actions">
          <button className="btn" onClick={() => void loadOverview()}>
            새로고침
          </button>
          <button className="btn" onClick={clearAdminSession}>
            로그아웃
          </button>
        </div>
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
                  <tr
                    key={session.id}
                    className={session.id === selectedSessionId ? 'selected' : ''}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
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
