const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');

// Config search order:
// 1. Same folder as the exe (C:\Program Files\FieldLinkKiosk\config.json) — set by INSTALL.bat
// 2. Resources folder inside the asar package — fallback
function loadConfig() {
  const candidates = [
    path.join(path.dirname(app.getPath('exe')), 'config.json'),
    app.isPackaged
      ? path.join(process.resourcesPath, 'config.json')
      : path.join(__dirname, 'config.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {}
  }
  return null;
}

app.on('ready', () => {
  const config = loadConfig();

  const win = new BrowserWindow({
    width:  config?.width  || 1920,
    height: config?.height || 1080,
    fullscreen: true,
    kiosk: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    frame: false,
    autoHideMenuBar: true,
  });

  if (!config || !config.kioskUrl) {
    // No config found — show error page
    win.loadURL('data:text/html,<h1 style="font-family:sans-serif;color:red;padding:40px">config.json not found.<br>Please run INSTALL.bat again.</h1>');
    return;
  }

  const kioskUrl = config.kioskUrl;

  win.loadURL(kioskUrl);

  const kioskOrigin = new URL(kioskUrl).origin;
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(kioskOrigin)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Heartbeat — reload on any non-200 response (catches 502, 503, etc.)
  // A 502 loads "successfully" as far as Electron is concerned so we
  // explicitly poll to detect and recover from server-side errors.
  function startHeartbeat(intervalMs) {
    setInterval(async () => {
      try {
        const res = await fetch(kioskUrl, { cache: 'no-store' });
        if (!res.ok) {
          console.log(`[Heartbeat] Got ${res.status} — reloading...`);
          win.loadURL(kioskUrl);
        }
      } catch (e) {
        console.log('[Heartbeat] Fetch failed — reloading...', e.message);
        win.loadURL(kioskUrl);
      }
    }, intervalMs);
  }
  startHeartbeat(30000);

  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    globalShortcut.unregisterAll();
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
