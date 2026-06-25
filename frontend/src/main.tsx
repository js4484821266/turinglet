/**
 * React 애플리케이션을 브라우저 DOM에 마운트하는 프론트엔드 진입점이다.
 * root 요소가 없으면 렌더링이 실패하므로 index.html 계약과 함께 변경해야 한다.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
