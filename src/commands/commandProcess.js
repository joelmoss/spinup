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
    this._closeListener = undefined;
    this._shellExecListener = undefined;
    this._restartPolicy = new AutoRestartPolicy();
    this._restartTimer = undefined;
    this._manualStop = false;
    this._metrics = null;
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

  get metrics() {
    return this._metrics;
  }

  set metrics(value) {
    this._metrics = value;
  }

  get processId() {
    return this._terminal?.processId;
  }

  updateConfig(config) {
    this._config = config;
  }

  async start() {
    if (this._status === CommandStatus.Running) {
      return;
    }

    this._manualStop = false;
    this._restartPolicy.reset();
    await this._createAndRun();
    this._setStatus(CommandStatus.Running);
  }

  stop() {
    this._manualStop = true;
    this._clearRestartTimer();
    this._restartPolicy.reset();

    if (this._terminal) {
      this._closeListener?.dispose();
      this._closeListener = undefined;
      this._shellExecListener?.dispose();
      this._shellExecListener = undefined;
      this._terminal.dispose();
      this._terminalManager.remove(this.name);
      this._terminal = undefined;
    }

    this._setStatus(CommandStatus.Stopped);
  }

  async restart() {
    this.stop();
    await this.start();
  }

  clear() {
    this._terminal?.clear();
  }

  showTerminal() {
    this._terminal?.show();
  }

  async _createAndRun() {
    const cwd = this._config.cwd
      ? path.resolve(this._workspaceRoot, this._config.cwd)
      : this._workspaceRoot;

    const { terminal, splitFrom } = this._terminalManager.getOrCreate(this.name, cwd, this._config.env);
    this._terminal = terminal;
    await this._terminal.create(splitFrom);

    this._closeListener?.dispose();
    this._closeListener = this._terminal.onDidClose(exitCode => {
      this._handleExit(exitCode);
    });

    // Listen for shell integration command completion to detect errors
    // when the terminal stays open (non-interactive only).
    this._shellExecListener?.dispose();
    this._shellExecListener = undefined;
    if (!this._config.interactive) {
      this._shellExecListener = vscode.window.onDidEndTerminalShellExecution(event => {
        if (event.terminal === this._terminal?.terminal && event.exitCode !== 0) {
          this._handleExit(event.exitCode);
        }
      });
    }

    const cmd = this._config.command;
    // Non-interactive commands: keep shell open on failure so error output is visible.
    // On success, exit the shell so onDidCloseTerminal fires.
    const wrapped = this._config.interactive
      ? cmd
      : `${cmd}; __e=$?; if [ $__e -ne 0 ]; then echo "\\n\\033[31mProcess exited with code $__e\\033[0m"; else exit 0; fi`;

    if (splitFrom) {
      // Split terminals inherit the parent's shell — set up env, cwd, then run.
      const parts = [`printf '\\033]0;Spinup: ${this.name}\\007'`];
      if (this._config.env) {
        for (const [key, value] of Object.entries(this._config.env)) {
          parts.push(`export ${key}=${this._shellEscape(value)}`);
        }
      }
      parts.push(`cd ${this._shellEscape(cwd)}`, 'clear');
      parts.push(wrapped);
      this._terminal.sendText(parts.join(' && '));
    } else {
      this._terminal.sendText(wrapped);
    }
  }

  _shellEscape(str) {
    return `'${String(str).replace(/'/g, "'\\''")}'`;
  }

  _handleExit(exitCode) {
    if (this._manualStop || this._status === CommandStatus.Errored) {
      return;
    }

    this._shellExecListener?.dispose();
    this._shellExecListener = undefined;

    const crashed = exitCode !== undefined && exitCode !== 0;

    if (crashed) {
      // Keep terminal open so error output is visible
      this._terminal?.show();
      // Re-attach close listener so we can clean up if the user closes the terminal
      this._closeListener?.dispose();
      this._closeListener = this._terminal?.onDidClose(() => {
        this._terminal = undefined;
        this._closeListener?.dispose();
        this._closeListener = undefined;
        this._setStatus(CommandStatus.Stopped);
      });
      if (this._config.autoRestart && this._restartPolicy.canRestart) {
        this._setStatus(CommandStatus.Errored);
        const delay = this._restartPolicy.currentDelay;
        this._restartPolicy.recordRestart();

        this._restartTimer = setTimeout(() => {
          this._doRestart();
        }, delay);
      } else {
        this._setStatus(CommandStatus.Errored);
      }
    } else {
      this._terminal = undefined;
      this._closeListener?.dispose();
      this._closeListener = undefined;
      this._setStatus(CommandStatus.Stopped);
    }
  }

  async _doRestart() {
    this._setStatus(CommandStatus.Running);
    await this._createAndRun();
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
    this._shellExecListener?.dispose();
    if (this._terminal) {
      this._terminal.dispose();
      this._terminalManager.remove(this.name);
    }
    this._onStatusChanged.dispose();
  }
}

module.exports = { CommandProcess };
