/**
 * 개발용 Vite 화면을 Electron 창으로 열고 서버 준비 지연을 제한적으로 재시도한다.
 * 모든 재시도가 실패하면 창을 강제 종료하지 않고 마지막 loadURL 오류를 기록한다.
 */

import { app, BrowserWindow } from 'electron';

const startUrl = process.env.ELECTRON_START_URL ?? 'http://localhost:5173';

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      contextIsolation: true
    },
    title: '삼마고 | Saammaago'
  });

  let retries = 0;
  let lastLoadError: unknown;
  while (retries < 30) {
    try {
      await win.loadURL(startUrl);
      return;
    } catch (error) {
      lastLoadError = error;
      retries += 1;
      if (retries < 30) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  console.error(`Electron could not load ${startUrl} after ${retries} attempts.`, lastLoadError);
}

app.whenReady().then(() => {
  void createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
