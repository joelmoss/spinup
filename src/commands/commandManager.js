const vscode = require('vscode');
const { CommandStatus } = require('../types');
const { CommandProcess } = require('./commandProcess');

class CommandManager {
  constructor(terminalManager, workspaceRoot) {
    this._terminalManager = terminalManager;
    this._workspaceRoot = workspaceRoot;
    this._processes = new Map();
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChange = this._onDidChange.event;
  }

  async initialize(config) {
    for (const [name, cmdConfig] of Object.entries(config.commands)) {
      const process = new CommandProcess(name, cmdConfig, this._terminalManager, this._workspaceRoot);
      process.onStatusChanged(() => this._onDidChange.fire());
      this._processes.set(name, process);
    }

    for (const [name, cmdConfig] of Object.entries(config.commands)) {
      if (cmdConfig.autostart) {
        this._processes.get(name).start();
      }
    }

    this._onDidChange.fire();
  }

  reconcile(newConfig) {
    const newNames = new Set(Object.keys(newConfig.commands));
    const oldNames = new Set(this._processes.keys());

    for (const name of oldNames) {
      if (!newNames.has(name)) {
        const process = this._processes.get(name);
        process.stop();
        process.dispose();
        this._processes.delete(name);
      }
    }

    for (const [name, cmdConfig] of Object.entries(newConfig.commands)) {
      if (!oldNames.has(name)) {
        const process = new CommandProcess(name, cmdConfig, this._terminalManager, this._workspaceRoot);
        process.onStatusChanged(() => this._onDidChange.fire());
        this._processes.set(name, process);
        if (cmdConfig.autostart) {
          process.start();
        }
      } else {
        this._processes.get(name).updateConfig(cmdConfig);
      }
    }

    this._onDidChange.fire();
  }

  getStates() {
    const states = [];
    for (const [name, process] of this._processes) {
      states.push({
        name,
        config: process.config,
        status: process.status,
        restartCount: process.restartCount,
      });
    }
    const order = { [CommandStatus.Running]: 0, [CommandStatus.Errored]: 1, [CommandStatus.Stopped]: 2 };
    states.sort((a, b) => order[a.status] - order[b.status]);
    return states;
  }

  startAll() {
    for (const process of this._processes.values()) {
      if (process.status !== CommandStatus.Running) {
        process.start();
      }
    }
  }

  stopAll() {
    for (const process of this._processes.values()) {
      process.stop();
    }
  }

  restartAll() {
    for (const process of this._processes.values()) {
      process.restart();
    }
  }

  start(name) {
    this._processes.get(name)?.start();
  }

  stop(name) {
    this._processes.get(name)?.stop();
  }

  restart(name) {
    this._processes.get(name)?.restart();
  }

  clear(name) {
    this._processes.get(name)?.clear();
  }

  showTerminal(name) {
    this._processes.get(name)?.showTerminal();
  }

  get runningCount() {
    let count = 0;
    for (const process of this._processes.values()) {
      if (process.status === CommandStatus.Running) {
        count++;
      }
    }
    return count;
  }

  get totalCount() {
    return this._processes.size;
  }

  dispose() {
    for (const process of this._processes.values()) {
      process.stop();
      process.dispose();
    }
    this._processes.clear();
    this._onDidChange.dispose();
  }
}

module.exports = { CommandManager };
