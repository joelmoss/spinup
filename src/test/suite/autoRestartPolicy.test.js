const assert = require('assert');
const { AutoRestartPolicy } = require('../../commands/autoRestartPolicy');

suite('AutoRestartPolicy', () => {
  test('starts with canRestart true', () => {
    const policy = new AutoRestartPolicy();
    assert.strictEqual(policy.canRestart, true);
  });

  test('initial delay is 1000ms', () => {
    const policy = new AutoRestartPolicy();
    assert.strictEqual(policy.currentDelay, 1000);
  });

  test('delay doubles with each restart', () => {
    const policy = new AutoRestartPolicy();
    assert.strictEqual(policy.currentDelay, 1000);
    policy.recordRestart();
    assert.strictEqual(policy.currentDelay, 2000);
    policy.recordRestart();
    assert.strictEqual(policy.currentDelay, 4000);
  });

  test('delay is capped at 30s', () => {
    const policy = new AutoRestartPolicy();
    for (let i = 0; i < 10; i++) {
      policy.recordRestart();
    }
    assert.ok(policy.currentDelay <= 30000);
  });

  test('canRestart is false after 5 retries', () => {
    const policy = new AutoRestartPolicy();
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(policy.canRestart, true);
      policy.recordRestart();
    }
    assert.strictEqual(policy.canRestart, false);
  });

  test('reset clears restart count', () => {
    const policy = new AutoRestartPolicy();
    policy.recordRestart();
    policy.recordRestart();
    policy.reset();
    assert.strictEqual(policy.canRestart, true);
    assert.strictEqual(policy.currentDelay, 1000);
    assert.strictEqual(policy.attempts, 0);
  });
});
