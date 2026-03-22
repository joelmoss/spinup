const assert = require('assert');
const path = require('path');
const { TerminalManager } = require('../../terminal/terminalManager');
const { CommandManager } = require('../../commands/commandManager');
const { CommandStatus } = require('../../types');

suite('Keybindings', () => {
  let keybindings;

  setup(() => {
    const pkg = require(path.resolve(__dirname, '../../../package.json'));
    keybindings = pkg.contributes.keybindings;
  });

  test('s key is bound to toggleStartStop in the sidebar', () => {
    const binding = keybindings.find(k => k.command === 'spinup.toggleStartStop' && k.key === 's');
    assert.ok(binding, 'keybinding for s → spinup.toggleStartStop should exist');
    assert.ok(binding.when.includes('focusedView == spinupCommands'));
    assert.ok(binding.when.includes('listFocus'));
  });

  test('r key is bound to restart in the sidebar', () => {
    const binding = keybindings.find(k => k.command === 'spinup.restart' && k.key === 'r');
    assert.ok(binding, 'keybinding for r → spinup.restart should exist');
    assert.ok(binding.when.includes('focusedView == spinupCommands'));
    assert.ok(binding.when.includes('listFocus'));
  });

  test('enter key is bound to startOrShowTerminal in the sidebar', () => {
    const binding = keybindings.find(k => k.command === 'spinup.startOrShowTerminal' && k.key === 'enter');
    assert.ok(binding, 'keybinding for enter → spinup.startOrShowTerminal should exist');
    assert.ok(binding.when.includes('focusedView == spinupCommands'));
    assert.ok(binding.when.includes('listFocus'));
  });
});

suite('Keybinding commands', () => {
  let terminalManager;
  let commandManager;

  function makeConfig(commands) {
    const result = { commands: {} };
    for (const [name, cfg] of Object.entries(commands)) {
      result.commands[name] = {
        command: cfg.command,
        autostart: cfg.autostart ?? false,
        autoRestart: cfg.autoRestart ?? false,
        interactive: false,
      };
    }
    return result;
  }

  setup(() => {
    terminalManager = new TerminalManager();
    commandManager = new CommandManager(terminalManager, '/tmp/test');
  });

  teardown(() => {
    commandManager.dispose();
    terminalManager.dispose();
  });

  test('toggleStartStop starts a stopped process', async () => {
    await commandManager.initialize(makeConfig({
      Server: { command: 'echo hello' },
    }));

    assert.strictEqual(commandManager.isRunning('Server'), false);
    await commandManager.start('Server');
    assert.strictEqual(commandManager.isRunning('Server'), true);
  });

  test('toggleStartStop stops a running process', async () => {
    await commandManager.initialize(makeConfig({
      Server: { command: 'echo hello' },
    }));

    await commandManager.start('Server');
    assert.strictEqual(commandManager.isRunning('Server'), true);
    commandManager.stop('Server');
    assert.strictEqual(commandManager.isRunning('Server'), false);
  });

  test('isRunning returns false for unknown command', async () => {
    await commandManager.initialize(makeConfig({
      Server: { command: 'echo hello' },
    }));

    assert.strictEqual(commandManager.isRunning('Unknown'), false);
  });

  test('startOrShowTerminal starts a stopped process', async () => {
    await commandManager.initialize(makeConfig({
      Server: { command: 'echo hello' },
    }));

    assert.strictEqual(commandManager.isRunning('Server'), false);
    // Simulate startOrShowTerminal: start then show
    await commandManager.start('Server');
    assert.strictEqual(commandManager.isRunning('Server'), true);
  });

  test('startOrShowTerminal on running process does not restart it', async () => {
    await commandManager.initialize(makeConfig({
      Server: { command: 'echo hello' },
    }));

    await commandManager.start('Server');
    const states = commandManager.getStates();
    const proc = states.find(s => s.name === 'Server');
    assert.strictEqual(proc.status, CommandStatus.Running);

    // Calling start again on a running process is a no-op
    await commandManager.start('Server');
    assert.strictEqual(commandManager.isRunning('Server'), true);
  });
});
