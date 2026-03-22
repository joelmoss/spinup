const KIND = 'opencode';

const EVENT_MAP = {
  'tool_start': 'working',
  'tool_end': 'idle',
  'waiting': 'waiting_for_input',
};

function getHookConfig() {
  const portExpr = "$(grep -o '\"hookPort\":[0-9]*' ~/.spinup/server.json | grep -o '[0-9]*')";
  const baseUrl = `http://localhost:${portExpr}/agent-event`;
  const common = `"agent":"${KIND}","pid":"$PPID","cwd":"$PWD"`;
  return {
    agent: KIND,
    configPath: '~/.opencode/config.json',
    hooks: [
      { event: 'tool_start', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"working","detail":"tool_start"}'` },
      { event: 'tool_end', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"idle","detail":"tool_end"}'` },
      { event: 'waiting', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{${common},"event":"waiting_for_input","detail":"waiting"}'` },
    ],
  };
}

module.exports = { KIND, EVENT_MAP, getHookConfig };
