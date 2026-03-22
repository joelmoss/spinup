const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig, onDidChangeConfig } = require('./config/settings');
const { TerminalManager } = require('./terminal/terminalManager');
const { CommandManager } = require('./commands/commandManager');
const { SpinupTreeDataProvider } = require('./ui/treeDataProvider');
const { StatusBarManager } = require('./ui/statusBarManager');
const { FileWatcherManager } = require('./fileWatcher/fileWatcherManager');
// Bridge modules are lazy-loaded in setupBridge() so a missing `ws` dependency
// (e.g. when node_modules is excluded from packaging) cannot break activation.

let lastValidConfig = null;

function readDashboardPort() {
  const serverInfoPath = path.join(os.homedir(), '.spinup-dashboard', 'server.json');
  try {
    const info = JSON.parse(fs.readFileSync(serverInfoPath, 'utf8'));
    try {
      process.kill(info.pid, 0);
    } catch {
      try { fs.unlinkSync(serverInfoPath); } catch { /* ignore */ }
      return null;
    }
    return info.port;
  } catch {
    return null;
  }
}

function initBridge(context, commandManager, _terminalManager) {
  let port = readDashboardPort();
  if (!port) {
    // Dashboard not running yet — poll every 10s until it appears
    const pollInterval = setInterval(() => {
      port = readDashboardPort();
      if (port) {
        clearInterval(pollInterval);
        setupBridge(context, commandManager, port);
      }
    }, 10000);
    context.subscriptions.push({ dispose: () => clearInterval(pollInterval) });
    return;
  }
  setupBridge(context, commandManager, port);
}

function setupBridge(context, commandManager, port) {
  const { BridgeClient } = require('./bridge/bridgeClient');
  const { StateReporter } = require('./bridge/stateReporter');
  const { CommandHandler } = require('./bridge/commandHandler');

  // Construct windowId from machineId + sessionId
  const windowId = `${vscode.env.machineId}:${vscode.env.sessionId}`;

  // Build window info
  const workspaceFile = vscode.workspace.workspaceFile;
  const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => ({ name: f.name, path: f.uri.fsPath }));
  const windowInfo = {
    kind: workspaceFile ? 'workspace' : 'directory',
    name: workspaceFile ? path.basename(workspaceFile.fsPath, '.code-workspace') : folders[0]?.name ?? 'unknown',
    path: workspaceFile ? workspaceFile.fsPath : folders[0]?.path ?? '',
    folders,
  };

  // Create bridge components
  const client = new BridgeClient(port);
  const reporter = new StateReporter(windowId, commandManager);
  const handler = new CommandHandler(commandManager);

  // Wire incoming commands
  client.onMessage((msg) => handler.handle(msg));

  // On connect: send window info + full state
  let previousState = null;
  client.onConnected(() => {
    client.send({ type: 'connect', windowId, window: windowInfo });
    const fullState = reporter.getFullState();
    client.send(fullState);
    previousState = fullState;
  });

  // On state change: send delta
  reporter.onStateChanged(() => {
    if (!client.isConnected || !previousState) return;
    const delta = reporter.computeDelta(previousState);
    if (delta) {
      client.send(delta);
      previousState = reporter.getFullState();
    }
  });

  // Periodic heartbeat: full state every 30s
  const heartbeatInterval = setInterval(() => {
    if (!client.isConnected) return;
    const fullState = reporter.getFullState();
    client.send(fullState);
    previousState = fullState;
  }, 30000);

  // Periodic metrics: every 3s (matching existing Spinup metrics interval)
  const metricsInterval = setInterval(() => {
    if (!client.isConnected) return;
    const states = commandManager.getStates();
    const items = states
      .filter((s) => s.metrics)
      .map((s) => ({ id: s.name, cpu: s.metrics.cpu, mem: s.metrics.mem }));
    if (items.length > 0) {
      client.send({ type: 'metrics', windowId, items });
    }
  }, 3000);

  // Start connection
  client.connect();

  // Register disposables
  context.subscriptions.push(
    client,
    reporter,
    { dispose: () => clearInterval(heartbeatInterval) },
    { dispose: () => clearInterval(metricsInterval) },
  );
}

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
  reg('spinup.start', async (item) => {
    const name = await nameFromFocused(item);
    if (name) {
      await commandManager.start(name);
      commandManager.showTerminal(name);
    }
  });
  reg('spinup.stop', async (item) => commandManager.stop(await nameFromFocused(item)));
  reg('spinup.restart', async (item) => {
    const name = await nameFromFocused(item);
    if (name) {
      await commandManager.restart(name);
      commandManager.showTerminal(name);
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

  initBridge(context, commandManager, terminalManager);
}

function deactivate() {}

module.exports = { activate, deactivate };
