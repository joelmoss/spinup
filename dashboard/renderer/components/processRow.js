// eslint-disable-next-line no-unused-vars
function renderRow(item, type, windowId) {
  const row = document.createElement('div');
  row.className = 'row';
  if (item.status === 'errored' || item.status === 'error') row.classList.add('errored-bg');

  const info = document.createElement('div');
  info.className = 'row-info';

  const dot = document.createElement('span');
  dot.className = `dot ${item.status}`;
  info.appendChild(dot);

  const typeBadge = document.createElement('span');
  typeBadge.className = 'row-type';
  typeBadge.textContent = type === 'agent' ? 'AGENT' : type === 'process' ? 'PROC' : 'TERM';
  info.appendChild(typeBadge);

  const name = document.createElement('span');
  name.className = 'row-name';
  if (item.status === 'idle' || item.status === 'stopped') name.classList.add('idle');
  name.textContent = item.name;
  info.appendChild(name);

  let detailText = '';
  if (item.metrics && item.metrics.cpu !== undefined) {
    detailText = `${item.metrics.cpu}% · ${item.metrics.mem} MB`;
  } else if (item.status === 'errored' || item.status === 'error') {
    detailText = item.restartCount ? `crashed · restart ${item.restartCount}/${item.maxRestarts ?? 5}` : 'crashed';
  } else if (item.status === 'waiting_for_input') {
    detailText = item.detail || 'waiting for input';
  } else if (item.detail) {
    detailText = item.detail;
  }

  if (detailText) {
    const detail = document.createElement('span');
    detail.className = 'row-detail';
    if (item.status === 'errored' || item.status === 'error') detail.classList.add('errored');
    if (item.status === 'waiting_for_input') detail.classList.add('waiting');
    detail.textContent = detailText;
    info.appendChild(detail);
  }

  row.appendChild(info);
  row.appendChild(renderActions(item, type, windowId));

  return row;
}
