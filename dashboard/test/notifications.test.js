const assert = require('assert');
const { NotificationManager } = require('../main/notifications');

suite('NotificationManager', () => {
  let manager;

  setup(() => {
    manager = new NotificationManager({ send: () => {} }); // mock Notification
  });

  test('shouldNotify returns true for waiting_for_input', () => {
    assert.strictEqual(manager.shouldNotify('waiting_for_input'), true);
  });

  test('shouldNotify returns true for errored', () => {
    assert.strictEqual(manager.shouldNotify('errored'), true);
  });

  test('shouldNotify returns false for running', () => {
    assert.strictEqual(manager.shouldNotify('running'), false);
  });

  test('shouldNotify returns false for idle', () => {
    assert.strictEqual(manager.shouldNotify('idle'), false);
  });

  test('buildNotification returns correct shape for agent waiting', () => {
    const n = manager.buildNotification('spinup', 'win-1', { id: 'a1', name: 'Claude Code', status: 'waiting_for_input', kind: 'claude-code' }, 'agent');
    assert.strictEqual(n.title, 'Spinup Dashboard');
    assert.ok(n.body.includes('Claude Code'));
    assert.ok(n.body.includes('waiting'));
    assert.ok(n.body.includes('spinup'));
    assert.strictEqual(n.windowId, 'win-1');
  });

  test('buildNotification returns correct shape for errored process', () => {
    const n = manager.buildNotification('my-api', 'win-2', { id: 'p1', name: 'Server', status: 'errored' }, 'process');
    assert.ok(n.body.includes('Server'));
    assert.ok(n.body.includes('errored'));
    assert.ok(n.body.includes('my-api'));
    assert.strictEqual(n.windowId, 'win-2');
  });

  test('deduplicates notifications for the same item within cooldown', () => {
    const sent = [];
    manager = new NotificationManager({ send: (n) => sent.push(n) }, { cooldownMs: 100 });
    manager.notify('spinup', 'win-1', { id: 'a1', name: 'Claude', status: 'waiting_for_input' }, 'agent');
    manager.notify('spinup', 'win-1', { id: 'a1', name: 'Claude', status: 'waiting_for_input' }, 'agent');
    assert.strictEqual(sent.length, 1);
  });
});
