// eslint-disable-next-line no-unused-vars
function renderProjectCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';

  const allStatuses = [
    ...(project.state?.processes ?? []).map((p) => p.status),
    ...(project.state?.agents ?? []).map((a) => a.status),
  ];
  let worstStatus = 'idle';
  if (allStatuses.includes('errored') || allStatuses.includes('error')) worstStatus = 'errored';
  else if (allStatuses.includes('waiting_for_input')) worstStatus = 'waiting_for_input';
  else if (allStatuses.includes('running') || allStatuses.includes('working')) worstStatus = 'running';

  card.classList.add(`status-${worstStatus}`);

  const header = document.createElement('div');
  header.className = 'project-header';

  const nameSection = document.createElement('div');
  nameSection.className = 'project-name';

  const dot = document.createElement('span');
  dot.className = `dot ${worstStatus}`;
  nameSection.appendChild(dot);

  const name = document.createElement('strong');
  name.textContent = project.window?.name ?? 'Unknown';
  nameSection.appendChild(name);

  const pathSpan = document.createElement('span');
  pathSpan.className = 'project-path';
  pathSpan.textContent = project.window?.path?.replace(/^\/Users\/[^/]+/, '~') ?? '';
  nameSection.appendChild(pathSpan);

  header.appendChild(nameSection);

  const focusBtn = document.createElement('button');
  focusBtn.className = 'focus-btn';
  focusBtn.textContent = 'Focus';
  focusBtn.onclick = () => window.bridge.sendCommand(project.windowId, { type: 'window:focus' });
  header.appendChild(focusBtn);

  card.appendChild(header);

  const rows = document.createElement('div');

  for (const terminal of (project.state?.terminals ?? [])) {
    rows.appendChild(renderRow(terminal, 'terminal', project.windowId));
  }
  for (const proc of (project.state?.processes ?? [])) {
    rows.appendChild(renderRow(proc, 'process', project.windowId));
  }
  for (const agent of (project.state?.agents ?? [])) {
    rows.appendChild(renderRow(agent, 'agent', project.windowId));
  }

  card.appendChild(rows);
  return card;
}
