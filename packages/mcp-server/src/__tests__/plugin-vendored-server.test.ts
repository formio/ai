// `pnpm sync:plugin-server` writes the server the Claude Code plugin runs: the
// compiled modules under plugin/server/, the dependencies plugin/package.json
// declares, and the lockfile Claude Code installs them from. The lockfile is read
// from pnpm-lock.yaml rather than re-resolved, so a user installs the tree this
// repository tested — a fresh `npx` of 1.0.0 resolved 29 of its 98 packages to
// versions no test had run against.
//
// Driven through the CLI with scratch fixtures, like the other scripts' tests:
// scripts/ lives outside this package's rootDir, and the repository's own plugin
// must stay untouched.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

const PNPM_LOCK = `lockfileVersion: '9.0'

importers:

  .: {}

  packages/mcp-server:
    dependencies:
      '@scope/b':
        specifier: ^2.0.0
        version: 2.0.0(peer@1.0.0)
      a:
        specifier: ^1.0.0
        version: 1.0.0
    devDependencies:
      dev-only:
        specifier: ^1.0.0
        version: 1.0.0

packages:

  '@scope/b@2.0.0':
    resolution: {integrity: sha512-bbbb}
    peerDependencies:
      peer: ^1.0.0

  a@1.0.0:
    resolution: {integrity: sha512-aaaa}
    engines: {node: '>=18'}

  c@1.0.0:
    resolution: {integrity: sha512-cccc}

  d@1.0.0:
    resolution: {integrity: sha512-dddd}

  dev-only@1.0.0:
    resolution: {integrity: sha512-xxxx}

  peer@1.0.0:
    resolution: {integrity: sha512-pppp}

snapshots:

  '@scope/b@2.0.0(peer@1.0.0)':
    dependencies:
      peer: 1.0.0

  a@1.0.0:
    dependencies:
      c: 1.0.0

  c@1.0.0:
    optionalDependencies:
      d: 1.0.0

  d@1.0.0: {}

  dev-only@1.0.0: {}

  peer@1.0.0: {}
`;

interface Fixture {
  root: string;
  plugin: string;
  args: string[];
}

const fixtures: string[] = [];

function fixture(lock: string = PNPM_LOCK): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-server-'));
  fixtures.push(root);
  const write = (rel: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  write('pnpm-lock.yaml', lock);
  write(
    'packages/mcp-server/package.json',
    JSON.stringify({
      name: '@formio/mcp',
      version: '9.9.9',
      dependencies: { a: '^1.0.0', '@scope/b': '^2.0.0' },
      devDependencies: { 'dev-only': '^1.0.0' },
    })
  );
  write('compiled/stdio.js', '#!/usr/bin/env node\nimport "./tools/x.js";\n');
  write('compiled/tools/x.js', 'export const x = 1;\n');
  write('compiled/tools/x.js.map', '{}');
  write('compiled/tools/x.d.ts', 'export declare const x = 1;\n');
  write('compiled/__tests__/x.test.js', 'throw new Error();\n');
  write(
    'plugin/package.json',
    `${JSON.stringify(
      {
        name: '@formio/ai',
        version: '1.2.3',
        type: 'module',
        license: 'MIT',
        files: ['skills'],
        engines: { node: '>=22.12' },
      },
      null,
      2
    )}\n`
  );
  return {
    root,
    plugin: path.join(root, 'plugin'),
    args: [
      '--lock',
      path.join(root, 'pnpm-lock.yaml'),
      '--server',
      path.join(root, 'packages/mcp-server'),
      '--plugin',
      path.join(root, 'plugin'),
      '--compiled',
      path.join(root, 'compiled'),
    ],
  };
}

