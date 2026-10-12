import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectEntry } from '../project-map.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

// The MCP server serves every client on one event loop. While project_set waits for a
// map lock another writer holds, that loop keeps running: timers fire, and the wait
// ends as soon as the holder releases the lock.
describe('project_set waiting for the map lock', () => {
  let repo: string;
  const lockFile = () => path.join(os.homedir(), '.formio', 'projects.json.lock');

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-lock-wait-repo-'));
    fs.mkdirSync(path.join(repo, '.git'));
    fs.mkdirSync(path.dirname(lockFile()), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(lockFile(), { force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('keeps the event loop running while a running process on this host holds the lock', async () => {
    // Held by a process that is running on this host: this test's parent.
    fs.writeFileSync(
      lockFile(),
      JSON.stringify({ host: os.hostname(), pid: process.ppid, id: 'held-by-parent' })
    );
    const client = await connectTools((server) => registerProjectSetTool(server));
    let ticks = 0;
    const ticker = setInterval(() => {
      ticks += 1;
    }, 10);
    let releasedAt = 0;
    setTimeout(() => {
      releasedAt = Date.now();
      fs.rmSync(lockFile(), { force: true });
    }, 150);
    const started = Date.now();

    try {
      const result = await client.callTool({
        name: 'project_set',
        arguments: { projectUrl: 'https://lockwait.form.io', cwd: repo },
      });
      expect(result.isError).toBeFalsy();
    } finally {
      clearInterval(ticker);
    }

    expect(releasedAt).toBeGreaterThan(0);
    expect(ticks).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(readProjectEntry(repo)?.env.FORMIO_PROJECT_URL).toBe('https://lockwait.form.io');
  }, 15_000);
});
