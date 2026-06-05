import { useEffect, useState } from 'react';
import { api, type AdminProactiveEventRow, type AdminSessionRow, type AdminUserRow, type ChatMessage } from '../api';

interface AdminOverview {
  users: AdminUserRow[];
  sessions: AdminSessionRow[];
  proactiveEvents: AdminProactiveEventRow[];
}

// The admin panel is a local observability surface for the prototype. It shows
// whether sessions, messages, and proactive outreach records are being created.
export function AdminPanel() {
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
      if (!selectedSessionId && data.sessions[0]) setSelectedSessionId(data.sessions[0].id);
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
