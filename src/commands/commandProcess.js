const vscode = require('vscode');
const path = require('path');
const { CommandStatus } = require('../types');
const { AutoRestartPolicy } = require('./autoRestartPolicy');

class CommandProcess {
  constructor(name, config, terminalManager, workspaceRoot) {
    this.name = name;
    this._config = config;
    this._terminalManager = terminalManager;
    this._workspaceRoot = workspaceRoot;
    this._status = CommandStatus.Stopped;
    this._terminal = undefined;
    this._restartPolicy = new AutoRestartPolicy();
    this._restartTimer = undefined;
    this._manualStop = false;
    this._closeListener = undefined;
    this._onStatusChanged = new vscode.EventEmitter();
    this.onStatusChanged = this._onStatusChanged.event;
  }

  get status() {
    return this._status;
  }

  get config() {
    return this._config;
  }

  get restartCount() {
    return this._restartPolicy.attempts;
  }

  updateConfig(config) {
    this._config = config;
  }

  start() {
    if (this._status === CommandStatus.Running) {
      return;
    }

    this._manualStop = false;
    this._restartPolicy.reset();

    const cwd = this._config.cwd
      ? path.resolve(this._workspaceRoot, this._config.cwd)
      : this._workspaceRoot;

    this._terminal = this._terminalManager.getOrCreate(this.name, cwd, this._config.env);
    this._terminal.create();

    this._closeListener?.dispose();
    this._closeListener = this._terminal.onDidClose(exitCode => {
      this._handleExit(exitCode);
    });

    if (this._config.interactive) {
      this._terminal.sendText(this._config.command);
    } else {
      this._terminal.sendText(`exec ${this._config.command}`);
    }

    this._setStatus(CommandStatus.Running);
  }

  stop() {
    this._manualStop = true;
    this._clearRestartTimer();
    this._restartPolicy.reset();

    if (this._terminal) {
      this._closeListener?.dispose();
      this._closeListener = undefined;
      this._terminal.dispose();
      this._terminalManager.remove(this.name);
      this._terminal = undefined;
    }

    this._setStatus(CommandStatus.Stopped);
  }

  restart() {
    this.stop();
    this.start();
  }

  clear() {
    this._terminal?.clear();
  }

  showTerminal() {
    this._terminal?.show();
  }

  _handleExit(exitCode) {
    this._terminal = undefined;
    this._closeListener?.dispose();
    this._closeListener = undefined;

    if (this._manualStop) {
      return;
    }

    const crashed = exitCode !== undefined && exitCode !== 0;

    if (crashed && this._config.autoRestart && this._restartPolicy.canRestart) {
      this._setStatus(CommandStatus.Errored);
      const delay = this._restartPolicy.currentDelay;
      this._restartPolicy.recordRestart();

      this._restartTimer = setTimeout(() => {
        this._doRestart();
      }, delay);
    } else if (crashed) {
      this._setStatus(CommandStatus.Errored);
    } else {
      this._setStatus(CommandStatus.Stopped);
    }
  }

  _doRestart() {
    const cwd = this._config.cwd
      ? path.resolve(this._workspaceRoot, this._config.cwd)
      : this._workspaceRoot;

    this._terminal = this._terminalManager.getOrCreate(this.name, cwd, this._config.env);
    this._terminal.create();

    this._closeListener?.dispose();
    this._closeListener = this._terminal.onDidClose(exitCode => {
      this._handleExit(exitCode);
    });

    if (this._config.interactive) {
      this._terminal.sendText(this._config.command);
    } else {
      this._terminal.sendText(`exec ${this._config.command}`);
    }

    this._setStatus(CommandStatus.Running);
  }

  _clearRestartTimer() {
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = undefined;
    }
  }

  _setStatus(status) {
    if (this._status !== status) {
      this._status = status;
      this._onStatusChanged.fire(status);
    }
  }

  dispose() {
    this._clearRestartTimer();
    this._closeListener?.dispose();
    if (this._terminal) {
      this._terminal.dispose();
      this._terminalManager.remove(this.name);
    }
    this._onStatusChanged.dispose();
  }
}

module.exports = { CommandProcess };
