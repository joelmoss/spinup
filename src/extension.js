const vscode = require('vscode');
const { loadConfig, onDidChangeConfig } = require('./config/settings');
const { TerminalManager } = require('./terminal/terminalManager');
const { CommandManager } = require('./commands/commandManager');
const { SpinupTreeDataProvider } = require('./ui/treeDataProvider');
const { StatusBarManager } = require('./ui/statusBarManager');
const { FileWatcherManager } = require('./fileWatcher/fileWatcherManager');

let lastValidConfig = null;

function activate(context) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const terminalManager = new TerminalManager();
  const commandManager = new CommandManager(terminalManager, workspaceFolder.uri.fsPath);
  const treeDataProvider = new SpinupTreeDataProvider(commandManager);
  const statusBarManager = new StatusBarManager(commandManager);
  const fileWatcherManager = new FileWatcherManager(commandManager, workspaceFolder);

  const treeView = vscode.window.createTreeView('spinupCommands', {
    treeDataProvider,
    showCollapseAll: false,
  });

  const reg = (id, handler) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));

  reg('spinup.startAll', () => commandManager.startAll());
  reg('spinup.stopAll', () => commandManager.stopAll());
  reg('spinup.restartAll', () => commandManager.restartAll());
  reg('spinup.start', (item) => commandManager.start(item.state.name));
  reg('spinup.stop', (item) => commandManager.stop(item.state.name));
  reg('spinup.restart', (item) => commandManager.restart(item.state.name));
  reg('spinup.clear', (item) => commandManager.clear(item.state.name));
  reg('spinup.openTerminal', (item) => commandManager.showTerminal(item.state.name));
  reg('spinup.openSettings', () =>
    vscode.commands.executeCommand('workbench.action.openSettings', 'spinup.commands'),
  );


  const configDisposable = onDidChangeConfig(() => applyConfig());

  async function applyConfig() {
    const config = loadConfig();
    if (config) {
      lastValidConfig = config;
      if (commandManager.totalCount === 0) {
        await commandManager.initialize(config);
      } else {
        await commandManager.reconcile(config);
      }
      fileWatcherManager.setup(config);
    } else if (lastValidConfig) {
      vscode.window.showWarningMessage('Spinup: Config error — keeping previous configuration.');
    }
    vscode.commands.executeCommand('setContext', 'spinup.hasCommands', commandManager.totalCount > 0);
  }

  applyConfig();

  context.subscriptions.push(
    treeView,
    terminalManager,
    commandManager,
    statusBarManager,
    fileWatcherManager,
    configDisposable,
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
