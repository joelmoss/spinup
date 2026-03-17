const vscode = require('vscode');

class SpinupTerminal {
  constructor(name, cwd, env) {
    this.name = name;
    this._cwd = cwd;
    this._env = env;
    this._terminal = undefined;
    this._onDidClose = new vscode.EventEmitter();
    this.onDidClose = this._onDidClose.event;
    this._closeListener = undefined;
  }

  get isOpen() {
    return this._terminal !== undefined;
  }

  create() {
    if (this._terminal) {
      return;
    }

    this._terminal = vscode.window.createTerminal({
      name: `Spinup: ${this.name}`,
      cwd: this._cwd,
      env: this._env,
    });

    this._closeListener = vscode.window.onDidCloseTerminal(t => {
      if (t === this._terminal) {
        const exitStatus = t.exitStatus;
        this._terminal = undefined;
        this._closeListener?.dispose();
        this._closeListener = undefined;
        this._onDidClose.fire(exitStatus?.code);
      }
    });
  }

  sendText(text) {
    if (!this._terminal) {
      this.create();
    }
    this._terminal.sendText(text);
  }

  show() {
    this._terminal?.show(true);
  }

  clear() {
    if (this._terminal) {
      vscode.commands.executeCommand('workbench.action.terminal.clear', this._terminal);
    }
  }

  dispose() {
    this._closeListener?.dispose();
    this._terminal?.dispose();
    this._terminal = undefined;
    this._onDidClose.dispose();
  }
}

module.exports = { SpinupTerminal };
