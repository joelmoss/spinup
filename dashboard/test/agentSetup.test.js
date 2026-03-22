const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { AgentSetup } = require('../main/agentSetup');

suite('AgentSetup', () => {
  let tmpDir;
  let agentSetup;

  const allModules = [
    require('../../src/bridge/agents/claudeCode'),
    require('../../src/bridge/agents/codexCli'),
    require('../../src/bridge/agents/copilotCli'),
    require('../../src/bridge/agents/clineCli'),
    require('../../src/bridge/agents/amp'),
    require('../../src/bridge/agents/geminiCli'),
    require('../../src/bridge/agents/opencode'),
    require('../../src/bridge/agents/goose'),
  ];

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-setup-'));
    agentSetup = new AgentSetup(9501, tmpDir);
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getAvailableAgents returns all hook-based agent modules', () => {
    const agents = agentSetup.getAvailableAgents();
    assert.ok(agents.length >= 8);
    for (const agent of agents) {
      assert.ok(agent.KIND);
      assert.ok(agent.getHookConfig);
    }
  });

  test('generateConfig produces valid hook config for each agent', () => {
    for (const mod of allModules) {
      const config = mod.getHookConfig();
      assert.strictEqual(config.agent, mod.KIND);
      assert.ok(config.hooks.length > 0);
      for (const hook of config.hooks) {
        assert.ok(hook.event);
        assert.ok(hook.command);
        assert.ok(hook.command.includes('/agent-event'));
      }
    }
  });

  test('isConfigured returns false when no config exists', () => {
    assert.strictEqual(agentSetup.isConfigured(), false);
  });

  test('markConfigured creates a marker file', () => {
    agentSetup.markConfigured();
    assert.strictEqual(agentSetup.isConfigured(), true);
  });
});
