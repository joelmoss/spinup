const { execFile } = require('child_process');

/**
 * Get aggregated CPU % and RSS (MB) for a process and all its descendants.
 * Returns { cpu, mem } or null if the process is gone.
 */
function getMetrics(pid) {
  return new Promise(resolve => {
    // Get all processes, then filter to the tree rooted at `pid`
    execFile('ps', ['-eo', 'pid,ppid,pcpu,rss'], (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }

      const rows = [];
      for (const line of stdout.trim().split('\n').slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          rows.push({
            pid: parseInt(parts[0], 10),
            ppid: parseInt(parts[1], 10),
            cpu: parseFloat(parts[2]),
            rss: parseInt(parts[3], 10), // in KB
          });
        }
      }

      // Find all descendants of `pid` (inclusive)
      const tree = new Set([pid]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (tree.has(row.ppid) && !tree.has(row.pid)) {
            tree.add(row.pid);
            changed = true;
          }
        }
      }

      let cpu = 0;
      let rss = 0;
      for (const row of rows) {
        if (tree.has(row.pid)) {
          cpu += row.cpu;
          rss += row.rss;
        }
      }

      if (!rows.some(r => r.pid === pid)) {
        resolve(null);
        return;
      }

      resolve({
        cpu: Math.round(cpu * 10) / 10,
        mem: Math.round(rss / 1024 * 10) / 10, // KB → MB
      });
    });
  });
}

module.exports = { getMetrics };
