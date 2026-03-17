const assert = require('assert');
const { TerminalManager } = require('../../terminal/terminalManager');

suite('TerminalManager', () => {
  let manager;

  setup(() => {
    manager = new TerminalManager();
  });

  teardown(() => {
    manager.dispose();
  });

  test('getOrCreate returns a terminal', () => {
    const { terminal } = manager.getOrCreate('Server', '/tmp', undefined);
    assert.ok(terminal);
    assert.strictEqual(terminal.name, 'Server');
  });

  test('getOrCreate returns same terminal when open', async () => {
    const { terminal: t1 } = manager.getOrCreate('Server', '/tmp', undefined);
    await t1.create();
    const { terminal: t2 } = manager.getOrCreate('Server', '/tmp', undefined);
    assert.strictEqual(t1, t2);
  });

  test('get returns undefined for unknown name', () => {
    assert.strictEqual(manager.get('Unknown'), undefined);
  });

  test('get returns terminal after getOrCreate', () => {
    manager.getOrCreate('Server', '/tmp', undefined);
    const got = manager.get('Server');
    assert.ok(got);
  });

  test('remove disposes and deletes terminal', () => {
    manager.getOrCreate('Server', '/tmp', undefined);
    manager.remove('Server');
    assert.strictEqual(manager.get('Server'), undefined);
  });

  test('remove with unknown name is a no-op', () => {
    manager.remove('Unknown');
  });

  test('disposeAll removes all terminals', () => {
    manager.getOrCreate('Server', '/tmp', undefined);
    manager.getOrCreate('Worker', '/tmp', undefined);
    manager.disposeAll();
    assert.strictEqual(manager.get('Server'), undefined);
    assert.strictEqual(manager.get('Worker'), undefined);
  });

  test('getOrCreate with env passes it to terminal', () => {
    const env = { NODE_ENV: 'test' };
    const { terminal } = manager.getOrCreate('Server', '/tmp', env);
    assert.ok(terminal);
  });

  test('getOrCreate with undefined cwd', () => {
    const { terminal } = manager.getOrCreate('Server', undefined, undefined);
    assert.ok(terminal);
  });

  test('first terminal has no splitFrom', () => {
    const { splitFrom } = manager.getOrCreate('Server', '/tmp', undefined);
    assert.strictEqual(splitFrom, undefined);
  });

  test('second terminal gets splitFrom after first is created', async () => {
    const { terminal: t1 } = manager.getOrCreate('Server', '/tmp', undefined);
    await t1.create();
    const { splitFrom } = manager.getOrCreate('Worker', '/tmp', undefined);
    assert.strictEqual(splitFrom, t1.terminal);
    assert.ok(splitFrom);
  });

  test('second terminal has no splitFrom if first not yet created', () => {
    manager.getOrCreate('Server', '/tmp', undefined);
    const { splitFrom } = manager.getOrCreate('Worker', '/tmp', undefined);
    assert.strictEqual(splitFrom, undefined);
  });

  test('group parent falls back to another open terminal after removal', async () => {
    const { terminal: t1 } = manager.getOrCreate('Server', '/tmp', undefined);
    await t1.create();
    const { terminal: t2 } = manager.getOrCreate('Worker', '/tmp', undefined);
    await t2.create();
    manager.remove('Server');
    const { splitFrom } = manager.getOrCreate('Watcher', '/tmp', undefined);
    assert.strictEqual(splitFrom, t2.terminal);
  });
});
