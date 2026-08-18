// The login page's SRI digests are checked against the CDN, not just for shape.
//
// auth.test.ts asserts that every asset on the portal-login page carries a
// version and a `sha384-…` digest. That cannot tell a correct digest from a
// plausible one, and the cost of a wrong one is the whole login flow: the browser
// blocks the renderer, `Formio.createForm` throws `ReferenceError: Formio is not
// defined`, nothing is POSTed to /callback, and `authenticate` hangs on a blank
// page until it times out. A version bump that edits the URLs and forgets the
// hashes would pass every other test in this suite.
//
// So this test fetches the pinned bytes and digests them, through the same script
// that writes them. It is the one test here that needs the network, and it treats
// an unreachable CDN as a skip rather than a failure — a mismatch is a real defect,
// an offline runner is not.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Mirrors UNREACHABLE_EXIT in scripts/sync-login-asset-integrity.ts, which exits
// 1 for a digest that disagrees and 2 for a CDN it could not reach.
const UNREACHABLE_EXIT = 2;

describe('the login page pins the bytes it loads', () => {
  it('matches the digest of what the CDN serves for every pinned asset', (ctx) => {
    const result = spawnSync('pnpm', ['sync:sri', '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const output = `${result.stdout}${result.stderr}`;

    if (result.status === UNREACHABLE_EXIT) {
      ctx.skip(`the asset CDN is unreachable, so no digest could be verified:\n${output}`);
      return;
    }

    expect(output).toContain('every login-page asset matches');
    expect(result.status, output).toBe(0);
  }, 60_000);
});

// A 404 is an answer about the URL, not a CDN nobody can reach. Classifying it
// as unreachable makes this suite skip on the one failure it exists to catch: a
// typo'd version in a pinned URL passes CI, and the login page's script tag then
// 404s at run time, leaving `Formio` undefined and `authenticate` hanging on a
// blank page. The check runs against a scratch source so the repository's own
// pins are untouched.
describe('a pinned asset the CDN does not have', () => {
  const MISSING = {
    url: 'https://cdn.jsdelivr.net/npm/@formio/js@0.0.0-does-not-exist/dist/formio.form.min.js',
    integrity: 'sha384-WI14pf615veSnkFtQYllUINR9h5mP1ukKxI47QtGb9DVDYvZlUeaOnWpK/G23Z5x',
  };

  it('fails rather than skipping', (ctx) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'login-sri-'));
    const source = path.join(dir, 'auth.ts');
    fs.writeFileSync(
      source,
      `export const LOGIN_PAGE_ASSETS = {\n  formioJs: {\n    url: '${MISSING.url}',\n    integrity: '${MISSING.integrity}',\n  },\n};\n`,
      'utf8'
    );

    try {
      const result = spawnSync('pnpm', ['sync:sri', '--check', `--source=${source}`], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      const output = `${result.stdout}${result.stderr}`;

      if (result.status === UNREACHABLE_EXIT) {
        ctx.skip(`the asset CDN is unreachable, so no status could be read:\n${output}`);
        return;
      }

      expect(result.status, output).toBe(1);
      expect(output).toContain(MISSING.url);
      // Writing cannot invent bytes the CDN does not serve, so the source is
      // left exactly as it was.
      expect(fs.readFileSync(source, 'utf8')).toContain(MISSING.integrity);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
