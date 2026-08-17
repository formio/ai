// Layout invariants that keep the library installable by the `skills` CLI into
// any agent's directory.
//
// The CLI installs once into a consumer project's `.agents/skills/` — the one
// path Cursor, Codex, and GitHub Copilot all read, and the only path Codex reads
// — and symlinks Claude Code to the same files. Two things break that: a skill
// reachable only through a symlink (the CLI does not follow them during
// discovery, which is why the committed `.claude/skills/formio-*` links are
// invisible to it), and a skill body that depends on being read from a
// client-specific directory.
//
// These are regression guards: the library satisfies them today, and they lock
// that in before the marketplace declaration makes the CLI the documented
// install path.

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const pluginDir = join(repoRoot, 'plugin');
const skillsRoot = join(pluginDir, 'skills');

// The marketplace entry declares this path; the CLI reads skill paths from it.
const MARKETPLACE = join(repoRoot, '.claude-plugin/marketplace.json');

const CLIENT_SKILL_DIRS = ['.claude/skills/', '.cursor/skills/', '.github/skills/'];

function markdownFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownFilesUnder(full);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function skillMdPathsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return skillMdPathsUnder(full);
    }
    return entry.isFile() && entry.name === 'SKILL.md' ? [full] : [];
  });
}

describe('no skill hides behind a symlink', () => {
  it('every SKILL.md is reachable without traversing one', () => {
    const throughSymlink = skillMdPathsUnder(skillsRoot).filter((skillMd) => {
      let current = dirname(skillMd);
      while (current !== skillsRoot && current !== repoRoot) {
        if (lstatSync(current).isSymbolicLink()) {
          return true;
        }
        current = dirname(current);
      }
      return lstatSync(skillMd).isSymbolicLink();
    });

    expect(throughSymlink.map((file) => relative(repoRoot, file))).toEqual([]);
  });
});

describe('no skill depends on a client-specific directory', () => {
  it('names no per-client skills directory outside an eval runbook', () => {
    const offenders = markdownFilesUnder(skillsRoot)
      .filter((file) => !file.includes('/evals/'))
      .filter((file) => {
        const body = readFileSync(file, 'utf8');
        return CLIENT_SKILL_DIRS.some((dir) => body.includes(dir));
      });

    expect(offenders.map((file) => relative(repoRoot, file))).toEqual([]);
  });
});

describe('the marketplace-declared path exposes the whole library', () => {
  it('declares ./plugin as the plugin source', () => {
    const marketplace = JSON.parse(readFileSync(MARKETPLACE, 'utf8')) as {
      plugins: Array<{ name: string; source: unknown }>;
    };
    const entry = marketplace.plugins.find((plugin) => plugin.name === 'formio-ai');

    expect(entry?.source).toBe('./plugin');
  });

  it('resolves every top-level skill from that path', () => {
    const declared = join(repoRoot, '.', 'plugin');
    const skills = readdirSync(join(declared, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(join(declared, 'skills', entry.name, 'SKILL.md')))
      .map((entry) => entry.name);

    expect(skills).toContain('formio-application');
    expect(skills).toContain('formio-resource-planner');
    expect(skills.length).toBeGreaterThanOrEqual(10);
  });

  it('resolves the nested Angular sub-skill from that path', () => {
    expect(
      existsSync(join(pluginDir, 'skills/formio-angular/formio-angular-resources/SKILL.md'))
    ).toBe(true);
  });
});
