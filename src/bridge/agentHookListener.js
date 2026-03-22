'use strict';

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

  async dispose() {
    await this.stop();
    this._onAgentEvent.dispose();
  }
}

module.exports = { AgentHookListener };
