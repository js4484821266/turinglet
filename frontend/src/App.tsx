import { AdminPanel } from './components/AdminPanel';
import { AuthPanel } from './components/AuthPanel';
import { ChatPanel } from './components/ChatPanel';
import { useAppStore } from './store';

// App stays deliberately small now: it only chooses the top-level surface.
// The heavy QR, chat, and admin workflows live in focused component files.
export function App() {
  const sessionId = useAppStore((s) => s.sessionId);
  const isAdminPath = window.location.pathname.replace(/\/+$/, '') === '/achrai';

  return (
    <main className="page">
      {isAdminPath ? <AdminPanel /> : sessionId ? <ChatPanel /> : <AuthPanel />}
    </main>
  );
}
