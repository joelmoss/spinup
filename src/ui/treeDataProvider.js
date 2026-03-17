const vscode = require('vscode');
const { CommandTreeItem } = require('./treeItems');

class SpinupTreeDataProvider {
  constructor(commandManager) {
    this._commandManager = commandManager;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    commandManager.onDidChange(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element) {
    return element;
  }

  getChildren() {
    return this._commandManager.getStates().map(state => new CommandTreeItem(state));
  }
}

module.exports = { SpinupTreeDataProvider };
