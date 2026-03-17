const assert = require('assert');
const { SpinupTerminal } = require('../../terminal/spinupTerminal');

suite('SpinupTerminal', () => {
  let terminal;

  teardown(() => {
    terminal?.dispose();
  });

  test('stores name correctly', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    assert.strictEqual(terminal.name, 'Server');
  });

  test('isOpen is false before create', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    assert.strictEqual(terminal.isOpen, false);
  });

  test('isOpen is true after create', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.create();
    assert.strictEqual(terminal.isOpen, true);
  });

  test('create is idempotent', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.create();
    terminal.create();
    assert.strictEqual(terminal.isOpen, true);
  });

  test('dispose sets isOpen to false', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.create();
    terminal.dispose();
    assert.strictEqual(terminal.isOpen, false);
  });

  test('sendText creates terminal if not open', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    assert.strictEqual(terminal.isOpen, false);
    terminal.sendText('echo hello');
    assert.strictEqual(terminal.isOpen, true);
  });

  test('show does not throw when no terminal', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.show();
  });

  test('show does not throw when terminal exists', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.create();
    terminal.show();
  });

  test('clear does not throw when no terminal', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.clear();
  });

  test('clear does not throw when terminal exists', () => {
    terminal = new SpinupTerminal('Server', '/tmp', undefined);
    terminal.create();
    terminal.clear();
  });

  test('constructor accepts env parameter', () => {
    terminal = new SpinupTerminal('Server', '/tmp', { NODE_ENV: 'test' });
    assert.strictEqual(terminal.name, 'Server');
  });

  test('constructor accepts undefined cwd and env', () => {
    terminal = new SpinupTerminal('Server', undefined, undefined);
    assert.strictEqual(terminal.name, 'Server');
  });
});