function sync(args: string[]): { output: string; status: number | null } {
  const result = spawnSync('pnpm', ['-s', 'sync:plugin-server', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return { output: `${result.stdout}${result.stderr}`, status: result.status };
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
}

afterEach(() => {
  fixtures.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('sync:plugin-server', () => {
  it('declares the server runtime dependencies at the versions pnpm resolved, exactly', () => {
    const { plugin, args } = fixture();

    expect(sync(args).status).toBe(0);

    const pkg = readJson(path.join(plugin, 'package.json'));
    expect(pkg.dependencies).toEqual({ '@scope/b': '2.0.0', a: '1.0.0' });
    // Everything else in the manifest is left as it was.
    expect(pkg.name).toBe('@formio/ai');
    expect(pkg.files).toEqual(['skills']);
  }, 30_000);

  it('writes the tested closure as a flat v3 lockfile with registry URLs and hashes', () => {
    const { plugin, args } = fixture();

    expect(sync(args).status).toBe(0);

    const lock = readJson(path.join(plugin, 'package-lock.json'));
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.name).toBe('@formio/ai');
    expect(lock.version).toBe('1.2.3');
    expect(lock.packages['']).toEqual({
      name: '@formio/ai',
      version: '1.2.3',
      license: 'MIT',
      dependencies: { '@scope/b': '2.0.0', a: '1.0.0' },
      engines: { node: '>=22.12' },
    });
    expect(Object.keys(lock.packages).sort()).toEqual([
      '',
      'node_modules/@scope/b',
      'node_modules/a',
      'node_modules/c',
      'node_modules/d',
      'node_modules/peer',
    ]);
    expect(lock.packages['node_modules/@scope/b']).toMatchObject({
      version: '2.0.0',
      resolved: 'https://registry.npmjs.org/@scope/b/-/b-2.0.0.tgz',
      integrity: 'sha512-bbbb',
      peerDependencies: { peer: '^1.0.0' },
    });
    // A peer is listed once, under its declared range, as npm writes it.
    expect(lock.packages['node_modules/@scope/b'].dependencies).toBeUndefined();
    expect(lock.packages['node_modules/a']).toMatchObject({
      version: '1.0.0',
      resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
      integrity: 'sha512-aaaa',
      dependencies: { c: '1.0.0' },
    });
    expect(lock.packages['node_modules/c']).toMatchObject({
      optionalDependencies: { d: '1.0.0' },
    });
    expect(lock.packages['node_modules/d']).toMatchObject({ optional: true });
    expect(JSON.stringify(lock)).not.toMatch(/overrides|hasInstallScript|dev-only/);
  }, 30_000);

  it('copies the compiled server, minus tests, maps, and declarations', () => {
    const { plugin, args } = fixture();

    expect(sync(args).status).toBe(0);

    expect(filesUnder(path.join(plugin, 'server'))).toEqual(['stdio.js', 'tools/x.js']);
    expect(fs.readFileSync(path.join(plugin, 'server/tools/x.js'), 'utf8')).toBe(
      'export const x = 1;\n'
    );
  }, 30_000);

  it('fails, naming the package and writing nothing, when the closure splits a version', () => {
    const split = PNPM_LOCK.replace(
      "  '@scope/b@2.0.0(peer@1.0.0)':\n    dependencies:\n      peer: 1.0.0",
      "  '@scope/b@2.0.0(peer@1.0.0)':\n    dependencies:\n      peer: 1.0.0\n      c: 2.0.0"
    )
      .replace('  d@1.0.0: {}', '  c@2.0.0: {}\n\n  d@1.0.0: {}')
      .replace(
        '  d@1.0.0:\n    resolution',
        '  c@2.0.0:\n    resolution: {integrity: sha512-c2}\n\n  d@1.0.0:\n    resolution'
      );
    const { plugin, args } = fixture(split);

    const { status, output } = sync(args);

    expect(status).not.toBe(0);
    expect(output).toMatch(/\bc\b.*1\.0\.0.*2\.0\.0|\bc\b.*2\.0\.0.*1\.0\.0/);
    expect(fs.existsSync(path.join(plugin, 'package-lock.json'))).toBe(false);
  }, 30_000);

  it('refuses a package that does not come from the npm registry', () => {
    const tarball = PNPM_LOCK.replace(
      'resolution: {integrity: sha512-cccc}',
      'resolution: {tarball: https://example.test/c-1.0.0.tgz}'
    );
    const { plugin, args } = fixture(tarball);

    const { status, output } = sync(args);

    expect(status).not.toBe(0);
    expect(output).toContain('c@1.0.0');
    expect(fs.existsSync(path.join(plugin, 'package-lock.json'))).toBe(false);
  }, 30_000);
});

describe('sync:plugin-server --check', () => {
  it('passes on a tree it has just written', () => {
    const { args } = fixture();
    sync(args);

    expect(sync([...args, '--check']).status).toBe(0);
  }, 30_000);

  it('names every drifted or extra file and writes nothing', () => {
    const { plugin, args } = fixture();
    sync(args);
    fs.writeFileSync(path.join(plugin, 'server/tools/x.js'), 'export const x = 2;\n');
    fs.writeFileSync(path.join(plugin, 'server/stale.js'), 'export {};\n');
    const pkg = readJson(path.join(plugin, 'package.json'));
    fs.writeFileSync(
      path.join(plugin, 'package.json'),
      JSON.stringify({ ...pkg, dependencies: { a: '^1.0.0' } }, null, 2)
    );
    const before = filesUnder(plugin).map((rel) => [
      rel,
      fs.readFileSync(path.join(plugin, rel), 'utf8'),
    ]);

    const { status, output } = sync([...args, '--check']);

    expect(status).not.toBe(0);
    expect(output).toContain('server/tools/x.js');
    expect(output).toContain('server/stale.js');
    expect(output).toContain('package.json');
    expect(output).toContain('pnpm sync:plugin-server');
    const after = filesUnder(plugin).map((rel) => [
      rel,
      fs.readFileSync(path.join(plugin, rel), 'utf8'),
    ]);
    expect(after).toEqual(before);
  }, 30_000);
});

describe("the repository's plugin", () => {
  const PLUGIN = path.join(REPO_ROOT, 'plugin');

  it('carries the current server, dependencies, and lockfile', () => {
    const { status, output } = sync(['--check']);

    expect(output).not.toContain('✗');
    expect(status).toBe(0);
  }, 120_000);

  // Past either limit the Anthropic plugin directory does not read a file and
  // holds the plugin for review.
  it('stays within the directory read limits', () => {
    const files = filesUnder(PLUGIN).filter((rel) => !rel.split(path.sep).includes('node_modules'));
    const oversized = files
      .filter((rel) => !/\.(png|jpe?g|gif|webp)$/i.test(rel))
      .filter((rel) => fs.statSync(path.join(PLUGIN, rel)).size >= 256 * 1024);

    expect(files.length).toBeLessThan(512);
    expect(oversized).toEqual([]);
  });

  it('holds no package.json between the server and the plugin root', () => {
    expect(fs.existsSync(path.join(PLUGIN, 'server/package.json'))).toBe(false);
  });

  it('is re-synced by the release PR after the version is stamped', () => {
    const scripts = (readJson(path.join(REPO_ROOT, 'package.json')).scripts ?? {}) as Record<
      string,
      string
    >;
    const steps = scripts['changeset:version'].split('&&').map((step) => step.trim());

    expect(steps).toContain('pnpm sync:plugin-server');
    expect(steps.indexOf('pnpm sync:plugin-server')).toBeGreaterThan(
      steps.indexOf('pnpm sync:pins')
    );
  });
});
