const KIND = 'gemini-cli';

const EVENT_MAP = {
  'before_agent': 'working',
  'after_agent': 'idle',
  'session_end': 'idle',
};

function getHookConfig() {
  const portExpr = "$(grep -o '\"hookPort\":[0-9]*' ~/.spinup/server.json | grep -o '[0-9]*')";
  const baseUrl = `http://localhost:${portExpr}/agent-event`;
  return {
    agent: KIND,
    configPath: '~/.gemini/settings.json',
    hooks: [
      { event: 'before_agent', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"before_agent"}'` },
      { event: 'after_agent', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"after_agent"}'` },
      { event: 'session_end', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"session_end"}'` },
    ],
  };
}

module.exports = { KIND, EVENT_MAP, getHookConfig };
