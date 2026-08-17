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

// Naming the roadmap in order to forbid it is not a reference to it: these files
// would be unable to state the rule without saying what the rule is about. Every
// other tracked file must be able to stand on its own in a clone that lacks it.
//
// Matched by pattern rather than by literal prefix because two of them move.
// `openspec archive` relocates a change from openspec/changes/<name>/ to
// openspec/changes/archive/<date>-<name>/, and it derives openspec/specs/
// <capability>/spec.md from the change's delta on the way — so an allowlist
// written against the pre-archive path goes stale the moment the change is
// archived, which is exactly what happened here.
const NAMES_IT_ONLY_TO_FORBID_IT = [
  /^packages\/skill-tests\/src\/shipped-surface\//,
  /^openspec\/changes\/(archive\/\d{4}-\d{2}-\d{2}-)?prune-shipped-surface\//,
  /^openspec\/specs\/shipped-surface-boundary\//,
];

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
      .filter((path) => !NAMES_IT_ONLY_TO_FORBID_IT.some((allowed) => allowed.test(path)))
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
