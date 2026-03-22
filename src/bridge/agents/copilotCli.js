const KIND = 'copilot-cli';
const EVENT_MAP = {
  'sessionStart': 'working',
  'sessionEnd': 'idle',
  'permissionRequest': 'waiting_for_input',
};
function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    hooks: [
      { event: 'sessionStart', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"sessionStart"}'` },
      { event: 'sessionEnd', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"sessionEnd"}'` },
      { event: 'permissionRequest', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"permissionRequest"}'` },
    ],
  };
}
module.exports = { KIND, EVENT_MAP, getHookConfig };
