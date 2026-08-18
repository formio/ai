// A server release drags the plugin with it.
//
// `pnpm sync:pins` writes the server's version into files that live inside the
// plugin package — the three client manifests and every skill. If a release
// bumps `@formio/mcp` alone, those files change but `@formio/ai` never
// republishes, so the plugin on npm keeps launching the previous server. The
// alternative — hand-adding a second changeset on every server fix — is the
// step people forget.
//
// So `changeset:version` adds it: whenever pending changesets bump the server
// and not the plugin, one is written for the plugin before `changeset version`
// consumes them, and the Version Packages PR carries both.
//
// Driven through the CLI rather than by importing the script, like the manifest
// sync tests: scripts/ live outside this package's rootDir. A directory argument
// keeps every case on a scratch copy, so a test can never add a changeset to the
// release the repository is actually staging.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SERVER_PACKAGE = '@formio/mcp';
const PLUGIN_PACKAGE = '@formio/ai';

const serverPatch = `---\n'${SERVER_PACKAGE}': patch\n---\n\nFix a thing.\n`;
const pluginPatch = `---\n'${PLUGIN_PACKAGE}': patch\n---\n\nDocument a thing.\n`;

function changesetDir(entries: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changesets-'));
  // The directory's own files, which are not changesets.
  fs.writeFileSync(path.join(dir, 'README.md'), '# Changesets\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'config.json'), '{}\n', 'utf8');
  for (const [name, body] of Object.entries(entries)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }
  return dir;
}

function follow(dir: string): { stdout: string; status: number | null } {
  const result = spawnSync('pnpm', ['changeset:follow', dir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return { stdout: `${result.stdout}${result.stderr}`, status: result.status };
}

function changesets(dir: string): string[] {
  return fs.readdirSync(dir).filter((entry) => entry.endsWith('.md') && entry !== 'README.md');
}

function bumpedPackages(dir: string): string[] {
  return [
    ...new Set(
      changesets(dir).flatMap((entry) => {
        const frontmatter = fs.readFileSync(path.join(dir, entry), 'utf8').split('---')[1] ?? '';
        return [...frontmatter.matchAll(/["']?(@[\w./-]+)["']?\s*:\s*(?:major|minor|patch)/g)].map(
          (match) => match[1]
        );
      })
    ),
  ];
}

describe('the plugin follows a server release', () => {
  it('adds a plugin changeset when only the server is bumped', () => {
    const dir = changesetDir({ 'a.md': serverPatch });

    try {
      const { stdout, status } = follow(dir);

      expect(status).toBe(0);
      expect(stdout).toContain(PLUGIN_PACKAGE);
      expect(bumpedPackages(dir).sort()).toEqual([PLUGIN_PACKAGE, SERVER_PACKAGE].sort());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('writes nothing when the plugin is already in the release', () => {
    const dir = changesetDir({ 'a.md': serverPatch, 'b.md': pluginPatch });

    try {
      expect(follow(dir).status).toBe(0);
      expect(changesets(dir).sort()).toEqual(['a.md', 'b.md']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // A plugin-only release changes nothing the server publishes, so the coupling
  // is deliberately one-directional.
  it('writes nothing when the server is not in the release', () => {
    const dir = changesetDir({ 'b.md': pluginPatch });

    try {
      expect(follow(dir).status).toBe(0);
      expect(changesets(dir)).toEqual(['b.md']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // Two runs before one `changeset version` — a local rehearsal, then CI — must
  // not leave two plugin bumps, which would move the plugin two patches.
  it('is idempotent', () => {
    const dir = changesetDir({ 'a.md': serverPatch });

    try {
      follow(dir);
      follow(dir);

      expect(changesets(dir)).toHaveLength(2);
      expect(bumpedPackages(dir).sort()).toEqual([PLUGIN_PACKAGE, SERVER_PACKAGE].sort());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

// The other direction, which the coupling above does not cover: whether the
// pending changesets release everything the branch touched. A PR that edits the
// server and writes only an `@formio/ai` changeset version-bumps the plugin,
// leaves the server behind, and `pnpm -r publish` skips it — so the fix looks
// released while npm still serves the build without it, and every manifest pins
// that build.
describe('a change to published content has a release', () => {
  function coverage(
    changed: string[],
    dir: string,
    ...flags: string[]
  ): { stdout: string; status: number | null } {
    const result = spawnSync(
      'pnpm',
      ['check:releases', `--changed=${changed.join(',')}`, ...flags, dir],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }
    );
    return { stdout: `${result.stdout}${result.stderr}`, status: result.status };
  }

  it('fails when the server changed and only the plugin is released', () => {
    const dir = changesetDir({ 'b.md': pluginPatch });

    try {
      const { stdout, status } = coverage(['packages/mcp-server/src/auth.ts'], dir);

      expect(status).not.toBe(0);
      expect(stdout).toContain(SERVER_PACKAGE);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('fails when the plugin changed and only the server is released', () => {
    const dir = changesetDir({ 'a.md': serverPatch });

    try {
      const { stdout, status } = coverage(['plugin/skills/formio-api/SKILL.md'], dir);

      expect(status).not.toBe(0);
      expect(stdout).toContain(PLUGIN_PACKAGE);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it('passes when both are changed and both are released', () => {
    const dir = changesetDir({ 'a.md': serverPatch, 'b.md': pluginPatch });

    try {
      const { status } = coverage(
        ['packages/mcp-server/src/auth.ts', 'plugin/skills/formio-api/SKILL.md'],
        dir
      );

      expect(status).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // A test-only or changelog-only edit publishes nothing, so demanding a
  // changeset for it would train people to write empty ones.
  it('ignores tests and changelogs', () => {
    const dir = changesetDir({});

    try {
      const { status } = coverage(
        [
          'packages/mcp-server/src/__tests__/plugin-manifests.test.ts',
          'plugin/CHANGELOG.md',
          'packages/skill-tests/src/skill-descriptions/helpers.ts',
        ],
        dir
      );

      expect(status).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // The npm tarball ships `dist/` (built from `src/`) and README.md, and nothing
  // else in the package tree. A PR that only edits build config, the Dockerfile,
  // or the package's docs publishes no different bytes, so demanding a release
  // for it asks for a byte-identical version bump — which `changeset:follow`
  // then drags the plugin and a repo-wide pin restamp along with.
  it('ignores server files that are not packed into the tarball', () => {
    const dir = changesetDir({});

    try {
      const { status, stdout } = coverage(
        [
          'packages/mcp-server/vitest.config.ts',
          'packages/mcp-server/tsconfig.json',
          'packages/mcp-server/Dockerfile',
          'packages/mcp-server/DOCKERHUB.md',
          'packages/mcp-server/docs/architecture.png',
          'packages/mcp-server/inspector-config.json',
        ],
        dir
      );

      expect(status, stdout).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // The other direction: what is packed still needs a release. README.md renders
  // on npmjs.com and is copied into the .mcpb bundle, and package.json carries
  // the version every pin is stamped from.
  it.each([
    'packages/mcp-server/src/auth.ts',
    'packages/mcp-server/README.md',
    'packages/mcp-server/package.json',
  ])(
    'still demands a release for %s',
    (file) => {
      const dir = changesetDir({});

      try {
        const { status, stdout } = coverage([file], dir);

        expect(status).not.toBe(0);
        expect(stdout).toContain(SERVER_PACKAGE);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    30_000
  );

  // The Version Packages PR is the one PR whose only step is merging it, and it
  // is the one PR that trips this check: `changeset version` has already consumed
  // every changeset, so nothing is pending, while the commit it carries rewrites
  // both packages' version fields and the pins stamped from them. Asking for a
  // changeset there asks for one that would undo the release, so the check skips
  // that branch entirely rather than turning it red.
  it.each(['changeset-release/main', 'changeset-release/next'])(
    'skips the release PR on %s',
    (head) => {
      const dir = changesetDir({});

      try {
        const { stdout, status } = coverage(
          [
            'packages/mcp-server/package.json',
            'plugin/package.json',
            'plugin/mcp.json',
            'plugin/skills/formio-api/SKILL.md',
          ],
          dir,
          `--head=${head}`
        );

        expect(status).toBe(0);
        expect(stdout).toContain(head);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
    30_000
  );

  // Any other branch is an ordinary PR, and the check still applies there — a
  // head-branch exemption that leaked would disable the check for every PR.
  it('still fails on an ordinary branch', () => {
    const dir = changesetDir({});

    try {
      const { status } = coverage(['plugin/mcp.json'], dir, '--head=fix/a-thing');

      expect(status).not.toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
