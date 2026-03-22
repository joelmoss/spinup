'use strict';

const vscode = require('vscode');

class CommandHandler {
  // Note: processId and terminalId in protocol messages correspond to the command name
  // (e.g., "Server"), since StateReporter uses s.name as the id field.
  constructor(commandManager, windowActions = {}) {
    this._commandManager = commandManager;
    this._windowActions = windowActions;
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
        this._commandManager.showTerminal(msg.terminalId);
        break;
      case 'window:focus':
        if (this._windowActions.focusWindow) {
          this._windowActions.focusWindow();
        } else {
          vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }
        break;
    }
  }
}

module.exports = { CommandHandler };
