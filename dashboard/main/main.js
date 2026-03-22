const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DashboardServer } = require('./wsServer');
const { ProjectRegistry } = require('./projectRegistry');
const { NotificationManager } = require('./notifications');

const PREFERRED_PORT = 19500;
const PREFERRED_HOOK_PORT = 19501;
const SERVER_INFO_DIR = path.join(os.homedir(), '.spinup');
const SERVER_INFO_PATH = path.join(SERVER_INFO_DIR, 'server.json');
let windowStatePath = null;

let mainWindow = null;
let tray = null;
let isQuitting = false;

const registry = new ProjectRegistry();
const server = new DashboardServer(registry, PREFERRED_PORT);
const notifications = new NotificationManager({
  send: (n) => {
    if (Notification.isSupported()) {
      const notification = new Notification({ title: n.title, body: n.body });
      notification.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
        server.sendCommand(n.windowId, { type: 'window:focus' });
      });
      notification.show();
    }
  },
});

registry.onChange(() => {
  for (const project of registry.getProjects()) {
    for (const agent of project.state.agents) {
      notifications.notify(project.window.name, project.windowId, agent, 'agent');
    }
    for (const proc of project.state.processes) {
      notifications.notify(project.window.name, project.windowId, proc, 'process');
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('registry-update', registry.getProjects());
  }
});

function getWindowStatePath() {
  if (!windowStatePath) {
    windowStatePath = path.join(app.getPath('userData'), 'window.json');
  }
  return windowStatePath;
}

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf8'));
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const dir = path.dirname(getWindowStatePath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getWindowStatePath(), JSON.stringify(bounds));
}

function createWindow() {
  const saved = loadWindowState();

  mainWindow = new BrowserWindow({
    width: saved?.width ?? 480,
    height: saved?.height ?? 700,
    x: saved?.x,
    y: saved?.y,
    title: 'Spinup',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      saveWindowState();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAgklEQVQ4T2NkoBAwUqifgWoGMDIyNjAyMv5HdwUTA8P/BgYGxv+MDAxILmBkYGxgYPj/H90FjIwMDYwMDP+RXcDI+L+BkZHhP1IXMDL8b2Bk+P8fOQwYGf43MDIw/Ed2ASMD438GBob/6GHAyPi/gYHhP3IYMDIwNDAw/P+PHAYAlWk0EXZQOREAAAAASUVORK5CYII=');
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Spinup');
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Dashboard', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { mainWindow?.destroy(); app.quit(); } },
  ]));
}

function writeServerInfo(port, hookPort) {
  fs.mkdirSync(SERVER_INFO_DIR, { recursive: true });
  fs.writeFileSync(SERVER_INFO_PATH, JSON.stringify({ port, hookPort, pid: process.pid }));
}

function cleanupServerInfo() {
  try { fs.unlinkSync(SERVER_INFO_PATH); } catch { /* ignore */ }
}

let hookServer = null;

function startHookListener() {
  return new Promise((resolve) => {
    hookServer = http.createServer((req, res) => {
      if (req.url !== '/agent-event' || req.method !== 'POST') {
        res.writeHead(req.method !== 'POST' && req.url === '/agent-event' ? 405 : 404);
        res.end();
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) { req.destroy(); }
      });
      req.on('end', () => {
        try {
          const event = JSON.parse(body);
          registry.handleAgentEvent(event);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        } catch {
          res.writeHead(400);
          res.end('{"error":"invalid json"}');
        }
      });
    });

    hookServer.listen(PREFERRED_HOOK_PORT, '127.0.0.1', () => {
      resolve(hookServer.address().port);
    });

    hookServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Preferred port busy — use any available port
        hookServer.listen(0, '127.0.0.1', () => {
          resolve(hookServer.address().port);
        });
      }
    });
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(path.join(__dirname, '../resources/icon.png'));
    app.dock.setIcon(dockIcon);
  }
  const actualPort = await server.start();
  const actualHookPort = await startHookListener();
  writeServerInfo(actualPort, actualHookPort);
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
  cleanupServerInfo();
  if (hookServer) hookServer.close();
  server.stop();
});

app.on('window-all-closed', () => {
  // Don't quit — stay in tray
});

// IPC handler for renderer → main process commands
ipcMain.on('send-command', (_event, windowId, command) => {
  server.sendCommand(windowId, command);
});

ipcMain.on('focus-vscode', (_event, projectPath) => {
  const { exec } = require('child_process');
  // Open the folder in VS Code — this brings the existing window to front
  exec(`/usr/bin/open -a "Visual Studio Code" ${JSON.stringify(projectPath)}`);
});
