const KIND = 'copilot-cli';
const EVENT_MAP = {
  'sessionStart': 'working',
  'sessionEnd': 'idle',
  'permissionRequest': 'waiting_for_input',
};
function getHookConfig() {
  const portExpr = "$(grep -o '\"hookPort\":[0-9]*' ~/.spinup/server.json | grep -o '[0-9]*')";
  const baseUrl = `http://localhost:${portExpr}/agent-event`;
  const common = `"agent":"${KIND}","pid":"$PPID","cwd":"$PWD"`;
  return {
    agent: KIND,
    hooks: [
      { event: 'sessionStart', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"working","detail":"sessionStart"}'` },
      { event: 'sessionEnd', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"idle","detail":"sessionEnd"}'` },
      { event: 'permissionRequest', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"waiting_for_input","detail":"permissionRequest"}'` },
    ],
  };
}
module.exports = { KIND, EVENT_MAP, getHookConfig };
