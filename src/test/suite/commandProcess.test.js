const assert = require('assert');
const { CommandProcess } = require('../../commands/commandProcess');
const { TerminalManager } = require('../../terminal/terminalManager');
const { CommandStatus } = require('../../types');

suite('CommandProcess', () => {
  let terminalManager;

  function makeConfig(overrides = {}) {
    return {
      command: 'npm start',
      autostart: true,
      autoRestart: false,
      interactive: false,
      ...overrides,
    };
  }

  function createProcess(name, config) {
    return new CommandProcess(name, config ?? makeConfig(), terminalManager, '/tmp/test');
  }

  setup(() => {
    terminalManager = new TerminalManager();
  });

  teardown(() => {
    terminalManager.dispose();
  });

  test('initial status is stopped', () => {
    const proc = createProcess('Server');
    assert.strictEqual(proc.status, CommandStatus.Stopped);
    proc.dispose();
  });

  test('initial restart count is 0', () => {
    const proc = createProcess('Server');
    assert.strictEqual(proc.restartCount, 0);
    proc.dispose();
  });

  test('name is set correctly', () => {
    const proc = createProcess('MyServer');
    assert.strictEqual(proc.name, 'MyServer');
    proc.dispose();
  });

  test('start changes status to running', () => {
    const proc = createProcess('Server');
    proc.start();
    assert.strictEqual(proc.status, CommandStatus.Running);
    proc.dispose();
  });

  test('start is a no-op when already running', () => {
    const proc = createProcess('Server');
    let statusChanges = 0;
    proc.onStatusChanged(() => statusChanges++);
    proc.start();
    proc.start();
    assert.strictEqual(statusChanges, 1);
    proc.dispose();
  });

  test('stop changes status to stopped', () => {
    const proc = createProcess('Server');
    proc.start();
    proc.stop();
    assert.strictEqual(proc.status, CommandStatus.Stopped);
    proc.dispose();
  });

  test('stop when already stopped is a no-op for status', () => {
    const proc = createProcess('Server');
    let statusChanges = 0;
    proc.onStatusChanged(() => statusChanges++);
    proc.stop();
    assert.strictEqual(statusChanges, 0);
    proc.dispose();
  });

  test('restart cycles through stop and start', () => {
    const proc = createProcess('Server');
    const statuses = [];
    proc.onStatusChanged(status => statuses.push(status));
    proc.start();
    proc.restart();
    assert.strictEqual(statuses.length, 3);
    assert.strictEqual(statuses[0], CommandStatus.Running);
    assert.strictEqual(statuses[1], CommandStatus.Stopped);
    assert.strictEqual(statuses[2], CommandStatus.Running);
    proc.dispose();
  });

  test('updateConfig changes the config', () => {
    const proc = createProcess('Server');
    const newConfig = makeConfig({ command: 'npm run dev' });
    proc.updateConfig(newConfig);
    proc.start();
    proc.dispose();
  });

  test('onStatusChanged fires on status change', () => {
    const proc = createProcess('Server');
    const events = [];
    proc.onStatusChanged(status => events.push(status));
    proc.start();
    assert.deepStrictEqual(events, [CommandStatus.Running]);
    proc.stop();
    assert.deepStrictEqual(events, [CommandStatus.Running, CommandStatus.Stopped]);
    proc.dispose();
  });

  test('dispose cleans up without errors', () => {
    const proc = createProcess('Server');
    proc.start();
    proc.dispose();
  });

  test('dispose on stopped process does not throw', () => {
    const proc = createProcess('Server');
    proc.dispose();
  });
});
