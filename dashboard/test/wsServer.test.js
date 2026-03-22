const assert = require('assert');
const WebSocket = require('ws');
const { DashboardServer } = require('../main/wsServer');
const { ProjectRegistry } = require('../main/projectRegistry');

suite('DashboardServer', () => {
  let server;
  let registry;

  setup(() => {
    registry = new ProjectRegistry();
  });

  teardown(async () => {
    if (server) await server.stop();
  });

  function connectClient(port) {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', () => resolve(ws));
    });
  }

  test('starts on specified port', async () => {
    server = new DashboardServer(registry, 0);
    const port = await server.start();
    assert.ok(port > 0);
  });

  test('handles connect message and registers project', async () => {
    server = new DashboardServer(registry, 0);
    const port = await server.start();
    const ws = await connectClient(port);

    ws.send(JSON.stringify({
      type: 'connect',
      windowId: 'win-1',
      window: { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] },
    }));

    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(registry.getProjects().length, 1);
    ws.close();
  });

  test('handles state:full message', async () => {
    server = new DashboardServer(registry, 0);
    const port = await server.start();
    const ws = await connectClient(port);

    ws.send(JSON.stringify({ type: 'connect', windowId: 'win-1', window: { kind: 'directory', name: 'test', path: '/test', folders: [] } }));
    await new Promise((r) => setTimeout(r, 20));

    ws.send(JSON.stringify({ type: 'state:full', windowId: 'win-1', terminals: [], agents: [], processes: [{ id: 'p1', name: 'Server', status: 'running' }] }));
    await new Promise((r) => setTimeout(r, 50));

    const project = registry.getProject('win-1');
    assert.strictEqual(project.state.processes.length, 1);
    ws.close();
  });

  test('handles state:update message', async () => {
    server = new DashboardServer(registry, 0);
    const port = await server.start();
    const ws = await connectClient(port);

    ws.send(JSON.stringify({ type: 'connect', windowId: 'win-1', window: { kind: 'directory', name: 'test', path: '/test', folders: [] } }));
    await new Promise((r) => setTimeout(r, 20));
    ws.send(JSON.stringify({ type: 'state:full', windowId: 'win-1', terminals: [], agents: [], processes: [{ id: 'p1', name: 'Server', status: 'running' }] }));
    await new Promise((r) => setTimeout(r, 20));
    ws.send(JSON.stringify({ type: 'state:update', windowId: 'win-1', changes: { processes: { added: [], removed: [], updated: [{ id: 'p1', name: 'Server', status: 'errored' }] }, terminals: { added: [], removed: [], updated: [] }, agents: { added: [], removed: [], updated: [] } } }));
    await new Promise((r) => setTimeout(r, 50));

    const project = registry.getProject('win-1');
    assert.strictEqual(project.state.processes[0].status, 'errored');
    ws.close();
  });

  test('removes project on client disconnect', async () => {
    server = new DashboardServer(registry, 0);
    const port = await server.start();
    const ws = await connectClient(port);

    ws.send(JSON.stringify({ type: 'connect', windowId: 'win-1', window: { kind: 'directory', name: 'test', path: '/test', folders: [] } }));
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(registry.getProjects().length, 1);

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(registry.getProjects().length, 0);
  });

  test('sendCommand sends message to correct client', async () => {
    server = new DashboardServer(registry, 0);
    const port = await server.start();
    const ws = await connectClient(port);

    ws.send(JSON.stringify({ type: 'connect', windowId: 'win-1', window: { kind: 'directory', name: 'test', path: '/test', folders: [] } }));
    await new Promise((r) => setTimeout(r, 20));

    const received = new Promise((resolve) => {
      ws.on('message', (data) => resolve(JSON.parse(data)));
    });

    server.sendCommand('win-1', { type: 'command:restart', processId: 'p1' });
    const msg = await received;
    assert.strictEqual(msg.type, 'command:restart');
    assert.strictEqual(msg.processId, 'p1');
    ws.close();
  });
});
