const EventEmitter = require('events');

const AGENT_NAMES = {
  'claude-code': 'Claude Code',
  'codex-cli': 'Codex CLI',
  'copilot-cli': 'Copilot CLI',
  'gemini-cli': 'Gemini CLI',
  'amp': 'Amp',
  'cline-cli': 'Cline CLI',
  'opencode': 'OpenCode',
  'goose': 'Goose',
};

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
    project.state = { ...state, agents: project.state.agents };
    this.emit('change');
  }

  applyDelta(windowId, changes) {
    const project = this._projects.get(windowId);
    if (!project) return;

    for (const category of ['terminals', 'processes']) {
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

  updateMetrics(windowId, items) {
    const project = this._projects.get(windowId);
    if (!project) return;
    for (const item of items) {
      for (const category of ['processes', 'terminals']) {
        const target = project.state[category].find((i) => i.id === item.id);
        if (target) {
          target.metrics = { cpu: item.cpu, mem: item.mem };
        }
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

  findProjectByCwd(cwd) {
    if (!cwd) return null;
    for (const project of this._projects.values()) {
      const folders = project.window?.folders ?? [];
      if (folders.some((f) => cwd === f.path || cwd.startsWith(f.path + '/'))) {
        return project;
      }
      if (project.window?.path && (cwd === project.window.path || cwd.startsWith(project.window.path + '/'))) {
        return project;
      }
    }
    return null;
  }

  handleAgentEvent(event) {
    const project = this.findProjectByCwd(event.cwd);
    if (!project) return;

    const instanceId = event.pid || event.terminalPid || 'default';
    const id = `${event.agent}-${instanceId}`;

    if (event.event === 'idle') {
      project.state.agents = project.state.agents.filter((a) => a.id !== id);
      this.emit('change');
      return;
    }

    const agent = {
      id,
      name: AGENT_NAMES[event.agent] ?? event.agent,
      kind: event.agent,
      status: event.event,
      detail: event.detail ?? '',
      pid: event.pid ?? null,
      terminalId: null,
    };

    const idx = project.state.agents.findIndex((a) => a.id === id);
    if (idx >= 0) {
      project.state.agents[idx] = agent;
    } else {
      project.state.agents.push(agent);
    }

    this.emit('change');
  }

  onChange(callback) {
    this.on('change', callback);
  }
}

module.exports = { ProjectRegistry };
