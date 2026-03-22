const KIND = 'cline-cli';
const EVENT_MAP = {
  'task_started': 'working',
  'task_completed': 'idle',
  'ask': 'waiting_for_input',
};
function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    hooks: [
      { event: 'task_started', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"task_started"}'` },
      { event: 'task_completed', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"task_completed"}'` },
      { event: 'ask', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"ask"}'` },
    ],
  };
}
module.exports = { KIND, EVENT_MAP, getHookConfig };
