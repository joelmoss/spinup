const assert = require('assert');
const vscode = require('vscode');
const { loadConfig } = require('../../config/settings');

suite('Settings', () => {
  let originalGet;

  function stubCommands(commands) {
    const config = vscode.workspace.getConfiguration('spinup');
    originalGet = config.get;
    // Stub getConfiguration to return our test data
    const origGetConfig = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section) => {
      if (section === 'spinup') {
        return {
          get(key, defaultValue) {
            if (key === 'commands') return commands;
            return defaultValue;
          },
        };
      }
      return origGetConfig(section);
    };
  }

  teardown(() => {
    // Restore original getConfiguration if it was stubbed
    if (vscode.workspace._originalGetConfiguration) {
      vscode.workspace.getConfiguration = vscode.workspace._originalGetConfiguration;
      delete vscode.workspace._originalGetConfiguration;
    }
  });

  function withCommands(commands) {
    const origGetConfig = vscode.workspace.getConfiguration;
    vscode.workspace._originalGetConfiguration = origGetConfig;
    vscode.workspace.getConfiguration = (section) => {
      if (section === 'spinup') {
        return {
          get(key, defaultValue) {
            if (key === 'commands') return commands;
            return defaultValue;
          },
        };
      }
      return origGetConfig(section);
    };
  }

  test('loads a minimal config', () => {
    withCommands({ Server: { command: 'npm run dev' } });
    const config = loadConfig();
    assert.ok(config);
    assert.strictEqual(Object.keys(config.commands).length, 1);
    assert.strictEqual(config.commands['Server'].command, 'npm run dev');
  });

  test('applies defaults', () => {
    withCommands({ Server: { command: 'npm run dev' } });
    const config = loadConfig();
    assert.ok(config);
    const cmd = config.commands['Server'];
    assert.strictEqual(cmd.autostart, true);
    assert.strictEqual(cmd.autoRestart, false);
    assert.strictEqual(cmd.interactive, false);
  });

  test('preserves explicit values', () => {
    withCommands({
      Worker: {
        command: 'php artisan queue:work',
        autostart: false,
        autoRestart: true,
        interactive: true,
        cwd: './backend',
        env: { NODE_ENV: 'production' },
        watch: ['app/**'],
      },
    });
    const config = loadConfig();
    assert.ok(config);
    const cmd = config.commands['Worker'];
    assert.strictEqual(cmd.autostart, false);
    assert.strictEqual(cmd.autoRestart, true);
    assert.strictEqual(cmd.interactive, true);
    assert.strictEqual(cmd.cwd, './backend');
    assert.deepStrictEqual(cmd.env, { NODE_ENV: 'production' });
    assert.deepStrictEqual(cmd.watch, ['app/**']);
  });

  test('returns null for empty commands', () => {
    withCommands({});
    const config = loadConfig();
    assert.strictEqual(config, null);
  });

  test('returns null when command string is missing', () => {
    withCommands({ Bad: { autostart: true } });
    const config = loadConfig();
    assert.strictEqual(config, null);
  });
});
