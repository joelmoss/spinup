const vscode = require('vscode');
const { ConfigLoader } = require('./config/loader');
const { ConfigWatcher } = require('./config/watcher');
const { TerminalManager } = require('./terminal/terminalManager');
const { CommandManager } = require('./commands/commandManager');
const { SpinupTreeDataProvider } = require('./ui/treeDataProvider');
const { StatusBarManager } = require('./ui/statusBarManager');
const { FileWatcherManager } = require('./fileWatcher/fileWatcherManager');

let lastValidConfig = null;

async function activate(context) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const terminalManager = new TerminalManager();
  const commandManager = new CommandManager(terminalManager, workspaceFolder.uri.fsPath);
  const treeDataProvider = new SpinupTreeDataProvider(commandManager);
  const statusBarManager = new StatusBarManager(commandManager);
  const fileWatcherManager = new FileWatcherManager(commandManager, workspaceFolder);
  const configWatcher = new ConfigWatcher(workspaceFolder);

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
  reg('spinup.reloadConfig', () => loadConfig());

  configWatcher.onDidChange(() => loadConfig());

  async function loadConfig() {
    const config = await ConfigLoader.load(workspaceFolder);
    if (config) {
      lastValidConfig = config;
      if (commandManager.totalCount === 0) {
        await commandManager.initialize(config);
      } else {
        commandManager.reconcile(config);
      }
      fileWatcherManager.setup(config);
    } else if (lastValidConfig) {
      vscode.window.showWarningMessage('Spinup: Config error — keeping previous configuration.');
    }
  }

  await loadConfig();

  context.subscriptions.push(
    treeView,
    terminalManager,
    commandManager,
    statusBarManager,
    fileWatcherManager,
    configWatcher,
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
