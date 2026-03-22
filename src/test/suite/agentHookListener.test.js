'use strict';

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
