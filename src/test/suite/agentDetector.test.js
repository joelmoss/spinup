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
