import { useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AuthPanel } from './components/AuthPanel';
import { ChatPanel } from './components/ChatPanel';
import { useAppStore } from './store';

type ViewMode = 'chat' | 'admin';

// App stays deliberately small now: it only chooses the top-level surface.
// The heavy QR, chat, and admin workflows live in focused component files.
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
