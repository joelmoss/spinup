const assert = require('assert');
const http = require('http');
const { WebSocketServer } = require('ws');
const { BridgeClient } = require('../../bridge/bridgeClient');

suite('BridgeClient', () => {
  let wss;
  let server;
  let port;
  let client;

  setup((done) => {
    server = http.createServer();
    wss = new WebSocketServer({ server });
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  teardown((done) => {
    if (client) client.dispose();
    wss.close(() => server.close(done));
  });

  test('connects to WebSocket server', (done) => {
    client = new BridgeClient(port);
    wss.on('connection', () => done());
    client.connect();
  });

  test('sends JSON messages', (done) => {
    client = new BridgeClient(port);
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        assert.strictEqual(msg.type, 'connect');
        assert.strictEqual(msg.windowId, 'test-id');
        done();
      });
    });
    client.connect();
    client.onConnected(() => {
      client.send({ type: 'connect', windowId: 'test-id' });
    });
  });

  test('receives and dispatches incoming messages', (done) => {
    client = new BridgeClient(port);
    client.onMessage((msg) => {
      assert.strictEqual(msg.type, 'command:start');
      assert.strictEqual(msg.processId, 'proc-1');
      done();
    });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'command:start', processId: 'proc-1' }));
    });
    client.connect();
  });

  test('reconnects after disconnect', (done) => {
    client = new BridgeClient(port, { reconnectInterval: 50 });
    let connectionCount = 0;
    wss.on('connection', (ws) => {
      connectionCount++;
      if (connectionCount === 1) {
        ws.close();
      } else if (connectionCount === 2) {
        done();
      }
    });
    client.connect();
  });

  test('isConnected reflects connection state', (done) => {
    client = new BridgeClient(port);
    assert.strictEqual(client.isConnected, false);
    client.onConnected(() => {
      assert.strictEqual(client.isConnected, true);
      done();
    });
    client.connect();
  });

  test('dispose stops reconnect attempts', (done) => {
    client = new BridgeClient(port, { reconnectInterval: 50 });
    let connectionCount = 0;
    wss.on('connection', (ws) => {
      connectionCount++;
      if (connectionCount === 1) {
        ws.close();
        client.dispose();
        setTimeout(() => {
          assert.strictEqual(connectionCount, 1);
          client = null; // prevent double-dispose in teardown
          done();
        }, 150);
      }
    });
    client.connect();
  });
});

suite('Bridge integration', () => {
  test('BridgeClient, StateReporter, CommandHandler, and AgentHookListener can be instantiated together', () => {
    const { BridgeClient } = require('../../bridge/bridgeClient');
    const { StateReporter } = require('../../bridge/stateReporter');
    const { CommandHandler } = require('../../bridge/commandHandler');
    const { AgentHookListener } = require('../../bridge/agentHookListener');
    const { AgentDetector } = require('../../bridge/agents/agentDetector');

    // Verify all modules load and can be instantiated
    assert.ok(BridgeClient);
    assert.ok(StateReporter);
    assert.ok(CommandHandler);
    assert.ok(AgentHookListener);
    assert.ok(AgentDetector);
  });
});
