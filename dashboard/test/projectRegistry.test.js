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
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    registry.updateState('win-1', {
      terminals: [],
      agents: [],
      processes: [{ id: 'p1', name: 'Server', status: 'running' }],
    });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'waiting_for_input', detail: 'idle_prompt', pid: '100', cwd: '/dev/spinup' });
    assert.strictEqual(registry.getWorstStatus('win-1'), 'waiting_for_input');
  });

  test('findProjectByCwd matches by folder path', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    const project = registry.findProjectByCwd('/dev/spinup');
    assert.strictEqual(project.windowId, 'win-1');
  });

  test('findProjectByCwd matches subdirectories', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    assert.ok(registry.findProjectByCwd('/dev/spinup/src'));
  });

  test('findProjectByCwd returns null for non-matching cwd', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    assert.strictEqual(registry.findProjectByCwd('/dev/other'), null);
  });

  test('findProjectByCwd returns null for null cwd', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    assert.strictEqual(registry.findProjectByCwd(null), null);
  });

  test('findProjectByCwd matches by window path when no folders', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    assert.ok(registry.findProjectByCwd('/dev/spinup'));
  });

  test('handleAgentEvent adds agent to matching project', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'working', detail: 'session_start', pid: '100', cwd: '/dev/spinup' });
    const agents = registry.getProject('win-1').state.agents;
    assert.strictEqual(agents.length, 1);
    assert.strictEqual(agents[0].name, 'Claude Code');
    assert.strictEqual(agents[0].status, 'working');
  });

  test('handleAgentEvent updates existing agent', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'working', detail: 'session_start', pid: '100', cwd: '/dev/spinup' });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'waiting_for_input', detail: 'idle_prompt', pid: '100', cwd: '/dev/spinup' });
    const agents = registry.getProject('win-1').state.agents;
    assert.strictEqual(agents.length, 1);
    assert.strictEqual(agents[0].status, 'waiting_for_input');
  });

  test('handleAgentEvent removes agent on idle', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'working', detail: 'session_start', pid: '100', cwd: '/dev/spinup' });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'idle', detail: 'stop', pid: '100', cwd: '/dev/spinup' });
    assert.strictEqual(registry.getProject('win-1').state.agents.length, 0);
  });

  test('handleAgentEvent ignores events with no matching project', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'working', detail: 'session_start', pid: '100', cwd: '/dev/other' });
    assert.strictEqual(registry.getProject('win-1').state.agents.length, 0);
  });

  test('updateState preserves dashboard-managed agents', () => {
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [{ name: 'spinup', path: '/dev/spinup' }] });
    registry.handleAgentEvent({ agent: 'claude-code', event: 'working', detail: 'session_start', pid: '100', cwd: '/dev/spinup' });
    registry.updateState('win-1', { terminals: [], agents: [], processes: [] });
    assert.strictEqual(registry.getProject('win-1').state.agents.length, 1);
  });

  test('onChange fires when state changes', () => {
    let fired = false;
    registry.onChange(() => { fired = true; });
    registry.addProject('win-1', { kind: 'directory', name: 'spinup', path: '/dev/spinup', folders: [] });
    assert.strictEqual(fired, true);
  });
});
