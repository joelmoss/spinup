const vscode = require('vscode');
const { CommandStatus } = require('../types');

class CommandTreeItem extends vscode.TreeItem {
  constructor(state) {
    super(state.name, vscode.TreeItemCollapsibleState.None);
    this.state = state;

    this.contextValue = state.status;
    this.description = this._getDescription();
    this.iconPath = this._getIcon();
    this.tooltip = this._getTooltip();

    if (state.status === CommandStatus.Running) {
      this.command = {
        command: 'spinup.openTerminal',
        title: 'Show Terminal',
        arguments: [this],
      };
    }
  }

  _getDescription() {
    switch (this.state.status) {
      case CommandStatus.Running:
        return 'running';
      case CommandStatus.Errored:
        return this.state.restartCount > 0
          ? `errored (restart ${this.state.restartCount})`
          : 'errored';
      case CommandStatus.Stopped:
        return 'stopped';
    }
  }

  _getIcon() {
    switch (this.state.status) {
      case CommandStatus.Running:
        return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'));
      case CommandStatus.Errored:
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
      case CommandStatus.Stopped:
        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
    }
  }

  _getTooltip() {
    const lines = [
      `${this.state.name} — ${this.state.status}`,
      `Command: ${this.state.config.command}`,
    ];
    if (this.state.config.cwd) {
      lines.push(`CWD: ${this.state.config.cwd}`);
    }
    if (this.state.config.autoRestart) {
      lines.push('Auto-restart: enabled');
    }
    if (this.state.config.watch?.length) {
      lines.push(`Watching: ${this.state.config.watch.join(', ')}`);
    }
    return lines.join('\n');
  }
}

module.exports = { CommandTreeItem };
