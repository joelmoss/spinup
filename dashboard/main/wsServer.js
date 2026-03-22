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
          } catch { /* ignore malformed JSON */ }
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

      this._server.on('error', () => {
        // Preferred port busy — use any available port
        this._server.listen(0, '127.0.0.1', () => {
          resolve(this._server.address().port);
        });
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
    this._registry.updateMetrics(msg.windowId, msg.items);
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
