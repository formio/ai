import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CommittedConfigUnusableError,
  COMMITTED_CONFIG_FILE,
  committedConfigWritePath,
  findCommittedConfig,
} from '../committed-config.js';

// The mapping in ~/.formio/projects.json is keyed by absolute path and lives in a
// home directory, so a clone has nothing and no reviewer can see what a branch
// targets. This file is the versionable answer: it travels with the code, and the
// upward walk is what makes it per-folder.
describe('the committed formio.json', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-committed-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function write(dir: string, contents: string | Record<string, unknown>): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, COMMITTED_CONFIG_FILE),
      typeof contents === 'string' ? contents : JSON.stringify(contents)
    );
  }

  function repo(dir: string): void {
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  }

  describe('shape', () => {
    it('reads a file holding only projectUrl, stripping trailing slashes', () => {
      repo(root);
      write(root, { projectUrl: 'https://examples.form.io/' });

      const found = findCommittedConfig(root);

      expect(found?.projectUrl).toBe('https://examples.form.io');
      expect(found?.baseUrl).toBeUndefined();
    });

    it('reads a file holding both URLs', () => {
      repo(root);
      write(root, {
        projectUrl: 'https://myproject.mysite.com',
        baseUrl: 'https://forms.mysite.com',
      });

      const found = findCommittedConfig(root);

      expect(found?.projectUrl).toBe('https://myproject.mysite.com');
      expect(found?.baseUrl).toBe('https://forms.mysite.com');
    });

    // So the file can carry a $schema or a convention-comment key without the
    // resolver rejecting it.
    it('ignores unknown keys', () => {
      repo(root);
      write(root, { $schema: './formio.schema.json', projectUrl: 'https://x.form.io' });

      expect(findCommittedConfig(root)?.projectUrl).toBe('https://x.form.io');
    });

    it('rejects a file with no projectUrl, naming the path and the key', () => {
      repo(root);
      write(root, { baseUrl: 'https://forms.mysite.com' });

      let message = '';
      try {
        findCommittedConfig(root);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain(path.join(root, COMMITTED_CONFIG_FILE));
      expect(message).toContain('projectUrl');
    });

    // Sending the caller to project_set would write a mapping this file then
    // shadows: the symptom clears, the cause persists, and the precedence rule
    // hides it.
    it('does not report an unusable file as an unconfigured directory', () => {
      repo(root);
      write(root, { projectUrl: 'not-a-url' });

      let message = '';
      try {
        findCommittedConfig(root);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('projectUrl');
      expect(message).not.toMatch(/No Form\.io project is configured/);
    });

    it('raises a distinguishable error type for an unparseable file', () => {
      repo(root);
      write(root, '{ not json');

      expect(() => findCommittedConfig(root)).toThrow(CommittedConfigUnusableError);
    });
  });

  describe('discovery', () => {
    it('takes the nearest file when an ancestor also has one', () => {
      repo(root);
      write(root, { projectUrl: 'https://root.form.io' });
      const nested = path.join(root, 'apps', 'web');
      write(nested, { projectUrl: 'https://web.form.io' });

      expect(findCommittedConfig(nested)?.projectUrl).toBe('https://web.form.io');
    });

    it('lets an ancestor govern a directory with no file of its own', () => {
      repo(root);
      write(root, { projectUrl: 'https://root.form.io' });
      const nested = path.join(root, 'apps', 'api');
      fs.mkdirSync(nested, { recursive: true });

      expect(findCommittedConfig(nested)?.projectUrl).toBe('https://root.form.io');
    });

    it('reports the path of the file it used', () => {
      repo(root);
      write(root, { projectUrl: 'https://root.form.io' });
      const nested = path.join(root, 'packages', 'thing');
      fs.mkdirSync(nested, { recursive: true });

      expect(findCommittedConfig(nested)?.filePath).toBe(path.join(root, COMMITTED_CONFIG_FILE));
    });

    // Without the boundary a stray file in a home directory silently governs every
    // repository beneath it — the same silent wrong-deployment failure the
    // shape-aware base-URL rules exist to prevent, reached from a new direction.
    it('does not ascend past a directory containing .git', () => {
      write(root, { projectUrl: 'https://outside.form.io' });
      const workspace = path.join(root, 'work', 'app');
      repo(workspace);

      expect(findCommittedConfig(workspace)).toBeUndefined();
    });

    it('searches the directory holding .git, so a repository-root file is found', () => {
      const workspace = path.join(root, 'work', 'app');
      repo(workspace);
      write(workspace, { projectUrl: 'https://inside.form.io' });
      const nested = path.join(workspace, 'packages', 'thing');
      fs.mkdirSync(nested, { recursive: true });

      expect(findCommittedConfig(nested)?.projectUrl).toBe('https://inside.form.io');
    });

    it('returns undefined when no file exists anywhere in range', () => {
      repo(root);

      expect(findCommittedConfig(root)).toBeUndefined();
    });
  });

  // Where `project set --scope repo` writes. A broken file is the file to repair —
  // CommittedConfigUnusableError says so in as many words — so the write path has
  // to land ON it. Falling back to <cwd>/formio.json created a second file in a
  // subdirectory and left the unusable ancestor governing every sibling of it,
  // with the reported cause untouched.
  describe('where a repo-scoped write lands', () => {
    it('rewrites the nearest existing file rather than shadowing it', () => {
      repo(root);
      write(root, { projectUrl: 'https://inside.form.io' });
      const nested = path.join(root, 'packages', 'thing');
      fs.mkdirSync(nested, { recursive: true });

      expect(committedConfigWritePath(nested)).toBe(path.join(root, COMMITTED_CONFIG_FILE));
    });

    it('creates one in the caller’s own directory when the walk finds none', () => {
      repo(root);
      const nested = path.join(root, 'packages', 'thing');
      fs.mkdirSync(nested, { recursive: true });

      expect(committedConfigWritePath(nested)).toBe(path.join(nested, COMMITTED_CONFIG_FILE));
    });

    it('targets an unusable ancestor rather than creating a second file below it', () => {
      repo(root);
      write(root, '{ not json');
      const nested = path.join(root, 'packages', 'thing');
      fs.mkdirSync(nested, { recursive: true });

      expect(committedConfigWritePath(nested)).toBe(path.join(root, COMMITTED_CONFIG_FILE));
    });

    it('names the offending file on the error itself', () => {
      repo(root);
      write(root, '{ not json');

      expect(() => findCommittedConfig(root)).toThrow(CommittedConfigUnusableError);
      try {
        findCommittedConfig(root);
      } catch (error) {
        expect((error as CommittedConfigUnusableError).filePath).toBe(
          path.join(root, COMMITTED_CONFIG_FILE)
        );
      }
    });
  });
});
