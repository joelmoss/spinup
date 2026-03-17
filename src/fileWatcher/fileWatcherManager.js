const vscode = require('vscode');

class FileWatcherManager {
  constructor(commandManager, workspaceFolder) {
    this._commandManager = commandManager;
    this._workspaceFolder = workspaceFolder;
    this._watchers = new Map();
    this._debounceTimers = new Map();
  }

  setup(config) {
    this._disposeAll();

    for (const [name, cmdConfig] of Object.entries(config.commands)) {
      if (!cmdConfig.watch?.length) {
        continue;
      }

      const commandWatchers = [];

      for (const pattern of cmdConfig.watch) {
        const watcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(this._workspaceFolder, pattern)
        );

        const handler = () => this._handleFileChange(name);
        watcher.onDidChange(handler);
        watcher.onDidCreate(handler);
        watcher.onDidDelete(handler);
        commandWatchers.push(watcher);
      }

      this._watchers.set(name, commandWatchers);
    }
  }

  _handleFileChange(commandName) {
    const existing = this._debounceTimers.get(commandName);
    if (existing) {
      clearTimeout(existing);
    }

    this._debounceTimers.set(commandName, setTimeout(() => {
      this._debounceTimers.delete(commandName);
      const states = this._commandManager.getStates();
      const state = states.find(s => s.name === commandName);
      if (state?.status === 'running') {
        this._commandManager.restart(commandName);
      }
    }, 1000));
  }

  _disposeAll() {
    for (const timerId of this._debounceTimers.values()) {
      clearTimeout(timerId);
    }
    this._debounceTimers.clear();

    for (const commandWatchers of this._watchers.values()) {
      commandWatchers.forEach(w => w.dispose());
    }
    this._watchers.clear();
  }

  dispose() {
    this._disposeAll();
  }
}

module.exports = { FileWatcherManager };
