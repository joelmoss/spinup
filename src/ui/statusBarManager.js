const vscode = require('vscode');

class StatusBarManager {
  constructor(commandManager) {
    this._commandManager = commandManager;
    this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this._statusBarItem.command = 'spinupCommands.focus';
    commandManager.onDidChange(() => this._update());
    this._update();
    this._statusBarItem.show();
  }

  _update() {
    const running = this._commandManager.runningCount;
    const total = this._commandManager.totalCount;
    this._statusBarItem.text = `$(terminal) Spinup: ${running}/${total} running`;
    this._statusBarItem.tooltip = 'Click to show Spinup sidebar';
  }

  dispose() {
    this._statusBarItem.dispose();
  }
}

module.exports = { StatusBarManager };
