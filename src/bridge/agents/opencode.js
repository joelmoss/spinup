const KIND = 'opencode';

const EVENT_MAP = {
  'tool_start': 'working',
  'tool_end': 'idle',
  'waiting': 'waiting_for_input',
};

function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    configPath: '~/.opencode/config.json',
    hooks: [
      { event: 'tool_start', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"tool_start"}'` },
      { event: 'tool_end', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"tool_end"}'` },
      { event: 'waiting', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"waiting"}'` },
    ],
  };
}

module.exports = { KIND, EVENT_MAP, getHookConfig };
