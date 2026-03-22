'use strict';

const assert = require('assert');
const { CommandHandler } = require('../../bridge/commandHandler');

suite('CommandHandler', () => {
  let handler;
  let actions;

  function makeMockCommandManager() {
    return {
      start: (name) => { actions.push({ action: 'start', name }); },
      stop: (name) => { actions.push({ action: 'stop', name }); },
      restart: (name) => { actions.push({ action: 'restart', name }); },
      showTerminal: (name) => { actions.push({ action: 'showTerminal', name }); },
    };
  }

  setup(() => {
    actions = [];
    handler = new CommandHandler(makeMockCommandManager());
  });

  test('handles command:start', () => {
    handler.handle({ type: 'command:start', processId: 'Server' });
    assert.deepStrictEqual(actions, [{ action: 'start', name: 'Server' }]);
  });

  test('handles command:stop', () => {
    handler.handle({ type: 'command:stop', processId: 'Server' });
    assert.deepStrictEqual(actions, [{ action: 'stop', name: 'Server' }]);
  });

  test('handles command:restart', () => {
    handler.handle({ type: 'command:restart', processId: 'Server' });
    assert.deepStrictEqual(actions, [{ action: 'restart', name: 'Server' }]);
  });

  test('handles terminal:focus by command name', () => {
    handler.handle({ type: 'terminal:focus', terminalId: 'Server' });
    assert.deepStrictEqual(actions, [{ action: 'showTerminal', name: 'Server' }]);
  });

  test('handles window:focus', () => {
    // window:focus uses vscode.window.activeTerminal and vscode.commands — just verify no throw
    handler.handle({ type: 'window:focus' });
    assert.strictEqual(actions.length, 0);
  });

  test('ignores unknown message types', () => {
    handler.handle({ type: 'unknown:thing' });
    assert.strictEqual(actions.length, 0);
  });
});
