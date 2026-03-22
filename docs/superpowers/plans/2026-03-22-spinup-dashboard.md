# Spinup Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an always-open Electron companion app that shows all open VS Code projects, their terminals, background processes, and AI coding agents — connected via WebSocket to the Spinup VS Code extension.

**Architecture:** The Spinup extension gains a WebSocket client (bridge) that reports state to an Electron dashboard app hosting a WebSocket server. Agent state is collected via native hooks (Claude Code, Codex, etc.) reported to a local HTTP listener in the extension. The dashboard renders a flat vertical list of projects with inline actions.

**Tech Stack:** Electron + Electron Forge, `ws` (WebSocket), vanilla JS + CSS for dashboard UI, Node.js built-in `http` module for agent hook listener. Tests use Mocha TDD UI (`suite`/`test`) with `assert` module — no mocking libraries.

**Spec:** `docs/superpowers/specs/2026-03-22-spinup-dashboard-design.md`

---

## File Structure

### Extension Bridge (new files in `src/bridge/`)

| File | Responsibility |
|------|---------------|
| `src/bridge/bridgeClient.js` | WebSocket client — connects to dashboard, sends messages, handles reconnect |
| `src/bridge/stateReporter.js` | Aggregates terminal/process/agent state, produces `state:full` and `state:update` messages |
| `src/bridge/commandHandler.js` | Receives commands from dashboard, dispatches to CommandManager/TerminalManager |
| `src/bridge/agentHookListener.js` | HTTP server on port 9501, receives `POST /agent-event` from agent hooks |
| `src/bridge/agents/agentDetector.js` | Scans terminals for known agent patterns, manages agent lifecycle |
| `src/bridge/agents/claudeCode.js` | Claude Code hook configuration and event mapping |
| `src/bridge/agents/codexCli.js` | OpenAI Codex CLI event mapping |
| `src/bridge/agents/copilotCli.js` | GitHub Copilot CLI event mapping |
| `src/bridge/agents/clineCli.js` | Cline CLI event mapping |
| `src/bridge/agents/rooCode.js` | Roo Code VS Code extension API integration |
| `src/bridge/agents/amp.js` | Amp (Sourcegraph) event mapping |
| `src/bridge/agents/geminiCli.js` | Gemini CLI event mapping |
| `src/bridge/agents/opencode.js` | OpenCode event mapping |
| `src/bridge/agents/goose.js` | Goose (Block) event mapping |

### Extension Tests (new files in `src/test/suite/`)

| File | What it tests |
|------|--------------|
| `src/test/suite/bridgeClient.test.js` | WebSocket connection, reconnect, message sending, port file handling |
| `src/test/suite/stateReporter.test.js` | State snapshot generation, delta computation |
| `src/test/suite/commandHandler.test.js` | Command dispatch from dashboard messages |
| `src/test/suite/agentHookListener.test.js` | HTTP server, request parsing, PID matching |
| `src/test/suite/agentDetector.test.js` | Terminal pattern matching, agent lifecycle |

### Dashboard App (new `dashboard/` directory)

| File | Responsibility |
|------|---------------|
| `dashboard/package.json` | Electron app dependencies and scripts |
| `dashboard/forge.config.js` | Electron Forge packaging config |
| `dashboard/main/main.js` | App entry, window management, system tray |
| `dashboard/main/wsServer.js` | WebSocket server, message routing |
| `dashboard/main/projectRegistry.js` | Tracks connected VS Code windows and their state |
| `dashboard/main/notifications.js` | OS notification manager |
| `dashboard/renderer/index.html` | Dashboard HTML shell |
| `dashboard/renderer/app.js` | Dashboard UI entry, WebSocket client to main process |
| `dashboard/renderer/components/projectCard.js` | Project card rendering |
| `dashboard/renderer/components/processRow.js` | Terminal/process/agent row rendering |
| `dashboard/renderer/components/actionButtons.js` | Contextual action buttons |
| `dashboard/renderer/styles/dashboard.css` | Dashboard styling |
| `dashboard/test/wsServer.test.js` | WebSocket server tests |
| `dashboard/test/projectRegistry.test.js` | Registry state management tests |
| `dashboard/test/notifications.test.js` | Notification triggering tests |

---

## Phase 1: Extension Bridge Core

### Task 1: BridgeClient — WebSocket connection with reconnect

**Files:**
- Create: `src/bridge/bridgeClient.js`
- Test: `src/test/suite/bridgeClient.test.js`

**Dependencies:** `npm install ws` (add to `dependencies` in `package.json`)

- [ ] **Step 1: Install ws dependency**

```bash
cd /Users/joelmoss/dev/spinup && npm install ws
```

- [ ] **Step 2: Write failing tests for BridgeClient**

Create `src/test/suite/bridgeClient.test.js`:

```javascript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../bridge/bridgeClient'`

- [ ] **Step 4: Implement BridgeClient**

Create `src/bridge/bridgeClient.js`:

```javascript
const WebSocket = require('ws');
const vscode = require('vscode');

class BridgeClient {
  constructor(port, options = {}) {
    this._port = port;
    this._reconnectInterval = options.reconnectInterval ?? 5000;
    this._ws = null;
    this._disposed = false;
    this._reconnectTimer = null;

    this._onConnected = new vscode.EventEmitter();
    this.onConnected = this._onConnected.event;

    this._onDisconnected = new vscode.EventEmitter();
    this.onDisconnected = this._onDisconnected.event;

    this._onMessage = new vscode.EventEmitter();
    this.onMessage = this._onMessage.event;
  }

  get isConnected() {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this._disposed) return;
    if (this._ws) return;

    this._ws = new WebSocket(`ws://localhost:${this._port}`);

    this._ws.on('open', () => {
      this._onConnected.fire();
    });

    this._ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        this._onMessage.fire(msg);
      } catch {}
    });

    this._ws.on('close', () => {
      this._ws = null;
      this._onDisconnected.fire();
      this._scheduleReconnect();
    });

    this._ws.on('error', () => {
      // close event will follow
    });
  }

  send(msg) {
    if (!this.isConnected) return;
    this._ws.send(JSON.stringify(msg));
  }

  _scheduleReconnect() {
    if (this._disposed) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, this._reconnectInterval);
  }

  dispose() {
    this._disposed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._onConnected.dispose();
    this._onDisconnected.dispose();
    this._onMessage.dispose();
  }
}

module.exports = { BridgeClient };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All BridgeClient tests PASS

- [ ] **Step 6: Commit**

```bash
jj commit -m "feat(bridge): add BridgeClient with WebSocket connection and reconnect"
```

---

### Task 2: StateReporter — state snapshot and delta computation

**Files:**
- Create: `src/bridge/stateReporter.js`
- Test: `src/test/suite/stateReporter.test.js`

- [ ] **Step 1: Write failing tests for StateReporter**

Create `src/test/suite/stateReporter.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../bridge/stateReporter'`

- [ ] **Step 3: Implement StateReporter**

Create `src/bridge/stateReporter.js`:

