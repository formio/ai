import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeProjectEntry } from '../project-map.js';
import {
  EXIT_BASE_URL_UNRESOLVED,
  EXIT_FAILED,
  EXIT_NOT_CONFIGURED,
  EXIT_OK,
  runProjectCommand,
} from '../cli/project-command.js';

// `project logout` signs a user out of one deployment by removing its entry from the
// token cache — the file the running server now checks before reusing a token it holds.
describe('project logout', () => {
  let cacheDir: string;

  const tokensFile = () => path.join(cacheDir, 'mcp-tokens.json');
  const writeTokens = (tokens: Record<string, string>) =>
    fs.writeFileSync(tokensFile(), JSON.stringify(tokens), { mode: 0o600 });
  const readTokens = (): Record<string, string> =>
    JSON.parse(fs.readFileSync(tokensFile(), 'utf8'));

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-logout-'));
  });

  afterEach(() => {
    fs.chmodSync(cacheDir, 0o700);
    if (fs.existsSync(tokensFile())) {
      fs.chmodSync(tokensFile(), 0o600);
    }
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('removes the token of the deployment --cwd resolves to, keeping every other entry', () => {
    writeProjectEntry({
      cwd: '/work/app',
      env: { FORMIO_PROJECT_URL: 'https://forms.mysite.com/myproject' },
      cacheDir,
    });
    writeTokens({
      'https://forms.mysite.com': 'mine',
      'https://api.form.io': 'another',
    });

    const result = runProjectCommand(['project', 'logout', '--cwd', '/work/app'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toContain('https://forms.mysite.com');
    expect(result.stdout).toMatch(/signed out/i);
    expect(readTokens()).toEqual({ 'https://api.form.io': 'another' });
  });

  it('resolves the deployment exactly as project get does, environment included', () => {
    writeTokens({ 'https://api.form.io': 'hosted', 'https://forms.mysite.com': 'other' });

    const result = runProjectCommand(['project', 'logout', '--cwd', '/work/unmapped'], {
      cacheDir,
      env: { FORMIO_PROJECT_URL: 'https://examples.form.io' },
    });

    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toContain('https://api.form.io');
    expect(readTokens()).toEqual({ 'https://forms.mysite.com': 'other' });
  });

  it('defaults --cwd to the current directory', () => {
    writeProjectEntry({
      cwd: '/work/here',
      env: { FORMIO_PROJECT_URL: 'https://examples.form.io' },
      cacheDir,
    });
    writeTokens({ 'https://api.form.io': 'hosted' });

    const result = runProjectCommand(['project', 'logout'], {
      cacheDir,
      env: {},
      cwd: '/work/here',
    });

    expect(result.exitCode).toBe(EXIT_OK);
    expect(readTokens()).toEqual({});
  });

  it('takes the deployment from --base-url directly, normalized', () => {
    writeTokens({ 'https://forms.mysite.com': 'mine', 'https://api.form.io': 'another' });

    const result = runProjectCommand(
      ['project', 'logout', '--base-url', ' https://Forms.MySite.com/ '],
      { cacheDir, env: {} }
    );

    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toContain('https://forms.mysite.com');
    expect(readTokens()).toEqual({ 'https://api.form.io': 'another' });
  });

  it('exits 0 saying no token was cached when the deployment has none', () => {
    writeTokens({ 'https://forms.mysite.com': 'mine' });

    const result = runProjectCommand(['project', 'logout', '--base-url', 'https://api.form.io'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toContain('https://api.form.io');
    expect(result.stdout).toMatch(/no token was cached/i);
    expect(readTokens()).toEqual({ 'https://forms.mysite.com': 'mine' });
  });

  it('exits 0 saying no token was cached when there is no cache file at all', () => {
    const result = runProjectCommand(['project', 'logout', '--base-url', 'https://api.form.io'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toMatch(/no token was cached/i);
    expect(fs.existsSync(tokensFile())).toBe(false);
  });

  it('exits 3 when the directory resolves a project but not its deployment', () => {
    writeProjectEntry({
      cwd: '/work/app',
      env: { FORMIO_PROJECT_URL: 'https://myproject.mysite.com' },
      cacheDir,
    });
    writeTokens({ 'https://api.mysite.com': 'mine' });

    const result = runProjectCommand(['project', 'logout', '--cwd', '/work/app'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_BASE_URL_UNRESOLVED);
    expect(result.stderr).toContain('--base-url');
    expect(readTokens()).toEqual({ 'https://api.mysite.com': 'mine' });
  });

  // The same answer `project get` gives an unconfigured directory: nothing is mapped,
  // which is not the half-configured state exit 3 reports.
  it('exits 1 when the directory resolves no project at all, as project get does', () => {
    writeTokens({ 'https://api.form.io': 'hosted' });

    const result = runProjectCommand(['project', 'logout', '--cwd', '/work/unmapped'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_NOT_CONFIGURED);
    expect(result.stderr).toContain('--base-url');
    expect(result.stderr).toContain('No Form.io project is configured');
    expect(readTokens()).toEqual({ 'https://api.form.io': 'hosted' });
  });

  it('exits 2, leaving the file untouched, when the cache cannot be read', () => {
    fs.writeFileSync(tokensFile(), '{ not json');

    const result = runProjectCommand(['project', 'logout', '--base-url', 'https://api.form.io'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_FAILED);
    expect(result.stderr).toContain(tokensFile());
    expect(fs.readFileSync(tokensFile(), 'utf8')).toBe('{ not json');
  });

  // The cache is replaced by renaming a new file into its directory, so what blocks a
  // write is a directory that cannot be written, not the file's own mode.
  it.skipIf(process.getuid?.() === 0)('exits 2 when the cache cannot be written', () => {
    writeTokens({ 'https://api.form.io': 'hosted' });
    fs.chmodSync(cacheDir, 0o500);

    const result = runProjectCommand(['project', 'logout', '--base-url', 'https://api.form.io'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_FAILED);
    expect(result.stderr).toContain(tokensFile());
  });

  // The caller typed the URL, so it is re-asked for, as `project set` answers it.
  it('exits 1, naming the value as typed, when --base-url is not a valid URL', () => {
    writeTokens({ 'https://api.form.io': 'hosted' });

    const result = runProjectCommand(['project', 'logout', '--base-url', 'htps//api.form.io'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_NOT_CONFIGURED);
    expect(result.stderr).toContain('htps//api.form.io');
    expect(result.stderr).toMatch(/ask the user for the url again/i);
    expect(readTokens()).toEqual({ 'https://api.form.io': 'hosted' });
  });

  it('refuses an unknown flag as a usage error', () => {
    const result = runProjectCommand(['project', 'logout', '--project-url', 'https://x.form.io'], {
      cacheDir,
      env: {},
    });

    expect(result.exitCode).toBe(EXIT_FAILED);
    expect(result.stderr).toContain('logout');
  });
});
