const assert = require('assert');

const claudeCode = require('../../bridge/agents/claudeCode');
const codexCli = require('../../bridge/agents/codexCli');
const copilotCli = require('../../bridge/agents/copilotCli');
const clineCli = require('../../bridge/agents/clineCli');
const rooCode = require('../../bridge/agents/rooCode');
const amp = require('../../bridge/agents/amp');
const geminiCli = require('../../bridge/agents/geminiCli');
const opencode = require('../../bridge/agents/opencode');
const goose = require('../../bridge/agents/goose');

suite('Agent Modules', () => {
  const modules = [
    { name: 'claudeCode', mod: claudeCode, kind: 'claude-code' },
    { name: 'codexCli', mod: codexCli, kind: 'codex-cli' },
    { name: 'copilotCli', mod: copilotCli, kind: 'copilot-cli' },
    { name: 'clineCli', mod: clineCli, kind: 'cline-cli' },
    { name: 'rooCode', mod: rooCode, kind: 'roo-code' },
    { name: 'amp', mod: amp, kind: 'amp' },
    { name: 'geminiCli', mod: geminiCli, kind: 'gemini-cli' },
    { name: 'opencode', mod: opencode, kind: 'opencode' },
    { name: 'goose', mod: goose, kind: 'goose' },
  ];

  for (const { name, mod, kind } of modules) {
    test(`${name} exports KIND identifier`, () => {
      assert.strictEqual(mod.KIND, kind);
    });

    test(`${name} exports EVENT_MAP with standard states`, () => {
      assert.ok(mod.EVENT_MAP);
      const validStates = ['idle', 'working', 'waiting_for_input', 'error', 'unknown'];
      for (const state of Object.values(mod.EVENT_MAP)) {
        assert.ok(validStates.includes(state), `${name} maps to invalid state: ${state}`);
      }
    });

    test(`${name} exports getHookConfig function`, () => {
      assert.strictEqual(typeof mod.getHookConfig, 'function');
      const config = mod.getHookConfig(9501);
      assert.ok(config, `${name}.getHookConfig() should return a config object`);
      assert.strictEqual(typeof config.agent, 'string');
    });
  }

  test('claudeCode EVENT_MAP maps idle_prompt to waiting_for_input', () => {
    assert.strictEqual(claudeCode.EVENT_MAP['idle_prompt'], 'waiting_for_input');
    assert.strictEqual(claudeCode.EVENT_MAP['permission_prompt'], 'waiting_for_input');
    assert.strictEqual(claudeCode.EVENT_MAP['session_start'], 'working');
    assert.strictEqual(claudeCode.EVENT_MAP['stop'], 'idle');
  });

  test('codexCli EVENT_MAP maps turn events correctly', () => {
    assert.strictEqual(codexCli.EVENT_MAP['turn.completed'], 'waiting_for_input');
    assert.strictEqual(codexCli.EVENT_MAP['turn.started'], 'working');
    assert.strictEqual(codexCli.EVENT_MAP['permission_request'], 'waiting_for_input');
  });
});
