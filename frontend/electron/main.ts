import { app, BrowserWindow } from 'electron';

const startUrl = process.env.ELECTRON_START_URL ?? 'http://localhost:5173';

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      contextIsolation: true
    },
    title: 'Turinglet Prototype'
  });

  let retries = 0;
  while (retries < 30) {
    try {
      await win.loadURL(startUrl);
      break;
    } catch {
      retries += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
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
