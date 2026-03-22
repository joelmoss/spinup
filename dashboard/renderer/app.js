const projectsContainer = document.getElementById('projects');
const emptyState = document.getElementById('empty-state');

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

  for (const project of projects) {
    projectsContainer.appendChild(renderProjectCard(project));
  }
}
