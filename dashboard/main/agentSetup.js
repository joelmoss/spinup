const fs = require('fs');
const path = require('path');

const agentModules = [
  require('../../src/bridge/agents/claudeCode'),
  require('../../src/bridge/agents/codexCli'),
  require('../../src/bridge/agents/copilotCli'),
  require('../../src/bridge/agents/clineCli'),
  require('../../src/bridge/agents/amp'),
  require('../../src/bridge/agents/geminiCli'),
  require('../../src/bridge/agents/opencode'),
  require('../../src/bridge/agents/goose'),
];

class AgentSetup {
  constructor(listenerPort, configDir) {
    this._listenerPort = listenerPort;
    this._markerPath = path.join(configDir, '.agents-configured');
  }

  getAvailableAgents() {
    return agentModules;
  }

  generateAllConfigs() {
    return agentModules.map((mod) => mod.getHookConfig(this._listenerPort));
  }

  isConfigured() {
    return fs.existsSync(this._markerPath);
  }

  markConfigured() {
    fs.mkdirSync(path.dirname(this._markerPath), { recursive: true });
    fs.writeFileSync(this._markerPath, new Date().toISOString());
  }
}

module.exports = { AgentSetup };
