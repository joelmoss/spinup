const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  onRegistryUpdate: (callback) => ipcRenderer.on('registry-update', (_event, projects) => callback(projects)),
  sendCommand: (windowId, command) => ipcRenderer.send('send-command', windowId, command),
  focusVSCode: (projectPath) => ipcRenderer.send('focus-vscode', projectPath),
});
