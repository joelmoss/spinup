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
