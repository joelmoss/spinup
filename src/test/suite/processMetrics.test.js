const assert = require('assert');
const { getMetrics } = require('../../metrics/processMetrics');

suite('ProcessMetrics', () => {
  test('returns metrics for current process', async () => {
    const metrics = await getMetrics(process.pid);
    assert.ok(metrics, 'should return metrics for a live process');
    assert.strictEqual(typeof metrics.cpu, 'number');
    assert.strictEqual(typeof metrics.mem, 'number');
    assert.ok(metrics.mem > 0, 'memory should be positive');
  });

  test('returns null for non-existent process', async () => {
    const metrics = await getMetrics(999999);
    assert.strictEqual(metrics, null);
  });
});
