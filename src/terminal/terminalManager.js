const { SpinupTerminal } = require('./spinupTerminal');

class TerminalManager {
  constructor() {
    this._terminals = new Map();
    this._groupParent = undefined;
  }

  _findGroupParentVscodeTerminal() {
    if (this._groupParent?.isOpen) {
      return this._groupParent.terminal;
    }
    for (const terminal of this._terminals.values()) {
      if (terminal.isOpen) {
        this._groupParent = terminal;
        return terminal.terminal;
      }
    }
    this._groupParent = undefined;
    return undefined;
  }

  getOrCreate(name, cwd, env) {
    let terminal = this._terminals.get(name);
    if (terminal && terminal.isOpen) {
      return { terminal, splitFrom: undefined };
    }

    if (terminal) {
      terminal.dispose();
    }

    const splitFrom = this._findGroupParentVscodeTerminal();
    terminal = new SpinupTerminal(name, cwd, env);
    this._terminals.set(name, terminal);

    if (!this._groupParent) {
      this._groupParent = terminal;
    }

    return { terminal, splitFrom };
  }

  get(name) {
    return this._terminals.get(name);
  }

  remove(name) {
    const terminal = this._terminals.get(name);
    if (terminal) {
      terminal.dispose();
      this._terminals.delete(name);
      if (this._groupParent === terminal) {
        this._groupParent = undefined;
      }
    }
  }

  disposeAll() {
    for (const terminal of this._terminals.values()) {
      terminal.dispose();
    }
    this._terminals.clear();
    this._groupParent = undefined;
  }

  dispose() {
    this.disposeAll();
  }
}

module.exports = { TerminalManager };
