// The OpenSpec skill mirrors are generated, not committed.
//
// `skills` CLI discovery is additive across a repository's agent directories, and
// its `-s` flag takes exact names rather than globs (`-s 'formio-*'` answers
// "No matching skills found"). So while these mirrors are tracked, a developer
// running `npx skills add formio/ai` is offered this repository's OpenSpec and
// TDD workflow skills alongside the Form.io library, with no way to filter them
// out at install time. Removing them from version control is the only fix.
//
// The `.claude/skills/formio-*` symlinks stay tracked: they are how this
// repository's own Claude Code sessions load the library, and the CLI ignores
// them because it does not follow symlinks while discovering skills.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const GENERATED_MIRROR_PATTERN =
  /^(\.claude\/skills\/(openspec|tdd)-|\.cursor\/skills\/|\.github\/skills\/)/;

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

describe('generated OpenSpec skill mirrors', () => {
  it('are not tracked by git', () => {
    const tracked = trackedFiles().filter((file) => GENERATED_MIRROR_PATTERN.test(file));

    expect(tracked).toEqual([]);
  });

  it('are covered by .gitignore', () => {
    const ignored = readFileSync(join(repoRoot, '.gitignore'), 'utf8');

    for (const pattern of [
      '.claude/skills/openspec-',
      '.claude/skills/tdd-',
      '.cursor/skills/',
      '.github/skills/',
    ]) {
      expect(ignored, `.gitignore must cover ${pattern}`).toContain(pattern);
    }
  });
});

describe('the development symlinks into plugin/skills', () => {
  it('are still tracked', () => {
    const tracked = trackedFiles().filter((file) => file.startsWith('.claude/skills/formio-'));

    expect(tracked).toContain('.claude/skills/formio-application');
    expect(tracked).toContain('.claude/skills/formio-api');
    expect(tracked.length).toBeGreaterThanOrEqual(10);
  });

  it('are symlinks, which is why the skills CLI ignores them', () => {
    const entries = execFileSync('git', ['ls-files', '-s', '.claude/skills'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((line) => line.includes('.claude/skills/formio-'));

    for (const entry of entries) {
      expect(entry.startsWith('120000'), `${entry} should be mode 120000 (symlink)`).toBe(true);
    }
  });
});
