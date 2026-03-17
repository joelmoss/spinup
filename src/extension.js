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

  // Resolve the command name from either a tree item argument (context menu / inline button)
  // or the focused list item (keybinding). Keybindings don't pass the tree item, so we
  // run list.select first to promote focus → selection, then read treeView.selection.
  async function nameFromFocused(item) {
    if (item?.state?.name) {
      return item.state.name;
    }
    await vscode.commands.executeCommand('list.select');
    return treeView.selection[0]?.state?.name;
  }

  reg('spinup.startAll', () => commandManager.startAll());
  reg('spinup.stopAll', () => commandManager.stopAll());
  reg('spinup.restartAll', () => commandManager.restartAll());
  reg('spinup.start', async (item) => commandManager.start(await nameFromFocused(item)));
  reg('spinup.stop', async (item) => commandManager.stop(await nameFromFocused(item)));
  reg('spinup.restart', async (item) => {
    const name = await nameFromFocused(item);
    if (name) {
      await commandManager.restart(name);
      await vscode.commands.executeCommand('spinupCommands.focus');
    }
  });
  reg('spinup.clear', async (item) => commandManager.clear(await nameFromFocused(item)));
  reg('spinup.openTerminal', async (item) => commandManager.showTerminal(await nameFromFocused(item)));
  reg('spinup.toggleStartStop', async (item) => {
    const name = await nameFromFocused(item);
    if (name) {
      commandManager.isRunning(name) ? commandManager.stop(name) : await commandManager.start(name);
      await vscode.commands.executeCommand('spinupCommands.focus');
    }
  });
  reg('spinup.startOrShowTerminal', async (item) => {
    const name = await nameFromFocused(item);
    if (name) {
      if (commandManager.isRunning(name)) {
        commandManager.showTerminal(name);
      } else {
        await commandManager.start(name);
        commandManager.showTerminal(name);
      }
    }
  });
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
