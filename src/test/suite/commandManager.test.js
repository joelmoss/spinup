const assert = require('assert');
const { CommandManager } = require('../../commands/commandManager');
const { TerminalManager } = require('../../terminal/terminalManager');
const { CommandStatus } = require('../../types');

suite('CommandManager', () => {
  let terminalManager;
  let manager;

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
    manager = new CommandManager(terminalManager, '/tmp/test');
  });

  teardown(() => {
    manager.dispose();
    terminalManager.dispose();
  });

  test('starts with zero counts', () => {
    assert.strictEqual(manager.totalCount, 0);
    assert.strictEqual(manager.runningCount, 0);
  });

  test('initialize creates processes from config', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
      Worker: { command: 'npm run worker', autostart: false },
    });
    await manager.initialize(config);
    assert.strictEqual(manager.totalCount, 2);
  });

  test('getStates returns all command states', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
      Worker: { command: 'npm run worker', autostart: false },
    });
    await manager.initialize(config);
    const states = manager.getStates();
    assert.strictEqual(states.length, 2);
    const names = states.map(s => s.name);
    assert.ok(names.includes('Server'));
    assert.ok(names.includes('Worker'));
  });

  test('getStates returns correct status for stopped commands', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config);
    const states = manager.getStates();
    assert.strictEqual(states[0].status, CommandStatus.Stopped);
  });

  test('reconcile adds new commands', async () => {
    const config1 = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config1);
    assert.strictEqual(manager.totalCount, 1);

    const config2 = makeConfig({
      Server: { command: 'npm start', autostart: false },
      Worker: { command: 'npm run worker', autostart: false },
    });
    await manager.reconcile(config2);
    assert.strictEqual(manager.totalCount, 2);
  });

  test('reconcile removes commands no longer in config', async () => {
    const config1 = makeConfig({
      Server: { command: 'npm start', autostart: false },
      Worker: { command: 'npm run worker', autostart: false },
    });
    await manager.initialize(config1);
    assert.strictEqual(manager.totalCount, 2);

    const config2 = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.reconcile(config2);
    assert.strictEqual(manager.totalCount, 1);
    const names = manager.getStates().map(s => s.name);
    assert.ok(names.includes('Server'));
    assert.ok(!names.includes('Worker'));
  });

  test('reconcile updates existing command config', async () => {
    const config1 = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config1);

    const config2 = makeConfig({
      Server: { command: 'npm run dev', autostart: false },
    });
    await manager.reconcile(config2);
    const states = manager.getStates();
    assert.strictEqual(states[0].config.command, 'npm run dev');
  });

  test('getStates preserves config order', async () => {
    const config = makeConfig({
      Zulu: { command: 'zulu', autostart: false },
      Alpha: { command: 'alpha', autostart: false },
      Mike: { command: 'mike', autostart: false },
    });
    await manager.initialize(config);

    const names = manager.getStates().map(s => s.name);
    assert.deepStrictEqual(names, ['Zulu', 'Alpha', 'Mike']);
  });

  test('start/stop individual commands by name', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config);

    await manager.start('Server');
    manager.stop('Server');
    const states = manager.getStates();
    assert.strictEqual(states[0].status, CommandStatus.Stopped);
  });

  test('start/stop with non-existent name is a no-op', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config);

    await manager.start('NonExistent');
    manager.stop('NonExistent');
    await manager.restart('NonExistent');
    manager.clear('NonExistent');
    manager.showTerminal('NonExistent');
  });

  test('stopAll stops all processes', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
      Worker: { command: 'npm run worker', autostart: false },
    });
    await manager.initialize(config);
    manager.stopAll();
    const states = manager.getStates();
    states.forEach(s => assert.strictEqual(s.status, CommandStatus.Stopped));
  });

  test('onDidChange fires on initialize', async () => {
    let fired = false;
    manager.onDidChange(() => { fired = true; });

    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config);
    assert.strictEqual(fired, true);
  });

  test('onDidChange fires on reconcile', async () => {
    const config1 = makeConfig({
      Server: { command: 'npm start', autostart: false },
    });
    await manager.initialize(config1);

    let fired = false;
    manager.onDidChange(() => { fired = true; });

    const config2 = makeConfig({
      Server: { command: 'npm run dev', autostart: false },
    });
    await manager.reconcile(config2);
    assert.strictEqual(fired, true);
  });

  test('dispose clears all processes', async () => {
    const config = makeConfig({
      Server: { command: 'npm start', autostart: false },
      Worker: { command: 'npm run worker', autostart: false },
    });
    await manager.initialize(config);
    manager.dispose();
    assert.strictEqual(manager.totalCount, 0);
  });

  test('first getOrCreate has no splitFrom, second has splitFrom', async () => {
    const { terminal: t1, splitFrom: sf1 } = terminalManager.getOrCreate('Server', '/tmp', undefined);
    assert.strictEqual(sf1, undefined);
    await t1.create();

    const { splitFrom: sf2 } = terminalManager.getOrCreate('Worker', '/tmp', undefined);
    assert.strictEqual(sf2, t1.terminal);
  });
});
