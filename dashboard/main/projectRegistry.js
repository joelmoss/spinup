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

  onChange(callback) {
    this.on('change', callback);
  }
}

module.exports = { ProjectRegistry };
