// Initiative planning and third-party review-queue tracking are useful to
// whoever is doing the work and residue to everyone else. They live on a
// maintainer's disk, not in the public tree — so these assert what git tracks,
// never what exists on disk.

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();

const LOCAL_ONLY = ['docs/multi-agent-portability.md', 'MARKETPLACE.md'] as const;

describe('initiative artifacts are not committed', () => {
  it.each(LOCAL_ONLY)('%s is not tracked', (path) => {
    const tracked = git('ls-files', '--', path);

    expect(tracked, `${path} must not be committed to the public repository`).toBe('');
  });

  it.each(LOCAL_ONLY)('%s is covered by .gitignore', (path) => {
    // check-ignore exits non-zero when the path is NOT ignored.
    let ignored = true;
    try {
      git('check-ignore', '--', path);
    } catch {
      ignored = false;
    }

    expect(ignored, `${path} must be listed in .gitignore so it cannot drift back in`).toBe(true);
  });
});

describe('no tracked file depends on the roadmap', () => {
  it('nothing references it', () => {
    // grep over the index rather than the working tree: the file may well exist
    // locally, and that is the point.
    let hits = '';
    try {
      hits = git('grep', '-l', '--cached', 'multi-agent-portability');
    } catch {
      hits = '';
    }

    const offenders = hits
      .split('\n')
      .filter(Boolean)
      // This suite names it in order to forbid it, as does the change that did the work.
      .filter((path) => !path.startsWith('packages/skill-tests/src/shipped-surface/'))
      .filter((path) => !path.startsWith('openspec/changes/prune-shipped-surface/'))
      .filter((path) => path !== '.gitignore');

    expect(offenders).toEqual([]);
  });
});

describe('.gitignore explains why', () => {
  it('states the reason rather than listing bare paths', () => {
    const body = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
    const section = body.slice(body.indexOf('multi-agent-portability'));

    expect(section.length).toBeGreaterThan(0);
    expect(body).toMatch(/initiative|roadmap/i);
  });
});
