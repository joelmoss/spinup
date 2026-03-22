'use strict';

const vscode = require('vscode');

class CommandHandler {
  // Note: processId and terminalId in protocol messages correspond to the command name
  // (e.g., "Server"), since StateReporter uses s.name as the id field.
  constructor(commandManager) {
    this._commandManager = commandManager;
  }

  handle(msg) {
    switch (msg.type) {
      case 'command:start':
        this._commandManager.start(msg.processId);
        break;
      case 'command:stop':
        this._commandManager.stop(msg.processId);
        break;
      case 'command:restart':
        this._commandManager.restart(msg.processId);
        break;
      case 'terminal:focus':
        this._focusTerminal(msg.terminalId, msg.agentPid);
        break;
      case 'window:focus': {
        const activeTerminal = vscode.window.activeTerminal;
        if (activeTerminal) {
          activeTerminal.show(true);
        }
        vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        break;
      }
    }
  }

  async _focusTerminal(terminalId, agentPid) {
    if (terminalId.startsWith('term-')) {
      const termName = terminalId.slice(5);
      const terminal = vscode.window.terminals.find((t) => t.name === termName);
      if (terminal) terminal.show(false);
      return;
    }

    // Agent terminal — find the terminal whose shell is an ancestor of the agent PID
    if (agentPid) {
      const pid = parseInt(agentPid, 10);
      for (const terminal of vscode.window.terminals) {
        const shellPid = await terminal.processId;
        if (shellPid && await this._isAncestor(shellPid, pid)) {
          terminal.show(false);
          return;
        }
      }
    }

    // Fallback: try as a Spinup-managed process
    this._commandManager.showTerminal(terminalId);
  }

  _isAncestor(ancestorPid, descendantPid) {
    const { execSync } = require('child_process');
    try {
      // Walk up the process tree from descendant looking for ancestor
      let pid = descendantPid;
      for (let i = 0; i < 10; i++) {
        const ppid = parseInt(execSync(`ps -o ppid= -p ${pid}`, { encoding: 'utf8' }).trim(), 10);
        if (ppid === ancestorPid) return true;
        if (ppid <= 1) return false;
        pid = ppid;
      }
    } catch { /* process gone */ }
    return false;
  }
}

module.exports = { CommandHandler };