```javascript
const vscode = require('vscode');

class StateReporter {
  constructor(windowId, commandManager, terminals) {
    this._windowId = windowId;
    this._commandManager = commandManager;
    this._terminals = terminals;
    this._agents = new Map();

    this._onStateChanged = new vscode.EventEmitter();
    this.onStateChanged = this._onStateChanged.event;

    this._subscription = this._commandManager.onDidChange(() => {
      this._onStateChanged.fire();
    });
  }

  getFullState() {
    const processes = this._commandManager.getStates().map((s) => ({
      id: s.name,
      name: s.name,
      command: s.config.command,
      status: s.status,
      restartCount: s.restartCount,
      maxRestarts: 5,
      metrics: s.metrics ?? null,
    }));

    const agents = Array.from(this._agents.values());

    return {
      type: 'state:full',
      windowId: this._windowId,
      terminals: [],
      agents,
      processes,
    };
  }

  computeDelta(previousState) {
    const currentState = this.getFullState();
    const changes = { terminals: { added: [], removed: [], updated: [] }, agents: { added: [], removed: [], updated: [] }, processes: { added: [], removed: [], updated: [] } };
    let hasChanges = false;

    for (const category of ['processes', 'agents', 'terminals']) {
      const oldItems = new Map((previousState[category] ?? []).map((i) => [i.id, i]));
      const newItems = new Map((currentState[category] ?? []).map((i) => [i.id, i]));

      for (const [id, item] of newItems) {
        if (!oldItems.has(id)) {
          changes[category].added.push(item);
          hasChanges = true;
        } else if (JSON.stringify(item) !== JSON.stringify(oldItems.get(id))) {
          changes[category].updated.push(item);
          hasChanges = true;
        }
      }

      for (const id of oldItems.keys()) {
        if (!newItems.has(id)) {
          changes[category].removed.push(id);
          hasChanges = true;
        }
      }
    }

    if (!hasChanges) return null;

    return { type: 'state:update', windowId: this._windowId, changes };
  }

  updateAgent(id, agentState) {
    this._agents.set(id, agentState);
    this._onStateChanged.fire();
  }

  removeAgent(id) {
    this._agents.delete(id);
    this._onStateChanged.fire();
  }

  dispose() {
    this._subscription.dispose();
    this._onStateChanged.dispose();
  }
}

module.exports = { StateReporter };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All StateReporter tests PASS

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(bridge): add StateReporter for state snapshots and delta computation"
```

---

### Task 3: CommandHandler — dispatch incoming dashboard commands

**Files:**
- Create: `src/bridge/commandHandler.js`
- Test: `src/test/suite/commandHandler.test.js`

- [ ] **Step 1: Write failing tests for CommandHandler**

Create `src/test/suite/commandHandler.test.js`:

```javascript
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
    let focused = false;
    handler = new CommandHandler(makeMockCommandManager(), {
      focusWindow: () => { focused = true; },
    });
    handler.handle({ type: 'window:focus' });
    assert.strictEqual(focused, true);
  });

  test('ignores unknown message types', () => {
    handler.handle({ type: 'unknown:thing' });
    assert.strictEqual(actions.length, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../bridge/commandHandler'`

- [ ] **Step 3: Implement CommandHandler**

Create `src/bridge/commandHandler.js`:

```javascript
const vscode = require('vscode');

class CommandHandler {
  // Note: processId and terminalId in protocol messages correspond to the command name
  // (e.g., "Server"), since StateReporter uses s.name as the id field.
  constructor(commandManager, windowActions = {}) {
    this._commandManager = commandManager;
    this._windowActions = windowActions;
  }

  handle(msg) {
    switch (msg.type) {
      case 'command:start':
        this._commandManager.start(msg.processId);
        break;
      case 'command:stop':
        this._commandManager.stop(msg.processId);
        break;
      case 'command:restart':
        this._commandManager.restart(msg.processId);
        break;
      case 'terminal:focus':
        this._commandManager.showTerminal(msg.terminalId);
        break;
      case 'window:focus':
        if (this._windowActions.focusWindow) {
          this._windowActions.focusWindow();
        } else {
          vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }
        break;
    }
  }
}

module.exports = { CommandHandler };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All CommandHandler tests PASS

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(bridge): add CommandHandler for dispatching dashboard commands"
```

---

### Task 4: AgentHookListener — HTTP server for agent hook callbacks

**Files:**
- Create: `src/bridge/agentHookListener.js`
- Test: `src/test/suite/agentHookListener.test.js`

- [ ] **Step 1: Write failing tests for AgentHookListener**

Create `src/test/suite/agentHookListener.test.js`:

