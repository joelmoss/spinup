const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DashboardServer } = require('./wsServer');
const { ProjectRegistry } = require('./projectRegistry');
const { NotificationManager } = require('./notifications');

const PORT = 9500;
const SERVER_INFO_DIR = path.join(os.homedir(), '.spinup-dashboard');
const SERVER_INFO_PATH = path.join(SERVER_INFO_DIR, 'server.json');

let mainWindow = null;
let tray = null;

const registry = new ProjectRegistry();
const server = new DashboardServer(registry, PORT);
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

  if (mainWindow) {
    mainWindow.webContents.send('registry-update', registry.getProjects());
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    title: 'Spinup Dashboard',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAgklEQVQ4T2NkoBAwUqifgWoGMDIyNjAyMv5HdwUTA8P/BgYGxv+MDAxILmBkYGxgYPj/H90FjIwMDYwMDP+RXcDI+L+BkZHhP1IXMDL8b2Bk+P8fOQwYGf43MDIw/Ed2ASMD438GBob/6GHAyPi/gYHhP3IYMDIwNDAw/P+PHAYAlWk0EXZQOREAAAAASUVORK5CYII=');
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Spinup Dashboard');
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

function writeServerInfo(port) {
  fs.mkdirSync(SERVER_INFO_DIR, { recursive: true });
  fs.writeFileSync(SERVER_INFO_PATH, JSON.stringify({ port, pid: process.pid }));
}

function cleanupServerInfo() {
  try { fs.unlinkSync(SERVER_INFO_PATH); } catch {}
}

app.whenReady().then(async () => {
  const actualPort = await server.start();
  writeServerInfo(actualPort);
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  cleanupServerInfo();
  server.stop();
});

app.on('window-all-closed', (e) => {
  // Don't quit — stay in tray
});

// IPC handler for renderer → main process commands
ipcMain.on('send-command', (_event, windowId, command) => {
  server.sendCommand(windowId, command);
});
