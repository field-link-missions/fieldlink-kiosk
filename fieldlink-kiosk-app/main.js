const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');

// Load config from same directory as the exe (works both in dev and packaged)
const configPath = app.isPackaged
  ? path.join(process.resourcesPath, 'config.json')
  : path.join(__dirname, 'config.json');

let config = { kioskUrl: 'https://fieldlinkmissions.com', width: 1920, height: 1080 };
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('Could not load config.json:', e.message);
}

app.on('ready', () => {
  const win = new BrowserWindow({
    width:  config.width  || 1920,
    height: config.height || 1080,
    fullscreen: true,
    kiosk: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    frame: false,
    autoHideMenuBar: true,
  });

  win.loadURL(config.kioskUrl);

  const kioskOrigin = new URL(config.kioskUrl).origin;
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(kioskOrigin)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    globalShortcut.unregisterAll();
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
