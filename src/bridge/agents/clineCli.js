const KIND = 'cline-cli';
const EVENT_MAP = {
  'task_started': 'working',
  'task_completed': 'idle',
  'ask': 'waiting_for_input',
};
function getHookConfig() {
  const portExpr = "$(grep -o '\"hookPort\":[0-9]*' ~/.spinup/server.json | grep -o '[0-9]*')";
  const baseUrl = `http://localhost:${portExpr}/agent-event`;
  const common = `"agent":"${KIND}","pid":"$PPID","cwd":"$PWD"`;
  return {
    agent: KIND,
    hooks: [
      { event: 'task_started', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"working","detail":"task_started"}'` },
      { event: 'task_completed', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"idle","detail":"task_completed"}'` },
      { event: 'ask', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"waiting_for_input","detail":"ask"}'` },
    ],
  };
}
module.exports = { KIND, EVENT_MAP, getHookConfig };
