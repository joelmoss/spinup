const vscode = require('vscode');

class StateReporter {
  constructor(windowId, commandManager) {
    this._windowId = windowId;
    this._commandManager = commandManager;

    this._onStateChanged = new vscode.EventEmitter();
    this.onStateChanged = this._onStateChanged.event;

    this._subscription = this._commandManager.onDidChange(() => {
      this._onStateChanged.fire();
    });
  }

  getFullState() {
    const processes = this._commandManager.getStates().map((s) => ({
      id: s.name,
      name: s.name,
      command: s.config.command,
      status: s.status,
      restartCount: s.restartCount,
      maxRestarts: 5,
      metrics: s.metrics ?? null,
    }));

    return {
      type: 'state:full',
      windowId: this._windowId,
      terminals: [],
      agents: [],
      processes,
    };
  }

  computeDelta(previousState) {
    const currentState = this.getFullState();
    const changes = {
      terminals: { added: [], removed: [], updated: [] },
      processes: { added: [], removed: [], updated: [] },
    };
    let hasChanges = false;

    for (const category of ['processes', 'terminals']) {
      const oldItems = new Map((previousState[category] ?? []).map((i) => [i.id, i]));
      const newItems = new Map((currentState[category] ?? []).map((i) => [i.id, i]));

      for (const [id, item] of newItems) {
        if (!oldItems.has(id)) {
          changes[category].added.push(item);
          hasChanges = true;
        } else if (JSON.stringify(item) !== JSON.stringify(oldItems.get(id))) {
          changes[category].updated.push(item);
          hasChanges = true;
        }
      }

      for (const id of oldItems.keys()) {
        if (!newItems.has(id)) {
          changes[category].removed.push(id);
          hasChanges = true;
        }
      }
    }

    if (!hasChanges) return null;

    return { type: 'state:update', windowId: this._windowId, changes };
  }

  dispose() {
    this._subscription.dispose();
    this._onStateChanged.dispose();
  }
}

module.exports = { StateReporter };