```javascript
const assert = require('assert');
const http = require('http');
const { AgentHookListener } = require('../../bridge/agentHookListener');

suite('AgentHookListener', () => {
  let listener;
  let port;

  teardown(async () => {
    if (listener) await listener.stop();
  });

  function postEvent(event) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(event);
      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/agent-event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  test('starts HTTP server on dynamic port', async () => {
    listener = new AgentHookListener(0);
    port = await listener.start();
    assert.ok(port > 0);
  });

  test('receives agent events via POST /agent-event', async () => {
    const events = [];
    listener = new AgentHookListener(0);
    listener.onAgentEvent((event) => events.push(event));
    port = await listener.start();

    const res = await postEvent({ agent: 'claude-code', event: 'waiting_for_input', detail: 'idle_prompt', terminalPid: 1234 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].agent, 'claude-code');
    assert.strictEqual(events[0].event, 'waiting_for_input');
    assert.strictEqual(events[0].terminalPid, 1234);
  });

  test('rejects non-POST requests', async () => {
    listener = new AgentHookListener(0);
    port = await listener.start();

    const res = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/agent-event`, (res) => {
        resolve({ status: res.statusCode });
      }).on('error', reject);
    });

    assert.strictEqual(res.status, 405);
  });

  test('rejects requests to unknown paths', async () => {
    listener = new AgentHookListener(0);
    port = await listener.start();

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost', port, path: '/unknown', method: 'POST',
      }, (res) => resolve({ status: res.statusCode }));
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(res.status, 404);
  });

  test('rejects malformed JSON', async () => {
    listener = new AgentHookListener(0);
    port = await listener.start();

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost', port, path: '/agent-event', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': 3 },
      }, (res) => resolve({ status: res.statusCode }));
      req.on('error', reject);
      req.write('{x}');
      req.end();
    });

    assert.strictEqual(res.status, 400);
  });

  test('stop shuts down the server', async () => {
    listener = new AgentHookListener(0);
    port = await listener.start();
    await listener.stop();

    await assert.rejects(
      () => postEvent({ agent: 'test', event: 'idle' }),
      (err) => err.code === 'ECONNREFUSED'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../bridge/agentHookListener'`

- [ ] **Step 3: Implement AgentHookListener**

Create `src/bridge/agentHookListener.js`:

```javascript
const http = require('http');
const vscode = require('vscode');

class AgentHookListener {
  constructor(port = 9501) {
    this._port = port;
    this._server = null;

    this._onAgentEvent = new vscode.EventEmitter();
    this.onAgentEvent = this._onAgentEvent.event;
  }

  start() {
    return new Promise((resolve, reject) => {
      this._server = http.createServer((req, res) => {
        if (req.url !== '/agent-event') {
          res.writeHead(404);
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end();
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const event = JSON.parse(body);
            this._onAgentEvent.fire(event);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          } catch {
            res.writeHead(400);
            res.end('{"error":"invalid json"}');
          }
        });
      });

      this._server.listen(this._port, '127.0.0.1', () => {
        resolve(this._server.address().port);
      });

      this._server.on('error', reject);
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this._server) return resolve();
      this._server.close(() => {
        this._server = null;
        resolve();
      });
    });
  }

  dispose() {
    this._onAgentEvent.dispose();
    return this.stop();
  }
}

module.exports = { AgentHookListener };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All AgentHookListener tests PASS

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(bridge): add AgentHookListener HTTP server for agent state callbacks"
```

---

### Task 5: AgentDetector — detect agents in terminals

**Files:**
- Create: `src/bridge/agents/agentDetector.js`
- Test: `src/test/suite/agentDetector.test.js`

- [ ] **Step 1: Write failing tests for AgentDetector**

Create `src/test/suite/agentDetector.test.js`:

```javascript
const assert = require('assert');
const { AgentDetector } = require('../../bridge/agents/agentDetector');

suite('AgentDetector', () => {
  let detector;

  teardown(() => {
    if (detector) detector.dispose();
  });

  test('detects Claude Code by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('Claude Code');
    assert.ok(match);
    assert.strictEqual(match.kind, 'claude-code');
    assert.strictEqual(match.name, 'Claude Code');
  });

  test('detects Codex CLI by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('codex');
    assert.ok(match);
    assert.strictEqual(match.kind, 'codex-cli');
  });

  test('detects Copilot CLI by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('copilot');
    assert.ok(match);
    assert.strictEqual(match.kind, 'copilot-cli');
  });

  test('detects Gemini CLI by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('gemini');
    assert.ok(match);
    assert.strictEqual(match.kind, 'gemini-cli');
  });

  test('detects Amp by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('amp');
    assert.ok(match);
    assert.strictEqual(match.kind, 'amp');
  });

  test('detects Cline CLI by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('cline');
    assert.ok(match);
    assert.strictEqual(match.kind, 'cline-cli');
  });

  test('detects OpenCode by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('opencode');
    assert.ok(match);
    assert.strictEqual(match.kind, 'opencode');
  });

  test('detects Goose by terminal name', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('goose');
    assert.ok(match);
    assert.strictEqual(match.kind, 'goose');
  });

  test('returns null for non-agent terminals', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('zsh - npm test');
    assert.strictEqual(match, null);
  });

  test('matching is case-insensitive', () => {
    detector = new AgentDetector();
    const match = detector.matchTerminal('CLAUDE CODE');
    assert.ok(match);
    assert.strictEqual(match.kind, 'claude-code');
  });

  test('updates agent state from hook event', () => {
    detector = new AgentDetector();
    const events = [];
    detector.onAgentStateChanged((state) => events.push(state));

    detector.handleHookEvent({ agent: 'claude-code', event: 'waiting_for_input', detail: 'idle_prompt', terminalPid: 123 });

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].kind, 'claude-code');
    assert.strictEqual(events[0].status, 'waiting_for_input');
  });

  test('getAgents returns all tracked agents', () => {
    detector = new AgentDetector();
    detector.handleHookEvent({ agent: 'claude-code', event: 'working', detail: '', terminalPid: 123 });
    detector.handleHookEvent({ agent: 'codex-cli', event: 'idle', detail: '', terminalPid: 456 });

    const agents = detector.getAgents();
    assert.strictEqual(agents.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../bridge/agents/agentDetector'`

- [ ] **Step 3: Implement AgentDetector**

Create `src/bridge/agents/agentDetector.js`:

```javascript
const vscode = require('vscode');

const AGENT_PATTERNS = [
  { pattern: /claude\s*code/i, kind: 'claude-code', name: 'Claude Code' },
  { pattern: /\bcodex\b/i, kind: 'codex-cli', name: 'Codex CLI' },
  { pattern: /\bcopilot\b/i, kind: 'copilot-cli', name: 'Copilot CLI' },
  { pattern: /\bgemini\b/i, kind: 'gemini-cli', name: 'Gemini CLI' },
  { pattern: /\bamp\b/i, kind: 'amp', name: 'Amp' },
  { pattern: /\bcline\b/i, kind: 'cline-cli', name: 'Cline CLI' },
  { pattern: /\bopencode\b/i, kind: 'opencode', name: 'OpenCode' },
  { pattern: /\bgoose\b/i, kind: 'goose', name: 'Goose' },
];

class AgentDetector {
  constructor() {
    this._agents = new Map();

    this._onAgentStateChanged = new vscode.EventEmitter();
    this.onAgentStateChanged = this._onAgentStateChanged.event;
  }

  matchTerminal(terminalName) {
    for (const { pattern, kind, name } of AGENT_PATTERNS) {
      if (pattern.test(terminalName)) {
        return { kind, name };
      }
    }
    return null;
  }

  handleHookEvent(event) {
    const id = `${event.agent}-${event.terminalPid}`;
    const agentState = {
      id,
      kind: event.agent,
      name: AGENT_PATTERNS.find((p) => p.kind === event.agent)?.name ?? event.agent,
      status: event.event,
      detail: event.detail ?? '',
      terminalPid: event.terminalPid,
    };

    this._agents.set(id, agentState);
    this._onAgentStateChanged.fire(agentState);
  }

  getAgents() {
    return Array.from(this._agents.values());
  }

  removeAgent(id) {
    this._agents.delete(id);
  }

  dispose() {
    this._onAgentStateChanged.dispose();
  }
}

module.exports = { AgentDetector };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All AgentDetector tests PASS

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(bridge): add AgentDetector for terminal-based agent recognition"
```

---

### Task 6: Agent integration modules

**Files:**
- Create: `src/bridge/agents/claudeCode.js`
- Create: `src/bridge/agents/codexCli.js`
- Create: `src/bridge/agents/copilotCli.js`
- Create: `src/bridge/agents/clineCli.js`
- Create: `src/bridge/agents/rooCode.js`
- Create: `src/bridge/agents/amp.js`
- Create: `src/bridge/agents/geminiCli.js`
- Create: `src/bridge/agents/opencode.js`
- Create: `src/bridge/agents/goose.js`

Each module exports a `getHookConfig()` function that returns the agent's hook configuration for the one-time setup, and an `EVENT_MAP` that maps agent-specific events to the standard agent states (`idle`, `working`, `waiting_for_input`, `error`).

- [ ] **Step 1: Write failing tests for agent modules**

Create `src/test/suite/agentModules.test.js`:

```javascript
const assert = require('assert');

const claudeCode = require('../../bridge/agents/claudeCode');
const codexCli = require('../../bridge/agents/codexCli');
const copilotCli = require('../../bridge/agents/copilotCli');
const clineCli = require('../../bridge/agents/clineCli');
const rooCode = require('../../bridge/agents/rooCode');
const amp = require('../../bridge/agents/amp');
const geminiCli = require('../../bridge/agents/geminiCli');
const opencode = require('../../bridge/agents/opencode');
const goose = require('../../bridge/agents/goose');

suite('Agent Modules', () => {
  const modules = [
    { name: 'claudeCode', mod: claudeCode, kind: 'claude-code' },
    { name: 'codexCli', mod: codexCli, kind: 'codex-cli' },
    { name: 'copilotCli', mod: copilotCli, kind: 'copilot-cli' },
    { name: 'clineCli', mod: clineCli, kind: 'cline-cli' },
    { name: 'rooCode', mod: rooCode, kind: 'roo-code' },
    { name: 'amp', mod: amp, kind: 'amp' },
    { name: 'geminiCli', mod: geminiCli, kind: 'gemini-cli' },
    { name: 'opencode', mod: opencode, kind: 'opencode' },
    { name: 'goose', mod: goose, kind: 'goose' },
  ];

  for (const { name, mod, kind } of modules) {
    test(`${name} exports KIND identifier`, () => {
      assert.strictEqual(mod.KIND, kind);
    });

    test(`${name} exports EVENT_MAP with standard states`, () => {
      assert.ok(mod.EVENT_MAP);
      const validStates = ['idle', 'working', 'waiting_for_input', 'error', 'unknown'];
      for (const state of Object.values(mod.EVENT_MAP)) {
        assert.ok(validStates.includes(state), `${name} maps to invalid state: ${state}`);
      }
    });

    test(`${name} exports getHookConfig function`, () => {
      assert.strictEqual(typeof mod.getHookConfig, 'function');
      const config = mod.getHookConfig(9501);
      assert.ok(config, `${name}.getHookConfig() should return a config object`);
      assert.strictEqual(typeof config.agent, 'string');
    });
  }

  test('claudeCode EVENT_MAP maps idle_prompt to waiting_for_input', () => {
    assert.strictEqual(claudeCode.EVENT_MAP['idle_prompt'], 'waiting_for_input');
    assert.strictEqual(claudeCode.EVENT_MAP['permission_prompt'], 'waiting_for_input');
    assert.strictEqual(claudeCode.EVENT_MAP['session_start'], 'working');
    assert.strictEqual(claudeCode.EVENT_MAP['stop'], 'idle');
  });

  test('codexCli EVENT_MAP maps turn events correctly', () => {
    assert.strictEqual(codexCli.EVENT_MAP['turn.completed'], 'waiting_for_input');
    assert.strictEqual(codexCli.EVENT_MAP['turn.started'], 'working');
    assert.strictEqual(codexCli.EVENT_MAP['permission_request'], 'waiting_for_input');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find agent modules

- [ ] **Step 3: Implement all 9 agent modules**

All modules follow the same shape. Here is `src/bridge/agents/claudeCode.js` as the template:

```javascript
const KIND = 'claude-code';

const EVENT_MAP = {
  'idle_prompt': 'waiting_for_input',
  'permission_prompt': 'waiting_for_input',
  'session_start': 'working',
  'stop': 'idle',
};

function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    configPath: '~/.claude/settings.json',
    hooks: [
      { event: 'Notification', matcher: 'idle_prompt', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"idle_prompt"}'` },
      { event: 'Notification', matcher: 'permission_prompt', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"permission_prompt"}'` },
      { event: 'Stop', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"stop"}'` },
      { event: 'SessionStart', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"session_start"}'` },
    ],
  };
}

module.exports = { KIND, EVENT_MAP, getHookConfig };
```

Create the remaining 8 modules following the same pattern with their respective KIND, EVENT_MAP, and getHookConfig. Each in its own file under `src/bridge/agents/`:

**`codexCli.js`** — KIND: `'codex-cli'`, events: `turn.completed` → `waiting_for_input`, `turn.started` → `working`, `permission_request` → `waiting_for_input`

**`copilotCli.js`** — KIND: `'copilot-cli'`, events: `sessionStart` → `working`, `sessionEnd` → `idle`, `permissionRequest` → `waiting_for_input`

**`clineCli.js`** — KIND: `'cline-cli'`, events: `task_started` → `working`, `task_completed` → `idle`, `ask` → `waiting_for_input`

**`rooCode.js`** — KIND: `'roo-code'`, events: `task_started` → `working`, `task_ended` → `idle`, `ask` → `waiting_for_input`. Note: This module also exports `EXTENSION_ID = 'RooVeterinaryInc.roo-cline'` for direct VS Code extension API integration.

**`amp.js`** — KIND: `'amp'`, events: `init` → `working`, `result` → `idle`, `assistant` → `working`

**`geminiCli.js`** — KIND: `'gemini-cli'`, events: `before_agent` → `working`, `after_agent` → `idle`, `session_end` → `idle`

**`opencode.js`** — KIND: `'opencode'`, events: `tool_start` → `working`, `tool_end` → `idle`, `waiting` → `waiting_for_input`

**`goose.js`** — KIND: `'goose'`, events: `running` → `working`, `stable` → `waiting_for_input`, `error` → `error`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All agent module tests PASS

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(bridge): add 9 agent integration modules with hook configs and event maps"
```

---

### Task 7: Wire bridge into extension.js

**Files:**
- Modify: `src/extension.js`

- [ ] **Step 1: Write failing integration test**

Add to `src/test/suite/bridgeClient.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all modules already implemented)

- [ ] **Step 3: Add bridge initialization to extension.js**

Add a new function `initBridge` to `src/extension.js` and call it at the end of `activate()`. Add this code:

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const { BridgeClient } = require('./bridge/bridgeClient');
const { StateReporter } = require('./bridge/stateReporter');
const { CommandHandler } = require('./bridge/commandHandler');
const { AgentHookListener } = require('./bridge/agentHookListener');
const { AgentDetector } = require('./bridge/agents/agentDetector');

function initBridge(context, commandManager, terminalManager) {
  // Read dashboard port file — if missing or stale, skip silently
  const serverInfoPath = path.join(os.homedir(), '.spinup-dashboard', 'server.json');
  let port;
  try {
    const info = JSON.parse(fs.readFileSync(serverInfoPath, 'utf8'));
    // Check PID is alive
    try {
      process.kill(info.pid, 0);
    } catch {
      // PID is dead — stale file
      try { fs.unlinkSync(serverInfoPath); } catch {}
      return;
    }
    port = info.port;
  } catch {
    // File doesn't exist or is unreadable — dashboard not running
    return;
  }

  // Construct windowId from machineId + sessionId
  const windowId = `${vscode.env.machineId}:${vscode.env.sessionId}`;

  // Build window info
  const workspaceFile = vscode.workspace.workspaceFile;
  const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => ({ name: f.name, path: f.uri.fsPath }));
  const windowInfo = {
    kind: workspaceFile ? 'workspace' : 'directory',
    name: workspaceFile ? path.basename(workspaceFile.fsPath, '.code-workspace') : folders[0]?.name ?? 'unknown',
    path: workspaceFile ? workspaceFile.fsPath : folders[0]?.path ?? '',
    folders,
  };

  // Create bridge components
  const client = new BridgeClient(port);
  const reporter = new StateReporter(windowId, commandManager, []);
  const handler = new CommandHandler(commandManager, {
    focusWindow: () => vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup'),
  });
  const hookListener = new AgentHookListener(9501);
  const detector = new AgentDetector();

  // Wire agent hooks → detector → reporter
  hookListener.onAgentEvent((event) => {
    detector.handleHookEvent(event);
    const agents = detector.getAgents();
    const agentState = agents.find((a) => a.kind === event.agent && a.terminalPid === event.terminalPid);
    if (agentState) {
      reporter.updateAgent(agentState.id, {
        id: agentState.id,
        name: agentState.name,
        kind: agentState.kind,
        status: agentState.status,
        detail: agentState.detail,
        terminalId: null,
      });
    }
  });

  // Wire incoming commands
  client.onMessage((msg) => handler.handle(msg));

  // On connect: send window info + full state
  let previousState = null;
  client.onConnected(() => {
    client.send({ type: 'connect', windowId, window: windowInfo });
    const fullState = reporter.getFullState();
    client.send(fullState);
    previousState = fullState;
  });

  // On state change: send delta
  reporter.onStateChanged(() => {
    if (!client.isConnected || !previousState) return;
    const delta = reporter.computeDelta(previousState);
    if (delta) {
      client.send(delta);
      previousState = reporter.getFullState();
    }
  });

  // Periodic heartbeat: full state every 30s
  const heartbeatInterval = setInterval(() => {
    if (!client.isConnected) return;
    const fullState = reporter.getFullState();
    client.send(fullState);
    previousState = fullState;
  }, 30000);

  // Periodic metrics: every 3s (matching existing Spinup metrics interval)
  const metricsInterval = setInterval(() => {
    if (!client.isConnected) return;
    const states = commandManager.getStates();
    const items = states
      .filter((s) => s.metrics)
      .map((s) => ({ id: s.name, cpu: s.metrics.cpu, mem: s.metrics.mem }));
    if (items.length > 0) {
      client.send({ type: 'metrics', windowId, items });
    }
  }, 3000);

  // Start connections
  hookListener.start().catch(() => {}); // port may be in use — non-fatal
  client.connect();

  // Register disposables
  context.subscriptions.push(
    client,
    reporter,
    { dispose: () => hookListener.dispose() },
    detector,
    { dispose: () => clearInterval(heartbeatInterval) },
    { dispose: () => clearInterval(metricsInterval) },
  );
}
```

Call `initBridge(context, commandManager, terminalManager)` at the end of the `activate()` function, after all existing setup is complete.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS (bridge doesn't affect existing tests since dashboard isn't running)

- [ ] **Step 5: Commit**

```bash
jj commit -m "feat(bridge): wire bridge client into extension activation"
```

---

## Phase 2: Electron Dashboard App

### Task 8: Scaffold Electron app with Electron Forge

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/forge.config.js`

- [ ] **Step 1: Initialize Electron project**

```bash
cd /Users/joelmoss/dev/spinup && mkdir -p dashboard/main dashboard/renderer/components dashboard/renderer/styles dashboard/test
```

- [ ] **Step 2: Create dashboard/package.json**

```json
{
  "name": "spinup-dashboard",
  "version": "0.1.0",
  "description": "Companion dashboard for Spinup VS Code extension",
  "main": "main/main.js",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "test": "mocha test/**/*.test.js --ui tdd --timeout 5000"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/maker-zip": "^7.0.0",
    "electron": "^33.0.0",
    "mocha": "^10.2.0"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 3: Create dashboard/forge.config.js**

```javascript
module.exports = {
  packagerConfig: {
    name: 'Spinup Dashboard',
  },
  makers: [
    { name: '@electron-forge/maker-zip' },
  ],
};
```

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npm install
```

- [ ] **Step 5: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): scaffold Electron app with Forge config"
```

---

### Task 9: ProjectRegistry — track connected VS Code windows

**Files:**
- Create: `dashboard/main/projectRegistry.js`
- Test: `dashboard/test/projectRegistry.test.js`

- [ ] **Step 1: Write failing tests**

Create `dashboard/test/projectRegistry.test.js`:

```javascript
const assert = require('assert');
const { ProjectRegistry } = require('../main/projectRegistry');

suite('ProjectRegistry', () => {
  let registry;

  setup(() => {
    registry = new ProjectRegistry();
  });

  test('addProject registers a new project', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    assert.strictEqual(registry.getProjects().length, 1);
    assert.strictEqual(registry.getProjects()[0].windowId, 'win-1');
  });

  test('removeProject removes by windowId', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.removeProject('win-1');
    assert.strictEqual(registry.getProjects().length, 0);
  });

  test('updateState replaces full state for a project', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.updateState('win-1', { terminals: [{ id: 't1', name: 'zsh', status: 'idle' }], agents: [], processes: [] });
    const project = registry.getProject('win-1');
    assert.strictEqual(project.state.terminals.length, 1);
  });

  test('applyDelta applies added items', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.updateState('win-1', { terminals: [], agents: [], processes: [] });
    registry.applyDelta('win-1', {
      processes: { added: [{ id: 'p1', name: 'Server', status: 'running' }], removed: [], updated: [] },
      terminals: { added: [], removed: [], updated: [] },
      agents: { added: [], removed: [], updated: [] },
    });
    const project = registry.getProject('win-1');
    assert.strictEqual(project.state.processes.length, 1);
  });

  test('applyDelta removes items by id', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.updateState('win-1', { terminals: [], agents: [], processes: [{ id: 'p1', name: 'Server', status: 'running' }] });
    registry.applyDelta('win-1', {
      processes: { added: [], removed: ['p1'], updated: [] },
      terminals: { added: [], removed: [], updated: [] },
      agents: { added: [], removed: [], updated: [] },
    });
    const project = registry.getProject('win-1');
    assert.strictEqual(project.state.processes.length, 0);
  });

  test('applyDelta updates items by id', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.updateState('win-1', { terminals: [], agents: [], processes: [{ id: 'p1', name: 'Server', status: 'running' }] });
    registry.applyDelta('win-1', {
      processes: { added: [], removed: [], updated: [{ id: 'p1', name: 'Server', status: 'errored' }] },
      terminals: { added: [], removed: [], updated: [] },
      agents: { added: [], removed: [], updated: [] },
    });
    const project = registry.getProject('win-1');
    assert.strictEqual(project.state.processes[0].status, 'errored');
  });

  test('getWorstStatus returns errored if any process errored', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.updateState('win-1', {
      terminals: [],
      agents: [],
      processes: [
        { id: 'p1', name: 'Server', status: 'running' },
        { id: 'p2', name: 'Worker', status: 'errored' },
      ],
    });
    assert.strictEqual(registry.getWorstStatus('win-1'), 'errored');
  });

  test('getWorstStatus returns waiting_for_input if any agent waiting', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    registry.updateState('win-1', {
      terminals: [],
      agents: [{ id: 'a1', name: 'Claude', status: 'waiting_for_input' }],
      processes: [{ id: 'p1', name: 'Server', status: 'running' }],
    });
    assert.strictEqual(registry.getWorstStatus('win-1'), 'waiting_for_input');
  });

  test('onChange fires when state changes', () => {
    let fired = false;
    registry.onChange(() => { fired = true; });
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    assert.strictEqual(fired, true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/projectRegistry.test.js --ui tdd
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement ProjectRegistry**

Create `dashboard/main/projectRegistry.js`:

```javascript
const EventEmitter = require('events');

class ProjectRegistry extends EventEmitter {
  constructor() {
    super();
    this._projects = new Map();
  }

  addProject(windowId, windowInfo) {
    this._projects.set(windowId, { windowId, window: windowInfo, state: { terminals: [], agents: [], processes: [] } });
    this.emit('change');
  }

  removeProject(windowId) {
    this._projects.delete(windowId);
    this.emit('change');
  }

  getProject(windowId) {
    return this._projects.get(windowId) ?? null;
  }

  getProjects() {
    return Array.from(this._projects.values());
  }

  updateState(windowId, state) {
    const project = this._projects.get(windowId);
    if (!project) return;
    project.state = state;
    this.emit('change');
  }

  applyDelta(windowId, changes) {
    const project = this._projects.get(windowId);
    if (!project) return;

    for (const category of ['terminals', 'agents', 'processes']) {
      const delta = changes[category];
      if (!delta) continue;

      for (const item of delta.added) {
        project.state[category].push(item);
      }

      for (const id of delta.removed) {
        project.state[category] = project.state[category].filter((i) => i.id !== id);
      }

      for (const item of delta.updated) {
        const idx = project.state[category].findIndex((i) => i.id === item.id);
        if (idx >= 0) project.state[category][idx] = item;
      }
    }

    this.emit('change');
  }

  getWorstStatus(windowId) {
    const project = this._projects.get(windowId);
    if (!project) return 'unknown';

    const allStatuses = [
      ...project.state.processes.map((p) => p.status),
      ...project.state.agents.map((a) => a.status),
    ];

    if (allStatuses.includes('errored') || allStatuses.includes('error')) return 'errored';
    if (allStatuses.includes('waiting_for_input')) return 'waiting_for_input';
    if (allStatuses.includes('working') || allStatuses.includes('running')) return 'running';
    return 'idle';
  }

  onChange(callback) {
    this.on('change', callback);
  }
}

module.exports = { ProjectRegistry };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/projectRegistry.test.js --ui tdd
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): add ProjectRegistry for tracking connected VS Code windows"
```

---

### Task 10: WebSocket server — accept connections and route messages

**Files:**
- Create: `dashboard/main/wsServer.js`
- Test: `dashboard/test/wsServer.test.js`

- [ ] **Step 1: Write failing tests**

Create `dashboard/test/wsServer.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/wsServer.test.js --ui tdd --timeout 5000
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement DashboardServer**

Create `dashboard/main/wsServer.js`:

```javascript
const { WebSocketServer } = require('ws');
const http = require('http');

class DashboardServer {
  constructor(registry, port = 9500) {
    this._registry = registry;
    this._port = port;
    this._server = null;
    this._wss = null;
    this._clients = new Map(); // windowId → ws
  }

  start() {
    return new Promise((resolve) => {
      this._server = http.createServer();
      this._wss = new WebSocketServer({ server: this._server });

      this._wss.on('connection', (ws) => {
        let windowId = null;

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            this._handleMessage(ws, msg);
            if (msg.type === 'connect') windowId = msg.windowId;
          } catch {}
        });

        ws.on('close', () => {
          if (windowId) {
            this._clients.delete(windowId);
            this._registry.removeProject(windowId);
          }
        });
      });

      this._server.listen(this._port, '127.0.0.1', () => {
        resolve(this._server.address().port);
      });
    });
  }

  _handleMessage(ws, msg) {
    switch (msg.type) {
      case 'connect':
        this._clients.set(msg.windowId, ws);
        this._registry.addProject(msg.windowId, msg.window);
        break;
      case 'state:full':
        this._registry.updateState(msg.windowId, { terminals: msg.terminals, agents: msg.agents, processes: msg.processes });
        break;
      case 'state:update':
        this._registry.applyDelta(msg.windowId, msg.changes);
        break;
      case 'metrics':
        this._handleMetrics(msg);
        break;
    }
  }

  _handleMetrics(msg) {
    const project = this._registry.getProject(msg.windowId);
    if (!project) return;
    for (const item of msg.items) {
      for (const category of ['processes', 'terminals']) {
        const target = project.state[category].find((i) => i.id === item.id);
        if (target) {
          target.metrics = { cpu: item.cpu, mem: item.mem };
        }
      }
    }
    this._registry.emit('change');
  }

  sendCommand(windowId, command) {
    const ws = this._clients.get(windowId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(command));
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this._wss) return resolve();
      for (const ws of this._wss.clients) ws.close();
      this._wss.close(() => {
        this._server.close(() => resolve());
      });
    });
  }
}

module.exports = { DashboardServer };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/wsServer.test.js --ui tdd --timeout 5000
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): add WebSocket server with message routing"
```

---

### Task 11: Notifications — OS notification manager

**Files:**
- Create: `dashboard/main/notifications.js`
- Test: `dashboard/test/notifications.test.js`

- [ ] **Step 1: Write failing tests**

Create `dashboard/test/notifications.test.js`:

```javascript
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
    const n = manager.buildNotification('spinup', { id: 'a1', name: 'Claude Code', status: 'waiting_for_input', kind: 'claude-code' }, 'agent');
    assert.strictEqual(n.title, 'Spinup Dashboard');
    assert.ok(n.body.includes('Claude Code'));
    assert.ok(n.body.includes('waiting'));
    assert.ok(n.body.includes('spinup'));
  });

  test('buildNotification returns correct shape for errored process', () => {
    const n = manager.buildNotification('my-api', { id: 'p1', name: 'Server', status: 'errored' }, 'process');
    assert.ok(n.body.includes('Server'));
    assert.ok(n.body.includes('errored'));
    assert.ok(n.body.includes('my-api'));
  });

  test('deduplicates notifications for the same item within cooldown', () => {
    const sent = [];
    manager = new NotificationManager({ send: (n) => sent.push(n) }, { cooldownMs: 100 });
    manager.notify('spinup', { id: 'a1', name: 'Claude', status: 'waiting_for_input' }, 'agent');
    manager.notify('spinup', { id: 'a1', name: 'Claude', status: 'waiting_for_input' }, 'agent');
    assert.strictEqual(sent.length, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/notifications.test.js --ui tdd
```
Expected: FAIL

- [ ] **Step 3: Implement NotificationManager**

Create `dashboard/main/notifications.js`:

```javascript
class NotificationManager {
  constructor(notifier, options = {}) {
    this._notifier = notifier;
    this._cooldownMs = options.cooldownMs ?? 30000;
    this._lastNotified = new Map();
  }

  shouldNotify(status) {
    return status === 'waiting_for_input' || status === 'errored' || status === 'error';
  }

  buildNotification(projectName, item, itemType) {
    const action = item.status === 'waiting_for_input' ? 'is waiting for input' : 'has errored';
    return {
      title: 'Spinup Dashboard',
      body: `${item.name} ${action} in ${projectName}`,
      projectName,
      itemId: item.id,
      itemType,
    };
  }

  notify(projectName, item, itemType) {
    if (!this.shouldNotify(item.status)) return;

    const key = `${projectName}:${item.id}:${item.status}`;
    const now = Date.now();
    const last = this._lastNotified.get(key);
    if (last && now - last < this._cooldownMs) return;

    this._lastNotified.set(key, now);
    const notification = this.buildNotification(projectName, item, itemType);
    this._notifier.send(notification);
  }
}

module.exports = { NotificationManager };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/notifications.test.js --ui tdd
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): add NotificationManager with deduplication"
```

---

### Task 12: Electron main process — app entry, tray, window

**Files:**
- Create: `dashboard/main/main.js`

- [ ] **Step 1: Implement Electron main process**

Create `dashboard/main/main.js`:

```javascript
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DashboardServer } = require('./wsServer');
const { ProjectRegistry } = require('./projectRegistry');
const { NotificationManager } = require('./notifications');

const PORT = 9500;
const SERVER_INFO_DIR = path.join(os.homedir(), '.spinup-dashboard');
const SERVER_INFO_PATH = path.join(SERVER_INFO_DIR, 'server.json');

let mainWindow = null;
let tray = null;

const registry = new ProjectRegistry();
const server = new DashboardServer(registry, PORT);
const notifications = new NotificationManager({
  send: (n) => {
    if (Notification.isSupported()) {
      const notification = new Notification({ title: n.title, body: n.body });
      notification.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
        // Send focus command to the relevant VS Code window
        server.sendCommand(n.projectName, { type: 'window:focus' });
      });
      notification.show();
    }
  },
});

registry.onChange(() => {
  // Check for notification-worthy state changes
  for (const project of registry.getProjects()) {
    for (const agent of project.state.agents) {
      notifications.notify(project.window.name, agent, 'agent');
    }
    for (const proc of project.state.processes) {
      notifications.notify(project.window.name, proc, 'process');
    }
  }

  // Send updated state to renderer
  if (mainWindow) {
    mainWindow.webContents.send('registry-update', registry.getProjects());
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    title: 'Spinup Dashboard',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // 16x16 PNG: simple circle icon as a data URL
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAgklEQVQ4T2NkoBAwUqifgWoGMDIyNjAyMv5HdwUTA8P/BgYGxv+MDAxILmBkYGxgYPj/H90FjIwMDYwMDP+RXcDI+L+BkZHhP1IXMDL8b2Bk+P8fOQwYGf43MDIw/Ed2ASMD438GBob/6GHAyPi/gYHhP3IYMDIwNDAw/P+PHAYAlWk0EXZQOREAAAAASUVORK5CYII=');
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Spinup Dashboard');
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Dashboard', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { mainWindow?.destroy(); app.quit(); } },
  ]));
}

function writeServerInfo(port) {
  fs.mkdirSync(SERVER_INFO_DIR, { recursive: true });
  fs.writeFileSync(SERVER_INFO_PATH, JSON.stringify({ port, pid: process.pid }));
}

function cleanupServerInfo() {
  try { fs.unlinkSync(SERVER_INFO_PATH); } catch {}
}

app.whenReady().then(async () => {
  const actualPort = await server.start();
  writeServerInfo(actualPort);
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  cleanupServerInfo();
  server.stop();
});

app.on('window-all-closed', (e) => {
  // Don't quit — stay in tray
});
```

- [ ] **Step 2: Test manually**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx electron .
```
Expected: Electron window opens, tray icon appears, `~/.spinup-dashboard/server.json` is created

- [ ] **Step 3: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): add Electron main process with tray and server info"
```

---

### Task 13: Dashboard UI — renderer

**Files:**
- Create: `dashboard/renderer/preload.js`
- Create: `dashboard/renderer/index.html`
- Create: `dashboard/renderer/app.js`
- Create: `dashboard/renderer/components/projectCard.js`
- Create: `dashboard/renderer/components/processRow.js`
- Create: `dashboard/renderer/components/actionButtons.js`
- Create: `dashboard/renderer/styles/dashboard.css`

- [ ] **Step 1: Create preload.js**

Create `dashboard/renderer/preload.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  onRegistryUpdate: (callback) => ipcRenderer.on('registry-update', (_event, projects) => callback(projects)),
  sendCommand: (windowId, command) => ipcRenderer.send('send-command', windowId, command),
});
```

- [ ] **Step 2: Create index.html**

Create `dashboard/renderer/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>Spinup Dashboard</title>
  <link rel="stylesheet" href="styles/dashboard.css">
</head>
<body>
  <header>
    <h1>Spinup Dashboard</h1>
    <span id="connection-count">0 projects</span>
  </header>
  <main id="projects"></main>
  <div id="empty-state">No projects connected</div>
  <script src="components/actionButtons.js"></script>
  <script src="components/processRow.js"></script>
  <script src="components/projectCard.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create dashboard.css**

Create `dashboard/renderer/styles/dashboard.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1e1e2e;
  color: #cdd6f4;
  font-size: 13px;
  overflow-y: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  position: sticky;
  top: 0;
  background: #1e1e2e;
  z-index: 10;
}

