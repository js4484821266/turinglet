/**
 * URL과 인증 상태에 따라 관리자·인증·채팅 화면을 선택한다.
 * 실제 네트워크와 입력 수명주기는 각 하위 컴포넌트가 담당한다.
 */

import { AdminPanel } from './components/AdminPanel';
import { AuthPanel } from './components/AuthPanel';
import { ChatPanel } from './components/ChatPanel';
import { useAppStore } from './store';

// App stays deliberately small now: it only chooses the top-level surface.
// The heavy QR, chat, and admin workflows live in focused component files.
/** URL과 인증 상태에 따라 관리자, 인증, 대화 화면을 선택하는 최상위 컴포넌트다. */
export function App() {
  const sessionId = useAppStore((s) => s.sessionId);
  const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/achrai';

  return (
    <main className="page">
      <header className="brand-head">
        <h1>삼마고</h1>
        <span>Saammaago</span>
      </header>
      {isAdminPath ? <AdminPanel /> : sessionId ? <ChatPanel /> : <AuthPanel />}
    </main>
  );
}
