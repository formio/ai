import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runProjectCommand } from '../cli/project-command.js';
import { canonicalDir, readProjectEntry } from '../project-map.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

// A directory with no mapping of its own inherits the one recorded for its nearest
// mapped ancestor. A remedy about that mapping names the directory that holds it: that
// is where it is cleared or replaced.
describe('remedies for an inherited mapping', () => {
  let cacheDir: string;
  let repo: string;
  let sub: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-inherited-cache-'));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-inherited-repo-'));
    fs.mkdirSync(path.join(repo, '.git'));
    sub = path.join(repo, 'apps', 'web');
    fs.mkdirSync(sub, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  const run = (argv: string[]) => runProjectCommand(['project', ...argv], { cacheDir, env: {} });

  const seedUnusable = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'projects.json'),
      JSON.stringify({ [canonicalDir(repo)]: { env: { FORMIO_PROJECT_URL: 'notaurl' } } })
    );
  };

  describe('project set --reset in a directory that inherits', () => {
    it("says the mapping is the ancestor's and that the reset is run there, and clears nothing", () => {
      run(['set', '--project-url', 'https://examples.form.io', '--cwd', repo]);

      const result = run(['set', '--reset', '--cwd', sub]);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        `${sub} inherits the mapping recorded for ${canonicalDir(repo)}`
      );
      expect(result.stdout).toContain(`set --reset --cwd ${canonicalDir(repo)}`);
      expect(readProjectEntry(repo, cacheDir)?.env.FORMIO_PROJECT_URL).toBe(
        'https://examples.form.io'
      );
    });

    it('still says there is nothing to clear where nothing is mapped at all', () => {
      const result = run(['set', '--reset', '--cwd', sub]);

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/nothing to clear/);
      expect(result.stdout).not.toContain('inherits');
    });
  });

  describe('a refusal over an inherited mapping that cannot answer', () => {
    it('project set names the directory that holds the mapping', () => {
      seedUnusable(cacheDir);

      const result = run(['set', '--base-url', 'https://api.mysite.com', '--cwd', sub]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        `set --project-url <project_url> --cwd ${canonicalDir(repo)}`
      );
      expect(result.stderr).not.toContain(`--cwd ${sub}`);
    });

    it('project_set names the directory that holds the mapping', async () => {
      seedUnusable(path.join(os.homedir(), '.formio'));
      const client = await connectTools((server) => registerProjectSetTool(server));

      const result = await client.callTool({
        name: 'project_set',
        arguments: { baseUrl: 'https://api.mysite.com', cwd: sub },
      });
      const text = (result.content as { text: string }[])[0].text;

      expect(result.isError).toBe(true);
      expect(text).toContain(`Call project_set again with cwd ${canonicalDir(repo)}`);
      expect(text).not.toContain(`cwd ${sub}`);
    });
  });
});
