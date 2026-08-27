import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeProjectEntry } from '../project-map.js';
import {
  EXIT_BASE_URL_UNRESOLVED,
  EXIT_FAILED,
  runProjectCommand,
} from '../cli/project-command.js';

// `project get` is the read surface skills consume, so its report on the base
// URL has to distinguish a value the user named from one the resolver worked out
// from one that does not exist. Collapsing those is how a caller ends up
// persisting a value nothing persisted, or trusting a default that is wrong.
describe('project get reports how the base URL was resolved', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-project-baseurl-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function get(cwd: string) {
    return runProjectCommand(['project', 'get', '--cwd', cwd], { cacheDir, env: {} });
  }

  it('names a derived base URL as derived, not as mapped or defaulted', () => {
    writeProjectEntry({
      cwd: '/w/subdir',
      env: { FORMIO_PROJECT_URL: 'https://forms.mysite.com/myproject' },
      cacheDir: cacheDir,
    });

    const result = get('/w/subdir');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Base URL:    https://forms.mysite.com');
    expect(result.stdout).toMatch(/deriv/i);
    expect(result.stdout).not.toContain('the default');
  });

  it('derives a sub-path deployment without flattening it to the origin', () => {
    writeProjectEntry({
      cwd: '/w/subpath',
      env: { FORMIO_PROJECT_URL: 'https://forms.mysite.com/one/two' },
      cacheDir: cacheDir,
    });

    const result = get('/w/subpath');

    expect(result.stdout).toContain('Base URL:    https://forms.mysite.com/one');
    expect(result.stdout).not.toContain('Base URL:    https://forms.mysite.com\n');
  });

  describe('when the base URL cannot be determined', () => {
    beforeEach(() => {
      writeProjectEntry({
        cwd: '/w/subdomain',
        env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
        cacheDir: cacheDir,
      });
    });

    // Exit 1 means "nothing is mapped", whose documented remedy is supplying a
    // project URL. This directory HAS one, so a 1 would send the caller into the
    // wrong interview.
    it('exits neither 0 nor the 1 that means nothing is mapped', () => {
      expect([0, 1]).not.toContain(get('/w/subdomain').exitCode);
    });

    // Nor a 2. That code means the command could not answer AT ALL — an unreadable
    // map, a formio.json that will not parse — and every skill's preflight
    // branches on it by stopping without interviewing. This branch has an answer
    // and an actionable remedy: one value, named, with the command that records
    // it. Collapsed into 2, the one deployment shape this surface exists to serve
    // dead-ended on its own guidance.
    it('exits 3, the code that means one named value is missing', () => {
      expect(get('/w/subdomain').exitCode).toBe(EXIT_BASE_URL_UNRESOLVED);
      expect(EXIT_BASE_URL_UNRESOLVED).toBe(3);
    });

    it('keeps 2 for a command that could not answer at all', () => {
      const broken = runProjectCommand(['project', 'get', '--cwd', 'relative/path'], {
        cacheDir,
        env: {},
      });

      expect(broken.exitCode).toBe(EXIT_FAILED);
      expect(EXIT_FAILED).toBe(2);
    });

    it('names project set and its --base-url argument', () => {
      const { stderr } = get('/w/subdomain');

      expect(stderr).toContain('project set');
      expect(stderr).toContain('--base-url');
    });

    it('still reports the project URL, because that half is configured', () => {
      const { stderr } = get('/w/subdomain');

      expect(stderr).toContain('https://myproject.mysite.com');
    });

    it('never presents https://api.form.io as the resolved base URL', () => {
      const { stdout, stderr } = get('/w/subdomain');

      expect(stdout).not.toContain('https://api.form.io');
      expect(stderr).not.toContain('https://api.form.io');
    });

    // An API-key deployment reads no base URL, so the project is not unusable —
    // only its JWT login is blocked.
    it('says JWT authentication is what is blocked', () => {
      expect(get('/w/subdomain').stderr).toMatch(/JWT/i);
    });
  });
});
