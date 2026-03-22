const assert = require('assert');
const vscode = require('vscode');
const { StateReporter } = require('../../bridge/stateReporter');

suite('StateReporter', () => {
  let reporter;

  function makeMockCommandManager(states = []) {
    const emitter = new vscode.EventEmitter();
    return {
      getStates: () => states,
      onDidChange: emitter.event,
      _fire: () => emitter.fire(),
      _emitter: emitter,
    };
  }

  function makeMockTerminals(terminals = []) {
    return terminals;
  }

  teardown(() => {
    if (reporter) reporter.dispose();
  });

  test('getFullState returns state:full message shape', () => {
    const manager = makeMockCommandManager([
      { name: 'Server', config: { command: 'node server.js' }, status: 'running', restartCount: 0, metrics: { cpu: 1.2, mem: 32 } },
    ]);
    reporter = new StateReporter('window-1', manager, makeMockTerminals());
    const state = reporter.getFullState();

    assert.strictEqual(state.type, 'state:full');
    assert.strictEqual(state.windowId, 'window-1');
    assert.ok(Array.isArray(state.processes));
    assert.strictEqual(state.processes.length, 1);
    assert.strictEqual(state.processes[0].name, 'Server');
    assert.strictEqual(state.processes[0].command, 'node server.js');
    assert.strictEqual(state.processes[0].status, 'running');
  });

  test('computeDelta detects added processes', () => {
    const manager = makeMockCommandManager([]);
    reporter = new StateReporter('window-1', manager, makeMockTerminals());

    const oldState = reporter.getFullState();
    manager.getStates = () => [
      { name: 'Server', config: { command: 'node server.js' }, status: 'running', restartCount: 0, metrics: null },
    ];
    const delta = reporter.computeDelta(oldState);

    assert.strictEqual(delta.changes.processes.added.length, 1);
    assert.strictEqual(delta.changes.processes.added[0].name, 'Server');
    assert.strictEqual(delta.changes.processes.removed.length, 0);
  });

  test('computeDelta detects removed processes', () => {
    const manager = makeMockCommandManager([
      { name: 'Server', config: { command: 'node server.js' }, status: 'running', restartCount: 0, metrics: null },
    ]);
    reporter = new StateReporter('window-1', manager, makeMockTerminals());

    const oldState = reporter.getFullState();
    manager.getStates = () => [];
    const delta = reporter.computeDelta(oldState);

    assert.strictEqual(delta.changes.processes.removed.length, 1);
    assert.ok(delta.changes.processes.removed.includes('Server'));
  });

  test('computeDelta detects updated processes', () => {
    const manager = makeMockCommandManager([
      { name: 'Server', config: { command: 'node server.js' }, status: 'running', restartCount: 0, metrics: null },
    ]);
    reporter = new StateReporter('window-1', manager, makeMockTerminals());

    const oldState = reporter.getFullState();
    manager.getStates = () => [
      { name: 'Server', config: { command: 'node server.js' }, status: 'errored', restartCount: 1, metrics: null },
    ];
    const delta = reporter.computeDelta(oldState);

    assert.strictEqual(delta.changes.processes.updated.length, 1);
    assert.strictEqual(delta.changes.processes.updated[0].status, 'errored');
  });

  test('computeDelta returns null when nothing changed', () => {
    const states = [
      { name: 'Server', config: { command: 'node server.js' }, status: 'running', restartCount: 0, metrics: null },
    ];
    const manager = makeMockCommandManager(states);
    reporter = new StateReporter('window-1', manager, makeMockTerminals());

    const oldState = reporter.getFullState();
    const delta = reporter.computeDelta(oldState);

    assert.strictEqual(delta, null);
  });
});
