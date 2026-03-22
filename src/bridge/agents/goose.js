const KIND = 'goose';

const EVENT_MAP = {
  'running': 'working',
  'stable': 'waiting_for_input',
  'error': 'error',
};

function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    configPath: '~/.goose/config.json',
    hooks: [
      { event: 'running', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"running"}'` },
      { event: 'stable', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"stable"}'` },
      { event: 'error', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"error","detail":"error"}'` },
    ],
  };
}

module.exports = { KIND, EVENT_MAP, getHookConfig };
