const KIND = 'amp';

const EVENT_MAP = {
  'init': 'working',
  'result': 'idle',
  'assistant': 'working',
};

function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    configPath: '~/.amp/config.json',
    hooks: [
      { event: 'init', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"init"}'` },
      { event: 'result', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"result"}'` },
      { event: 'assistant', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"assistant"}'` },
    ],
  };
}

module.exports = { KIND, EVENT_MAP, getHookConfig };