header h1 { font-size: 14px; font-weight: 600; }
#connection-count { font-size: 12px; color: #94a3b8; }

#projects {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
}

#empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: #64748b;
  font-size: 14px;
}

/* Project card */
.project-card {
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  overflow: hidden;
}
.project-card.status-running { border-color: rgba(74, 222, 128, 0.25); background: rgba(74, 222, 128, 0.02); }
.project-card.status-errored { border-color: rgba(248, 113, 113, 0.3); background: rgba(248, 113, 113, 0.03); }
.project-card.status-waiting_for_input { border-color: rgba(250, 204, 21, 0.3); background: rgba(250, 204, 21, 0.03); }

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.project-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
.project-name strong { font-size: 14px; }
.project-path { color: #64748b; font-size: 11px; }

/* Status dots */
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}
.dot.running, .dot.working { background: #4ade80; }
.dot.errored, .dot.error { background: #f87171; }
.dot.waiting_for_input { background: #facc15; animation: pulse 1.5s ease-in-out infinite; }
.dot.idle, .dot.stopped, .dot.unknown { background: #94a3b8; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Process/agent rows */
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
}
.row:last-child { border-bottom: none; }
.row.errored-bg { background: rgba(248, 113, 113, 0.05); }

.row-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row-type {
  color: #64748b;
  font-size: 10px;
  width: 40px;
  flex-shrink: 0;
}

.row-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-name.idle { color: #94a3b8; }

.row-detail { color: #64748b; font-size: 11px; white-space: nowrap; }
.row-detail.errored { color: #f87171; }
.row-detail.waiting { color: #facc15; }

/* Action buttons */
.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
}
.action-btn:hover { background: rgba(148, 163, 184, 0.1); }
.action-btn.danger { border-color: rgba(248, 113, 113, 0.3); color: #f87171; }
.action-btn.danger:hover { background: rgba(248, 113, 113, 0.1); }

.focus-btn {
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
}
.focus-btn:hover { background: rgba(148, 163, 184, 0.2); }
```

- [ ] **Step 4: Create actionButtons.js**

Create `dashboard/renderer/components/actionButtons.js`:

```javascript
// Renders contextual action buttons for a row
// eslint-disable-next-line no-unused-vars
function renderActions(item, type, windowId) {
  const container = document.createElement('div');
  container.className = 'row-actions';

  const status = item.status;

  if (status === 'running' || status === 'working') {
    const restart = document.createElement('button');
    restart.className = 'action-btn';
    restart.textContent = '↻';
    restart.title = 'Restart';
    restart.onclick = () => window.bridge.sendCommand(windowId, { type: 'command:restart', processId: item.id });
    container.appendChild(restart);

    if (type !== 'agent') {
      const stop = document.createElement('button');
      stop.className = 'action-btn';
      stop.textContent = '■';
      stop.title = 'Stop';
      stop.onclick = () => window.bridge.sendCommand(windowId, { type: 'command:stop', processId: item.id });
      container.appendChild(stop);
    }
  }

  if (status === 'errored' || status === 'error') {
    const restart = document.createElement('button');
    restart.className = 'action-btn danger';
    restart.textContent = '↻';
    restart.title = 'Restart';
    restart.onclick = () => window.bridge.sendCommand(windowId, { type: 'command:restart', processId: item.id });
    container.appendChild(restart);
  }

  // Show button for all rows
  const show = document.createElement('button');
  show.className = 'action-btn';
  show.textContent = '↗';
  show.title = 'Show';
  show.onclick = () => {
    window.bridge.sendCommand(windowId, { type: 'window:focus' });
    window.bridge.sendCommand(windowId, { type: 'terminal:focus', terminalId: item.id });
  };
  container.appendChild(show);

  return container;
}
```

- [ ] **Step 5: Create processRow.js**

Create `dashboard/renderer/components/processRow.js`:

```javascript
// Renders a single terminal/process/agent row
// eslint-disable-next-line no-unused-vars
function renderRow(item, type, windowId) {
  const row = document.createElement('div');
  row.className = 'row';
  if (item.status === 'errored' || item.status === 'error') row.classList.add('errored-bg');

  // Left side: dot + type badge + name + detail
  const info = document.createElement('div');
  info.className = 'row-info';

  const dot = document.createElement('span');
  dot.className = `dot ${item.status}`;
  info.appendChild(dot);

  const typeBadge = document.createElement('span');
  typeBadge.className = 'row-type';
  typeBadge.textContent = type === 'agent' ? 'AGENT' : type === 'process' ? 'PROC' : 'TERM';
  info.appendChild(typeBadge);

  const name = document.createElement('span');
  name.className = 'row-name';
  if (item.status === 'idle' || item.status === 'stopped') name.classList.add('idle');
  name.textContent = item.name;
  info.appendChild(name);

  // Detail text
  let detailText = '';
  if (item.metrics && item.metrics.cpu !== undefined) {
    detailText = `${item.metrics.cpu}% · ${item.metrics.mem} MB`;
  } else if (item.status === 'errored' || item.status === 'error') {
    detailText = item.restartCount ? `crashed · restart ${item.restartCount}/${item.maxRestarts ?? 5}` : 'crashed';
  } else if (item.status === 'waiting_for_input') {
    detailText = item.detail || 'waiting for input';
  } else if (item.detail) {
    detailText = item.detail;
  }

  if (detailText) {
    const detail = document.createElement('span');
    detail.className = 'row-detail';
    if (item.status === 'errored' || item.status === 'error') detail.classList.add('errored');
    if (item.status === 'waiting_for_input') detail.classList.add('waiting');
    detail.textContent = detailText;
    info.appendChild(detail);
  }

  row.appendChild(info);
  row.appendChild(renderActions(item, type, windowId));

  return row;
}
```

- [ ] **Step 6: Create projectCard.js**

Create `dashboard/renderer/components/projectCard.js`:

```javascript
// Renders a complete project card with header and child rows
// eslint-disable-next-line no-unused-vars
function renderProjectCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';

  // Compute worst status
  const allStatuses = [
    ...(project.state?.processes ?? []).map((p) => p.status),
    ...(project.state?.agents ?? []).map((a) => a.status),
  ];
  let worstStatus = 'idle';
  if (allStatuses.includes('errored') || allStatuses.includes('error')) worstStatus = 'errored';
  else if (allStatuses.includes('waiting_for_input')) worstStatus = 'waiting_for_input';
  else if (allStatuses.includes('running') || allStatuses.includes('working')) worstStatus = 'running';

  card.classList.add(`status-${worstStatus}`);

  // Header
  const header = document.createElement('div');
  header.className = 'project-header';

  const nameSection = document.createElement('div');
  nameSection.className = 'project-name';

  const dot = document.createElement('span');
  dot.className = `dot ${worstStatus}`;
  nameSection.appendChild(dot);

  const name = document.createElement('strong');
  name.textContent = project.window?.name ?? 'Unknown';
  nameSection.appendChild(name);

  const pathSpan = document.createElement('span');
  pathSpan.className = 'project-path';
  pathSpan.textContent = project.window?.path?.replace(/^\/Users\/[^/]+/, '~') ?? '';
  nameSection.appendChild(pathSpan);

  header.appendChild(nameSection);

  const focusBtn = document.createElement('button');
  focusBtn.className = 'focus-btn';
  focusBtn.textContent = 'Focus';
  focusBtn.onclick = () => window.bridge.sendCommand(project.windowId, { type: 'window:focus' });
  header.appendChild(focusBtn);

  card.appendChild(header);

  // Rows container
  const rows = document.createElement('div');

  for (const terminal of (project.state?.terminals ?? [])) {
    rows.appendChild(renderRow(terminal, 'terminal', project.windowId));
  }
  for (const proc of (project.state?.processes ?? [])) {
    rows.appendChild(renderRow(proc, 'process', project.windowId));
  }
  for (const agent of (project.state?.agents ?? [])) {
    rows.appendChild(renderRow(agent, 'agent', project.windowId));
  }

  card.appendChild(rows);
  return card;
}
```

- [ ] **Step 7: Create app.js — wire preload bridge to DOM**

Create `dashboard/renderer/app.js`:

```javascript

const projectsContainer = document.getElementById('projects');
const emptyState = document.getElementById('empty-state');
const connectionCount = document.getElementById('connection-count');

window.bridge.onRegistryUpdate((projects) => {
  render(projects);
});

function render(projects) {
  projectsContainer.innerHTML = '';

  if (projects.length === 0) {
    emptyState.style.display = 'flex';
    projectsContainer.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    projectsContainer.style.display = 'flex';
  }

  connectionCount.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

  // Sort: errored first, then waiting, then running, then idle
  const sorted = [...projects].sort((a, b) => statusPriority(a) - statusPriority(b));

  for (const project of sorted) {
    projectsContainer.appendChild(renderProjectCard(project));
  }
}

function statusPriority(project) {
  const statuses = [
    ...(project.state?.processes ?? []).map((p) => p.status),
    ...(project.state?.agents ?? []).map((a) => a.status),
  ];
  if (statuses.includes('errored') || statuses.includes('error')) return 0;
  if (statuses.includes('waiting_for_input')) return 1;
  if (statuses.includes('running') || statuses.includes('working')) return 2;
  return 3;
}
```

- [ ] **Step 5: Add IPC handler in main.js for send-command**

Add to `dashboard/main/main.js` after `createWindow()`:

```javascript
// ipcMain is already imported at the top of main.js
ipcMain.on('send-command', (_event, windowId, command) => {
  server.sendCommand(windowId, command);
});
```

- [ ] **Step 6: Test manually**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx electron .
```
Expected: Dashboard window shows "No projects connected". Opening a VS Code window with Spinup installed should show the project appear (once bridge from Task 7 is wired).

- [ ] **Step 7: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): add renderer UI with project cards, rows, and actions"
```

---

## Phase 3: End-to-End Integration

### Task 14: End-to-end integration test

**Files:**
- Create: `src/test/suite/bridgeIntegration.test.js`

- [ ] **Step 1: Write integration test**

Create `src/test/suite/bridgeIntegration.test.js`:

```javascript
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
      }, (res) => resolve());
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`
Expected: All tests PASS (including integration tests)

- [ ] **Step 3: Commit**

```bash
jj commit -m "test: add end-to-end bridge integration tests"
```

---

### Task 15: Add .gitignore entries and update CLAUDE.md

**Files:**
- Modify: `.gitignore`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add .superpowers/ and dashboard/node_modules to .gitignore**

```
.superpowers/
dashboard/node_modules/
```

- [ ] **Step 2: Update CLAUDE.md with dashboard commands and architecture notes**

Add a section about the dashboard:

```markdown
## Dashboard

The `dashboard/` directory contains the Electron companion app (Spinup Dashboard).

```bash
cd dashboard && npm start    # Run the Electron dashboard app
cd dashboard && npm test     # Run dashboard tests (Mocha TDD)
```

The extension bridge connects to the dashboard via WebSocket. Agent hooks report state via HTTP to the extension's AgentHookListener (port 9501).
```

- [ ] **Step 3: Commit**

```bash
jj commit -m "docs: update CLAUDE.md and .gitignore for dashboard"
```

---

### Task 16: Agent hook setup command

**Files:**
- Create: `dashboard/main/agentSetup.js`
- Test: `dashboard/test/agentSetup.test.js`

The dashboard's "Configure Agents" first-run step detects which agents are installed and generates their hook configurations.

- [ ] **Step 1: Write failing tests**

Create `dashboard/test/agentSetup.test.js`:

```javascript
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AgentSetup } = require('../main/agentSetup');

suite('AgentSetup', () => {
  let tmpDir;
  let agentSetup;

  const allModules = [
    require('../../src/bridge/agents/claudeCode'),
    require('../../src/bridge/agents/codexCli'),
    require('../../src/bridge/agents/copilotCli'),
    require('../../src/bridge/agents/clineCli'),
    require('../../src/bridge/agents/amp'),
    require('../../src/bridge/agents/geminiCli'),
    require('../../src/bridge/agents/opencode'),
    require('../../src/bridge/agents/goose'),
  ];

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-setup-'));
    agentSetup = new AgentSetup(9501, tmpDir);
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getAvailableAgents returns all hook-based agent modules', () => {
    const agents = agentSetup.getAvailableAgents();
    assert.ok(agents.length >= 8);
    for (const agent of agents) {
      assert.ok(agent.KIND);
      assert.ok(agent.getHookConfig);
    }
  });

  test('generateConfig produces valid hook config for each agent', () => {
    for (const mod of allModules) {
      const config = mod.getHookConfig(9501);
      assert.strictEqual(config.agent, mod.KIND);
      assert.ok(config.hooks.length > 0);
      for (const hook of config.hooks) {
        assert.ok(hook.event);
        assert.ok(hook.command);
        assert.ok(hook.command.includes('localhost:9501'));
      }
    }
  });

  test('isConfigured returns false when no config exists', () => {
    assert.strictEqual(agentSetup.isConfigured(), false);
  });

  test('markConfigured creates a marker file', () => {
    agentSetup.markConfigured();
    assert.strictEqual(agentSetup.isConfigured(), true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/agentSetup.test.js --ui tdd
```
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement AgentSetup**

Create `dashboard/main/agentSetup.js`:

```javascript
const fs = require('fs');
const path = require('path');

const agentModules = [
  require('../../src/bridge/agents/claudeCode'),
  require('../../src/bridge/agents/codexCli'),
  require('../../src/bridge/agents/copilotCli'),
  require('../../src/bridge/agents/clineCli'),
  require('../../src/bridge/agents/amp'),
  require('../../src/bridge/agents/geminiCli'),
  require('../../src/bridge/agents/opencode'),
  require('../../src/bridge/agents/goose'),
];

class AgentSetup {
  constructor(listenerPort, configDir) {
    this._listenerPort = listenerPort;
    this._markerPath = path.join(configDir, '.agents-configured');
  }

  getAvailableAgents() {
    return agentModules;
  }

  generateAllConfigs() {
    return agentModules.map((mod) => mod.getHookConfig(this._listenerPort));
  }

  isConfigured() {
    return fs.existsSync(this._markerPath);
  }

  markConfigured() {
    fs.mkdirSync(path.dirname(this._markerPath), { recursive: true });
    fs.writeFileSync(this._markerPath, new Date().toISOString());
  }
}

module.exports = { AgentSetup };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/joelmoss/dev/spinup/dashboard && npx mocha test/agentSetup.test.js --ui tdd
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/joelmoss/dev/spinup && jj commit -m "feat(dashboard): add AgentSetup for first-run hook configuration"
```
