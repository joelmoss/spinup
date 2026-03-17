const vscode = require('vscode');

function loadConfig() {
  const raw = vscode.workspace.getConfiguration('spinup').get('commands', {});

  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return null;
  }

  const commands = {};
  for (const [name, cmd] of Object.entries(raw)) {
    if (!cmd || typeof cmd.command !== 'string') {
      vscode.window.showErrorMessage(`Spinup: Command "${name}" is missing a valid "command" string.`);
      return null;
    }

    commands[name] = {
      command: cmd.command,
      autostart: cmd.autostart ?? true,
      autoRestart: cmd.autoRestart ?? false,
      interactive: cmd.interactive ?? false,
      cwd: cmd.cwd,
      env: cmd.env,
      watch: cmd.watch,
    };
  }

  return { commands };
}

function onDidChangeConfig(callback) {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('spinup')) {
      callback();
    }
  });
}

module.exports = { loadConfig, onDidChangeConfig };
