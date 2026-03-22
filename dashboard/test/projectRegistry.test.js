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
