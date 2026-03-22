const KIND = 'claude-code';
const EVENT_MAP = {
  'idle_prompt': 'waiting_for_input',
  'permission_prompt': 'waiting_for_input',
  'session_start': 'working',
  'stop': 'idle',
};
function getHookConfig(listenerPort) {
  const baseUrl = `http://localhost:${listenerPort}/agent-event`;
  return {
    agent: KIND,
    configPath: '~/.claude/settings.json',
    hooks: [
      { event: 'Notification', matcher: 'idle_prompt', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"idle_prompt"}'` },
      { event: 'Notification', matcher: 'permission_prompt', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"waiting_for_input","detail":"permission_prompt"}'` },
      { event: 'Stop', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"idle","detail":"stop"}'` },
      { event: 'SessionStart', command: `curl -s -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"agent":"${KIND}","event":"working","detail":"session_start"}'` },
    ],
  };
}
module.exports = { KIND, EVENT_MAP, getHookConfig };
