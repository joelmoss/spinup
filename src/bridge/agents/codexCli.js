const KIND = 'codex-cli';
const EVENT_MAP = {
  'turn.completed': 'waiting_for_input',
  'turn.started': 'working',
  'permission_request': 'waiting_for_input',
};
function getHookConfig() {
  const portExpr = "$(grep -o '\"hookPort\":[0-9]*' ~/.spinup/server.json | grep -o '[0-9]*')";
  const baseUrl = `http://localhost:${portExpr}/agent-event`;
  return {
    agent: KIND,
    hooks: [
      { event: 'turn.started', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"turn.started"}'` },
      { event: 'turn.completed', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"turn.completed"}'` },
      { event: 'permission_request', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"permission_request"}'` },
    ],
  };
}
module.exports = { KIND, EVENT_MAP, getHookConfig };
