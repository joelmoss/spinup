const assert = require('assert');
const { validateConfig } = require('../../config/validator');

suite('ConfigValidator', () => {
  test('validates a minimal config', () => {
    const config = validateConfig({
      commands: {
        Server: { command: 'npm run dev' },
      },
    });
    assert.ok(config);
    assert.strictEqual(Object.keys(config.commands).length, 1);
    assert.strictEqual(config.commands['Server'].command, 'npm run dev');
  });

  test('applies defaults', () => {
    const config = validateConfig({
      commands: {
        Server: { command: 'npm run dev' },
      },
    });
    assert.ok(config);
    const cmd = config.commands['Server'];
    assert.strictEqual(cmd.autostart, true);
    assert.strictEqual(cmd.autoRestart, false);
    assert.strictEqual(cmd.interactive, false);
  });

  test('preserves explicit values', () => {
    const config = validateConfig({
      commands: {
        Worker: {
          command: 'php artisan queue:work',
          autostart: false,
          autoRestart: true,
          interactive: true,
          cwd: './backend',
          env: { NODE_ENV: 'production' },
          watch: ['app/**'],
        },
      },
    });
    assert.ok(config);
    const cmd = config.commands['Worker'];
    assert.strictEqual(cmd.autostart, false);
    assert.strictEqual(cmd.autoRestart, true);
    assert.strictEqual(cmd.interactive, true);
    assert.strictEqual(cmd.cwd, './backend');
    assert.deepStrictEqual(cmd.env, { NODE_ENV: 'production' });
    assert.deepStrictEqual(cmd.watch, ['app/**']);
  });

  test('rejects config without commands', () => {
    const config = validateConfig({});
    assert.strictEqual(config, null);
  });

  test('rejects command without command string', () => {
    const config = validateConfig({
      commands: {
        Bad: { autostart: true },
      },
    });
    assert.strictEqual(config, null);
  });
});
