const assert = require('assert');
const vscode = require('vscode');
const { CommandTreeItem } = require('../../ui/treeItems');
const { CommandStatus } = require('../../types');

suite('CommandTreeItem', () => {
  function makeState(overrides = {}) {
    return {
      name: 'Server',
      config: {
        command: 'npm run dev',
        autostart: true,
        autoRestart: false,
        interactive: false,
      },
      status: CommandStatus.Stopped,
      restartCount: 0,
      ...overrides,
    };
  }

  test('sets name as label', () => {
    const item = new CommandTreeItem(makeState({ name: 'MyServer' }));
    assert.strictEqual(item.label, 'MyServer');
  });

  test('collapsible state is None', () => {
    const item = new CommandTreeItem(makeState());
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test('contextValue matches status', () => {
    for (const status of [CommandStatus.Running, CommandStatus.Stopped, CommandStatus.Errored]) {
      const item = new CommandTreeItem(makeState({ status }));
      assert.strictEqual(item.contextValue, status);
    }
  });

  test('description is empty when running without metrics', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Running }));
    assert.strictEqual(item.description, '');
  });

  test('description shows CPU and RAM when metrics available', () => {
    const item = new CommandTreeItem(makeState({
      status: CommandStatus.Running,
      metrics: { cpu: 12.5, mem: 64.3 },
    }));
    assert.strictEqual(item.description, '12.5% CPU, 64.3 MB');
  });

  test('description is empty when stopped', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Stopped }));
    assert.strictEqual(item.description, '');
  });

  test('description is "errored" when errored with no restarts', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Errored, restartCount: 0 }));
    assert.strictEqual(item.description, 'errored');
  });

  test('description includes restart count when errored', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Errored, restartCount: 3 }));
    assert.strictEqual(item.description, 'errored (restart 3)');
  });

  test('icon is play-circle when running', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Running }));
    assert.strictEqual(item.iconPath.id, 'play-circle');
  });

  test('icon is error when errored', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Errored }));
    assert.strictEqual(item.iconPath.id, 'error');
  });

  test('icon is circle-outline when stopped', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Stopped }));
    assert.strictEqual(item.iconPath.id, 'circle-outline');
  });

  test('running item has openTerminal command', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Running }));
    assert.ok(item.command);
    assert.strictEqual(item.command.command, 'spinup.openTerminal');
  });

  test('stopped item has no command', () => {
    const item = new CommandTreeItem(makeState({ status: CommandStatus.Stopped }));
    assert.strictEqual(item.command, undefined);
  });

  test('tooltip includes name and status', () => {
    const item = new CommandTreeItem(makeState({ name: 'Worker', status: CommandStatus.Running }));
    assert.ok(item.tooltip.includes('Worker'));
    assert.ok(item.tooltip.includes('running'));
  });

  test('tooltip includes command', () => {
    const item = new CommandTreeItem(makeState());
    assert.ok(item.tooltip.includes('npm run dev'));
  });

  test('tooltip includes cwd when set', () => {
    const state = makeState();
    state.config.cwd = './backend';
    const item = new CommandTreeItem(state);
    assert.ok(item.tooltip.includes('CWD: ./backend'));
  });

  test('tooltip includes auto-restart when enabled', () => {
    const state = makeState();
    state.config.autoRestart = true;
    const item = new CommandTreeItem(state);
    assert.ok(item.tooltip.includes('Auto-restart: enabled'));
  });

  test('tooltip includes watch patterns when set', () => {
    const state = makeState();
    state.config.watch = ['src/**', 'lib/**'];
    const item = new CommandTreeItem(state);
    assert.ok(item.tooltip.includes('Watching: src/**, lib/**'));
  });

  test('tooltip omits cwd when not set', () => {
    const item = new CommandTreeItem(makeState());
    assert.ok(!item.tooltip.includes('CWD:'));
  });

  test('tooltip omits auto-restart when disabled', () => {
    const item = new CommandTreeItem(makeState());
    assert.ok(!item.tooltip.includes('Auto-restart'));
  });

  test('tooltip omits watch when not set', () => {
    const item = new CommandTreeItem(makeState());
    assert.ok(!item.tooltip.includes('Watching'));
  });
});
