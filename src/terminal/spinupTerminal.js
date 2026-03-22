const vscode = require('vscode');

class SpinupTerminal {
  constructor(name, cwd, env) {
    this.name = name;
    this._cwd = cwd;
    this._env = env;
    this._terminal = undefined;
    this._onDidClose = new vscode.EventEmitter();
    this.onDidClose = this._onDidClose.event;
    this._onDidShellExecEnd = new vscode.EventEmitter();
    this.onDidShellExecEnd = this._onDidShellExecEnd.event;
    this._closeListener = undefined;
    this._shellExecListener = undefined;
  }

  get isOpen() {
    return this._terminal !== undefined;
  }

  get terminal() {
    return this._terminal;
  }

  get processId() {
    return this._terminal?.processId;
  }

  async create(splitFrom) {
    if (this._terminal) {
      return;
    }

    if (splitFrom) {
      splitFrom.show(false);
      await new Promise(r => setTimeout(r, 100));

      const opened = new Promise(resolve => {
        const listener = vscode.window.onDidOpenTerminal(t => {
          listener.dispose();
          resolve(t);
        });
      });
      await vscode.commands.executeCommand('workbench.action.terminal.split');
      this._terminal = await opened;
    } else {
      this._terminal = vscode.window.createTerminal({
        name: `Spinup: ${this.name}`,
        cwd: this._cwd,
        env: this._env,
      });
    }

    this._closeListener = vscode.window.onDidCloseTerminal(t => {
      if (t === this._terminal) {
        const exitStatus = t.exitStatus;
        this._terminal = undefined;
        this._closeListener?.dispose();
        this._closeListener = undefined;
        this._shellExecListener?.dispose();
        this._shellExecListener = undefined;
        this._onDidClose.fire(exitStatus?.code);
      }
    });

    this._shellExecListener = vscode.window.onDidEndTerminalShellExecution(event => {
      if (event.terminal === this._terminal) {
        this._onDidShellExecEnd.fire(event.exitCode);
      }
    });
  }

  async sendText(text) {
    if (!this._terminal) {
      await this.create();
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
    this._shellExecListener?.dispose();
    this._terminal?.dispose();
    this._terminal = undefined;
    this._onDidClose.dispose();
    this._onDidShellExecEnd.dispose();
  }
}

module.exports = { SpinupTerminal };
