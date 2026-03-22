// eslint-disable-next-line no-unused-vars
function renderActions(item, type, windowId, projectPath) {
  const container = document.createElement('div');
  container.className = 'row-actions';

  const status = item.status;

  if (status === 'running' || status === 'working') {
    const restart = document.createElement('button');
    restart.className = 'action-btn';
    restart.textContent = '↻';
    restart.title = 'Restart';
    restart.onclick = () => {
      window.bridge.sendCommand(windowId, { type: 'command:restart', processId: item.id });
      window.bridge.focusVSCode(projectPath);
      window.bridge.sendCommand(windowId, { type: 'terminal:focus', terminalId: item.id });
    };
    container.appendChild(restart);

    if (type !== 'agent') {
      const stop = document.createElement('button');
      stop.className = 'action-btn';
      stop.textContent = '■';
      stop.title = 'Stop';
      stop.onclick = () => window.bridge.sendCommand(windowId, { type: 'command:stop', processId: item.id });
      container.appendChild(stop);
    }
  }

  if (type === 'process' && (status === 'stopped' || status === 'idle')) {
    const start = document.createElement('button');
    start.className = 'action-btn';
    start.textContent = '▶';
    start.title = 'Start';
    start.onclick = () => {
      window.bridge.sendCommand(windowId, { type: 'command:start', processId: item.id });
      window.bridge.focusVSCode(projectPath);
      window.bridge.sendCommand(windowId, { type: 'terminal:focus', terminalId: item.id });
    };
    container.appendChild(start);
  }

  if (status === 'errored' || status === 'error') {
    const restart = document.createElement('button');
    restart.className = 'action-btn danger';
    restart.textContent = '↻';
    restart.title = 'Restart';
    restart.onclick = () => {
      window.bridge.sendCommand(windowId, { type: 'command:restart', processId: item.id });
      window.bridge.focusVSCode(projectPath);
      window.bridge.sendCommand(windowId, { type: 'terminal:focus', terminalId: item.id });
    };
    container.appendChild(restart);
  }

  if (!(type === 'process' && (status === 'stopped' || status === 'idle'))) {
    const show = document.createElement('button');
    show.className = 'action-btn';
    show.textContent = '↗';
    show.title = 'Show';
    show.onclick = () => {
      window.bridge.focusVSCode(projectPath);
      window.bridge.sendCommand(windowId, { type: 'terminal:focus', terminalId: item.id });
    };
    container.appendChild(show);
  }

  return container;
}
