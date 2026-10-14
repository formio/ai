// What the published @formio/mcp tarball carries.
//
// The MIT LICENSE lives at the repository root, and `files` listed only `dist` and
// the README, so the tarball shipped without the licence text the licence itself
// requires to travel with the code. And `build` was a bare `tsc`, which never
// removes an output whose source was deleted, so a stale module in `dist` was
// packed and published beside the current ones.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const PACKAGE_DIR = path.join(REPO_ROOT, 'packages/mcp-server');
const STALE_MODULE = path.join(PACKAGE_DIR, 'dist/stale-module-from-a-deleted-source.js');

interface PackResult {
  files: Array<{ path: string }>;
}

// npm writes lifecycle-script output to stdout ahead of the JSON report, so the
// report is read from the line that opens it. npm 10 and 11 report an array of
// packages; npm 12 reports an object keyed by package name. The release
// workflow publishes with whichever npm it installs, and this suite runs inside
// that publish, so both shapes are read.
function packedFiles(stdout: string): string[] {
  const start = stdout.search(/^[[{]/m);
  expect(start, `npm pack printed no JSON report:\n${stdout}`).toBeGreaterThan(-1);
  const report = JSON.parse(stdout.slice(start)) as PackResult[] | Record<string, PackResult>;
  const [result] = Array.isArray(report) ? report : Object.values(report);
  return result.files.map((file) => file.path);
}

describe('the @formio/mcp tarball', () => {
  let files: string[] = [];

  beforeAll(() => {
    fs.mkdirSync(path.dirname(STALE_MODULE), { recursive: true });
    fs.writeFileSync(STALE_MODULE, 'export const stale = true;\n');
    execFileSync('pnpm', ['run', 'build'], { cwd: PACKAGE_DIR, stdio: 'pipe' });
    files = packedFiles(
      execFileSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: PACKAGE_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
  }, 180_000);

  it('lists LICENSE in its files', () => {
    const { files: declared } = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')
    ) as { files: string[] };
    expect(declared).toContain('LICENSE');
  });

  it('carries LICENSE', () => {
    expect(files).toContain('LICENSE');
  });

  it("carries the repository's licence text, copied at pack time", () => {
    const copied = path.join(PACKAGE_DIR, 'LICENSE');
    expect(fs.existsSync(copied) ? fs.readFileSync(copied, 'utf8') : undefined).toBe(
      fs.readFileSync(path.join(REPO_ROOT, 'LICENSE'), 'utf8')
    );
  });

  it('keeps the copied LICENSE out of version control', () => {
    // check-ignore prints the path, and exits 0, only when the path is ignored.
    const { stdout } = spawnSync('git', ['check-ignore', 'packages/mcp-server/LICENSE'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(stdout.trim()).toBe('packages/mcp-server/LICENSE');
  });

  it('removes a module left in dist by an earlier build', () => {
    expect(fs.existsSync(STALE_MODULE)).toBe(false);
  });

  it('does not pack a module left in dist by an earlier build', () => {
    expect(files).not.toContain(`dist/${path.basename(STALE_MODULE)}`);
    expect(files).toContain('dist/stdio.js');
  });
});
