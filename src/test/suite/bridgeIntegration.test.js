const assert = require('assert');
const http = require('http');
const { WebSocketServer } = require('ws');
const { BridgeClient } = require('../../bridge/bridgeClient');
const { StateReporter } = require('../../bridge/stateReporter');
const { CommandHandler } = require('../../bridge/commandHandler');
const { AgentHookListener } = require('../../bridge/agentHookListener');
const { AgentDetector } = require('../../bridge/agents/agentDetector');
const vscode = require('vscode');

suite('Bridge Integration', () => {
  let wss;
  let httpServer;
  let wsPort;
  let client;
  let reporter;
  let handler;
  let hookListener;
  let detector;

  setup((done) => {
    httpServer = http.createServer();
    wss = new WebSocketServer({ server: httpServer });
    httpServer.listen(0, () => {
      wsPort = httpServer.address().port;
      done();
    });
  });

  teardown(async () => {
    if (client) client.dispose();
    if (reporter) reporter.dispose();
    if (hookListener) await hookListener.stop();
    if (detector) detector.dispose();
    await new Promise((resolve) => wss.close(() => httpServer.close(resolve)));
  });

  test('full flow: connect → state:full → state:update → command', (done) => {
    const commandManager = {
      getStates: () => [
        { name: 'Server', config: { command: 'node server.js' }, status: 'running', restartCount: 0, metrics: null },
      ],
      onDidChange: new vscode.EventEmitter().event,
      start: (name) => {
        assert.strictEqual(name, 'Server');
        done();
      },
      stop: () => {},
      restart: () => {},
      showTerminal: () => {},
    };

    client = new BridgeClient(wsPort);
    reporter = new StateReporter('test-window', commandManager, []);
    handler = new CommandHandler(commandManager);

    const messages = [];

    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        messages.push(msg);

        if (msg.type === 'connect') {
          // Client should send state:full next
        } else if (msg.type === 'state:full') {
          assert.strictEqual(msg.processes.length, 1);
          assert.strictEqual(msg.processes[0].name, 'Server');
          // Send a command back
          ws.send(JSON.stringify({ type: 'command:start', processId: 'Server' }));
        }
      });
    });

    client.onMessage((msg) => handler.handle(msg));

    client.onConnected(() => {
      client.send({ type: 'connect', windowId: 'test-window', window: { kind: 'directory', name: 'test', path: '/test', folders: [] } });
      const fullState = reporter.getFullState();
      client.send(fullState);
    });

    client.connect();
  });

  test('agent hook event flows through to state reporter', async () => {
    detector = new AgentDetector();
    hookListener = new AgentHookListener(0);
    const hookPort = await hookListener.start();

    const agentEvents = [];
    hookListener.onAgentEvent((event) => {
      detector.handleHookEvent(event);
      agentEvents.push(event);
    });

    // Simulate a Claude Code hook callback
    await new Promise((resolve, reject) => {
      const data = JSON.stringify({ agent: 'claude-code', event: 'waiting_for_input', detail: 'idle_prompt', terminalPid: 999 });
      const req = http.request({
        hostname: 'localhost', port: hookPort, path: '/agent-event', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (_res) => resolve());
      req.on('error', reject);
      req.write(data);
      req.end();
    });

    assert.strictEqual(agentEvents.length, 1);
    assert.strictEqual(agentEvents[0].agent, 'claude-code');
    assert.strictEqual(agentEvents[0].event, 'waiting_for_input');

    const agents = detector.getAgents();
    assert.strictEqual(agents.length, 1);
    assert.strictEqual(agents[0].status, 'waiting_for_input');
  });
});
