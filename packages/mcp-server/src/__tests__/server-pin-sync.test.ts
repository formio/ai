// What counts as a launch of @formio/mcp, and what does not.
//
// `pnpm sync:pins` rewrites every launch of the published server to the version
// in packages/mcp-server/package.json. The risk runs both ways: a launch
// spelling the script does not recognise ships unpinned — the exact pattern the
// pin exists to remove — and a pattern that matches too much silently corrupts a
// document, because the same regex also decides what `--check` and
// `pnpm build:plugin` consider stale.
//
// Driven through the CLI with explicit file arguments, like the changeset
// scripts' directory argument: scripts/ lives outside this package's rootDir,
// and a scratch copy keeps a test from rewriting the repository's own pins.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SERVER_VERSION = (
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/mcp-server/package.json'), 'utf8')) as {
    version: string;
  }
).version;

function scratch(name: string, body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-pins-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function sync(file: string, ...flags: string[]): { stdout: string; status: number | null } {
  const result = spawnSync('pnpm', ['sync:pins', ...flags, file], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return { stdout: `${result.stdout}${result.stderr}`, status: result.status };
}

function pinnedText(name: string, body: string): string {
  const file = scratch(name, body);
  try {
    sync(file);
    return fs.readFileSync(file, 'utf8');
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

describe('what sync:pins rewrites', () => {
  // Every spelling that resolves the registry's current release at run time, and
  // so ships the floating launch the pin exists to remove.
  it.each([
    ['npx', 'Run `npx @formio/mcp` to start it.'],
    ['npx -y', 'Run `npx -y @formio/mcp` to start it.'],
    ['npx --yes', 'Run `npx --yes @formio/mcp` to start it.'],
    ['npm exec', 'Run `npm exec @formio/mcp` to start it.'],
    ['npm exec --', 'Run `npm exec -- @formio/mcp` to start it.'],
    ['pnpm dlx', 'Run `pnpm dlx @formio/mcp` to start it.'],
    ['npm x', 'Run `npm x @formio/mcp` to start it.'],
    ['yarn dlx', 'Run `yarn dlx @formio/mcp` to start it.'],
    ['bunx', 'Run `bunx @formio/mcp` to start it.'],
    ['npm install -g', 'Offline: `npm install -g @formio/mcp`.'],
    ['npm i --global', 'Offline: `npm i --global @formio/mcp`.'],
  ])(
    'pins a %s launch',
    (_spelling, line) => {
      expect(pinnedText('doc.md', `${line}\n`)).toBe(
        `${line.replace('@formio/mcp', `@formio/mcp@${SERVER_VERSION}`)}\n`
      );
    },
    30_000
  );

  it('pins the package string inside a manifest args array', () => {
    const manifest = '{\n  "args": ["-y", "@formio/mcp"]\n}\n';

    expect(pinnedText('mcp.json', manifest)).toBe(
      `{\n  "args": ["-y", "@formio/mcp@${SERVER_VERSION}"]\n}\n`
    );
  }, 30_000);

  it('pins the package string in a TOML args array with no yes flag', () => {
    expect(pinnedText('config.toml', 'args = ["@formio/mcp"]\n')).toBe(
      `args = ["@formio/mcp@${SERVER_VERSION}"]\n`
    );
  }, 30_000);

  // TOML literal strings are single-quoted, and a client that writes its config
  // that way is writing the same launch. Detection that only sees double quotes
  // fails open: `sync:pins` reports success, `--check` passes, and the shipped
  // config launches the floating package.
  it('pins the package string inside a single-quoted args array', () => {
    expect(pinnedText('config.toml', "args = ['-y', '@formio/mcp']\n")).toBe(
      `args = ['-y', '@formio/mcp@${SERVER_VERSION}']\n`
    );
  }, 30_000);

  it('pins a single-quoted args array with no yes flag', () => {
    expect(pinnedText('config.toml', "args = ['@formio/mcp']\n")).toBe(
      `args = ['@formio/mcp@${SERVER_VERSION}']\n`
    );
  }, 30_000);

  it('restamps a launch that names an older version', () => {
    expect(pinnedText('doc.md', 'Run `npx -y @formio/mcp@0.0.1`.\n')).toBe(
      `Run \`npx -y @formio/mcp@${SERVER_VERSION}\`.\n`
    );
  }, 30_000);
});

describe('what sync:pins leaves alone', () => {
  // A quoted package name is a launch only inside an args array. Everywhere else
  // the quotes mean something else entirely, and stamping a version into them
  // produces an invalid dependency key, an unmatchable filter, or a broken
  // registry entry — and `assertServerPinsAgree` then fails the plugin build
  // until the corruption is committed.
  it.each([
    ['a dependency range', '{\n  "dependencies": { "@formio/mcp": "^0.9.0" }\n}\n'],
    ['a workspace filter', 'Run `pnpm --filter "@formio/mcp" test`.\n'],
    ['the registry identifier', '{\n  "identifier": "@formio/mcp"\n}\n'],
    ['a prose mention', 'The `@formio/mcp` server exposes form_* tools.\n'],
    ['an npm scripts entry', '{\n  "scripts": { "start": "node bin/mcp.js" }\n}\n'],
  ])(
    'leaves %s untouched',
    (_what, body) => {
      expect(pinnedText('doc.md', body)).toBe(body);
    },
    30_000
  );

  // `@formio/mcp` is a prefix of every `@formio/mcp-*` package name. Without a
  // name boundary the stamper rewrites a sibling's launch into
  // `@formio/mcp@<version>-utils` and a second run truncates it — corruption
  // committed into the Version Packages PR by the script that claims to fix pins.
  it.each([
    ['a sibling package launch', 'Run `npx -y @formio/mcp-utils` to inspect it.\n'],
    ['a sibling package in an args array', '{\n  "args": ["-y", "@formio/mcp-utils"]\n}\n'],
  ])(
    'leaves %s untouched',
    (_what, body) => {
      expect(pinnedText('doc.md', body)).toBe(body);
    },
    30_000
  );

  it('leaves the placeholder in prose about the pin itself', () => {
    const body = 'Every launch carries the version — `npx -y @formio/mcp@<version>`.\n';

    expect(pinnedText('doc.md', body)).toBe(body);
  }, 30_000);
});

// The GitHub release notes are a fourth set of install instructions, published
// on every release and read by anyone who lands on the tag. They are not under
// plugin/skills, not in FIXED_TARGETS, and not markdown — so `sync:pins` never
// sees them, and an unpinned launch there would ship the floating package this
// pin exists to remove with nothing to flag it. The workflow interpolates the
// version it just released instead, so there is no literal to restamp.
describe('the workflows launch no floating server', () => {
  const WORKFLOWS = path.join(REPO_ROOT, '.github/workflows');

  // Mirrors the runner spellings in scripts/sync-server-pin.ts, including the
  // `(?![@\w-])` package-name boundary that keeps `@formio/mcp-utils` out.
  const UNPINNED_LAUNCH =
    /(?:npx|npm\s+exec|npm\s+x|pnpm\s+dlx|yarn\s+dlx|bunx)\s+(?:(?:-y|--yes)\s+)?(?:--\s+)?@formio\/mcp(?![@\w-])/;

  it.each(fs.readdirSync(WORKFLOWS).filter((file) => file.endsWith('.yml')))(
    '%s pins every @formio/mcp launch it prints',
    (file) => {
      const unpinned = fs
        .readFileSync(path.join(WORKFLOWS, file), 'utf8')
        .split('\n')
        .filter((line) => UNPINNED_LAUNCH.test(line));

      expect(unpinned.map((line) => line.trim())).toEqual([]);
    }
  );
});

describe('sync:pins --check', () => {
  it('fails on an unpinned launch and writes nothing', () => {
    const body = 'Run `npx -y @formio/mcp`.\n';
    const file = scratch('doc.md', body);

    try {
      const { status, stdout } = sync(file, '--check');

      expect(status).not.toBe(0);
      expect(stdout).toContain('doc.md');
      expect(fs.readFileSync(file, 'utf8')).toBe(body);
    } finally {
      fs.rmSync(path.dirname(file), { recursive: true, force: true });
    }
  }, 30_000);

  it('passes on a document with no launch in it', () => {
    const file = scratch('doc.md', 'The `@formio/mcp` server exposes form_* tools.\n');

    try {
      expect(sync(file, '--check').status).toBe(0);
    } finally {
      fs.rmSync(path.dirname(file), { recursive: true, force: true });
    }
  }, 30_000);
});
