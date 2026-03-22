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
      } catch { /* ignore malformed JSON */ }
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
