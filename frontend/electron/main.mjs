/**
 * package script가 직접 실행하는 Electron 진입점이다.
 * Vite 준비를 기다리되 최종 실패를 조용히 숨기지 않고 오류를 기록한다.
 */

import { app, BrowserWindow } from 'electron';

const startUrl = process.env.ELECTRON_START_URL ?? 'http://localhost:5173';

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      contextIsolation: true
    },
    title: '삼마고 | Saammaago'
  });

  let retries = 0;
  let lastLoadError;
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
