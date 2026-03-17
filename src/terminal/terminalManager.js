const { SpinupTerminal } = require('./spinupTerminal');

class TerminalManager {
  constructor() {
    this._terminals = new Map();
  }

  getOrCreate(name, cwd, env) {
    let terminal = this._terminals.get(name);
    if (terminal && terminal.isOpen) {
      return terminal;
    }

    if (terminal) {
      terminal.dispose();
    }

    terminal = new SpinupTerminal(name, cwd, env);
    this._terminals.set(name, terminal);
    return terminal;
  }

  get(name) {
    return this._terminals.get(name);
  }

  remove(name) {
    const terminal = this._terminals.get(name);
    if (terminal) {
      terminal.dispose();
      this._terminals.delete(name);
    }
  }

  disposeAll() {
    for (const terminal of this._terminals.values()) {
      terminal.dispose();
    }
    this._terminals.clear();
  }

  dispose() {
    this.disposeAll();
  }
}

module.exports = { TerminalManager };
