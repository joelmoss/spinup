const vscode = require('vscode');

class ConfigWatcher {
  constructor(workspaceFolder) {
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChange = this._onDidChange.event;
    this._watchers = [];
    this._debounceTimer = undefined;

    for (const pattern of ['spinup.yml', 'spinup.json']) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, pattern)
      );
      watcher.onDidChange(() => this._handleChange());
      watcher.onDidCreate(() => this._handleChange());
      watcher.onDidDelete(() => this._handleChange());
      this._watchers.push(watcher);
    }
  }

  _handleChange() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._onDidChange.fire();
    }, 500);
  }

  dispose() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._watchers.forEach(w => w.dispose());
    this._onDidChange.dispose();
  }
}

module.exports = { ConfigWatcher };
