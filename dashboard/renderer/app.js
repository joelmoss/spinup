const projectsContainer = document.getElementById('projects');
const emptyState = document.getElementById('empty-state');
const connectionCount = document.getElementById('connection-count');

window.bridge.onRegistryUpdate((projects) => {
  render(projects);
});

function render(projects) {
  projectsContainer.innerHTML = '';

  if (projects.length === 0) {
    emptyState.style.display = 'flex';
    projectsContainer.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    projectsContainer.style.display = 'flex';
  }

  connectionCount.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

  const sorted = [...projects].sort((a, b) => statusPriority(a) - statusPriority(b));

  for (const project of sorted) {
    projectsContainer.appendChild(renderProjectCard(project));
  }
}

function statusPriority(project) {
  const statuses = [
    ...(project.state?.processes ?? []).map((p) => p.status),
    ...(project.state?.agents ?? []).map((a) => a.status),
  ];
  if (statuses.includes('errored') || statuses.includes('error')) return 0;
  if (statuses.includes('waiting_for_input')) return 1;
  if (statuses.includes('running') || statuses.includes('working')) return 2;
  return 3;
}
