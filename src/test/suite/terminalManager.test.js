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
    const terminal = manager.getOrCreate('Server', '/tmp', undefined);
    assert.ok(terminal);
    assert.strictEqual(terminal.name, 'Server');
  });

  test('getOrCreate returns same terminal on second call before create', () => {
    const t1 = manager.getOrCreate('Server', '/tmp', undefined);
    const t2 = manager.getOrCreate('Server', '/tmp', undefined);
    assert.ok(t2);
    assert.strictEqual(t2.name, 'Server');
  });

  test('getOrCreate returns same terminal when open', () => {
    const t1 = manager.getOrCreate('Server', '/tmp', undefined);
    t1.create();
    const t2 = manager.getOrCreate('Server', '/tmp', undefined);
    assert.strictEqual(t1, t2);
  });

  test('get returns undefined for unknown name', () => {
    assert.strictEqual(manager.get('Unknown'), undefined);
  });

  test('get returns terminal after getOrCreate', () => {
    const created = manager.getOrCreate('Server', '/tmp', undefined);
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
    const terminal = manager.getOrCreate('Server', '/tmp', env);
    assert.ok(terminal);
  });

  test('getOrCreate with undefined cwd', () => {
    const terminal = manager.getOrCreate('Server', undefined, undefined);
    assert.ok(terminal);
  });
});
