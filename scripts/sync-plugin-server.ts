// `pnpm sync:plugin-server` — the server the Claude Code plugin runs.
//
// The Claude Code manifest launches `node ${CLAUDE_PLUGIN_ROOT}/server/stdio.js`,
// and Claude Code installs that server's dependencies from the plugin root's
// package.json and package-lock.json. This script writes all three from this
// commit:
//
// - plugin/server/ — the server's `tsc` output, one readable module per source
//   file, without tests, source maps, or declarations;
// - the `dependencies` block of plugin/package.json — the server's runtime
//   dependencies at the exact versions pnpm resolved;
// - plugin/package-lock.json — the full runtime closure read from pnpm-lock.yaml,
//   each package with its registry URL and integrity hash.
//
// The closure is read, not re-resolved: a registry resolution picks whatever
// satisfies the ranges today, which for 1.0.0 was 29 of 98 packages no test had
// run against. Reading pnpm-lock.yaml makes the tree Claude Code installs the one
// CI tested, and keeps this script offline so `--check` runs inside `pnpm test`.
//
// `--check` writes nothing and exits non-zero naming every file a sync would
// change. `--lock`, `--server`, `--plugin`, and `--compiled` replace the
// repository's own inputs, so tests can drive the script against fixtures; with
// no `--compiled`, the server is compiled into a temporary directory.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const REGISTRY = 'https://registry.npmjs.org';

type Versions = Record<string, string>;

interface PnpmLock {
  importers?: Record<string, { dependencies?: Record<string, { version: string }> }>;
  packages?: Record<
    string,
    {
      resolution?: { integrity?: string; tarball?: string };
      engines?: Versions;
      peerDependencies?: Versions;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    }
  >;
  snapshots?: Record<string, { dependencies?: Versions; optionalDependencies?: Versions }>;
}

interface PackageJson {
  name: string;
  version: string;
  license?: string;
  engines?: Versions;
  dependencies?: Versions;
  [key: string]: unknown;
}

interface ClosurePackage {
  name: string;
  version: string;
  /** The snapshot key, with pnpm's peer suffix, that describes its dependencies. */
  ref: string;
  /** Reached only through optional dependencies. */
  optional: boolean;
}

type LockEntry = Record<string, unknown>;

export interface PluginServerFiles {
  /** plugin/package.json as a sync writes it. */
  packageJson: string;
  /** plugin/package-lock.json as a sync writes it. */
  lockfile: string;
  /** plugin/server/ relative path → contents. */
  server: Map<string, string>;
}

/** `1.30.1(zod@4.6.5)` → `1.30.1`: pnpm suffixes the peers a snapshot resolved. */
const bareVersion = (ref: string): string => ref.replace(/\(.*$/, '');

const snapshotKey = (name: string, ref: string): string => `${name}@${ref}`;

const posixPath = (rel: string): string => rel.split(path.sep).join('/');

function importerOf(lock: PnpmLock, importer: string) {
  const entry = lock.importers?.[importer];
  if (!entry) {
    throw new Error(`pnpm-lock.yaml has no importer ${importer}`);
  }
  return entry;
}

/**
 * Every package the importer's runtime dependencies reach, one per name. A name
 * resolved to two versions throws: the lockfile is flat, and picking one would
 * install a version the other dependent was not tested with.
 */
export function runtimeClosure(lock: PnpmLock, importer: string): ClosurePackage[] {
  const direct = Object.entries(importerOf(lock, importer).dependencies ?? {});
  const found = new Map<string, ClosurePackage>();

  const visit = (name: string, ref: string, optional: boolean): void => {
    const version = bareVersion(ref);
    const seen = found.get(name);
    if (seen && seen.version !== version) {
      throw new Error(
        `${name} resolves to both ${seen.version} and ${version}; ` +
          'a flat plugin lockfile can hold one version of each package.'
      );
    }
    if (seen && (optional || !seen.optional)) {
      return;
    }
    found.set(name, { name, version, ref, optional });
    const snapshot = lock.snapshots?.[snapshotKey(name, ref)] ?? {};
    Object.entries(snapshot.dependencies ?? {}).forEach(([dep, depRef]) =>
      visit(dep, depRef, optional)
    );
    Object.entries(snapshot.optionalDependencies ?? {}).forEach(([dep, depRef]) =>
      visit(dep, depRef, true)
    );
  };

  direct.forEach(([name, { version }]) => visit(name, version, false));
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The server's runtime dependencies, each at the exact version pnpm resolved. */
export function pluginDependencies(
  lock: PnpmLock,
  importer: string,
  server: PackageJson
): Versions {
  const resolved = importerOf(lock, importer).dependencies ?? {};
  return Object.fromEntries(
    Object.keys(server.dependencies ?? {})
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((name) => {
        const entry = resolved[name];
        if (!entry) {
          throw new Error(`pnpm-lock.yaml does not resolve ${name} for ${importer}`);
        }
        return [name, bareVersion(entry.version)];
      })
  );
}

const tarballUrl = (name: string, version: string): string =>
  `${REGISTRY}/${name}/-/${name.split('/').pop()}-${version}.tgz`;

const nonEmpty = <T extends object>(value: T | undefined): T | undefined =>
  value && Object.keys(value).length > 0 ? value : undefined;

function lockEntry(lock: PnpmLock, pkg: ClosurePackage): LockEntry {
  const id = `${pkg.name}@${pkg.version}`;
  const meta = lock.packages?.[id];
  const integrity = meta?.resolution?.integrity;
  if (!meta || meta.resolution?.tarball || !integrity) {
    throw new Error(
      `${id} has no npm registry integrity hash in pnpm-lock.yaml; ` +
        'Claude Code installs registry packages only.'
    );
  }
  const snapshot = lock.snapshots?.[snapshotKey(pkg.name, pkg.ref)] ?? {};
  const peers = meta.peerDependencies ?? {};
  const without = (deps: Versions | undefined) =>
    nonEmpty(
      Object.fromEntries(
        Object.entries(deps ?? {})
          .filter(([name]) => !(name in peers))
          .map(([name, ref]) => [name, bareVersion(ref)])
      )
    );
  return Object.fromEntries(
    Object.entries({
      version: pkg.version,
      resolved: tarballUrl(pkg.name, pkg.version),
      integrity,
      optional: pkg.optional || undefined,
      dependencies: without(snapshot.dependencies),
      optionalDependencies: without(snapshot.optionalDependencies),
      peerDependencies: nonEmpty(meta.peerDependencies),
      peerDependenciesMeta: nonEmpty(meta.peerDependenciesMeta),
      engines: nonEmpty(meta.engines),
    }).filter(([, value]) => value !== undefined)
  );
}

/** The lockfile Claude Code installs from: lockfile v3, flat, registry-only. */
export function pluginLockfile(
  lock: PnpmLock,
  importer: string,
  plugin: PackageJson
): Record<string, unknown> {
  const root = Object.fromEntries(
    Object.entries({
      name: plugin.name,
      version: plugin.version,
      license: plugin.license,
      dependencies: plugin.dependencies,
      engines: plugin.engines,
    }).filter(([, value]) => value !== undefined)
  );
  return {
    name: plugin.name,
    version: plugin.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': root,
      ...Object.fromEntries(
        runtimeClosure(lock, importer).map((pkg) => [
          `node_modules/${pkg.name}`,
          lockEntry(lock, pkg),
        ])
      ),
    },
  };
}

/** The compiled modules the plugin carries: `.js` only, no tests. */
export function serverModules(compiledDir: string): Map<string, string> {
  return new Map(
    fs
      .readdirSync(compiledDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map((entry) => path.relative(compiledDir, path.join(entry.parentPath, entry.name)))
      .filter((rel) => !rel.split(path.sep).includes('__tests__'))
      .sort()
      .map((rel) => [posixPath(rel), fs.readFileSync(path.join(compiledDir, rel), 'utf8')])
  );
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

interface Inputs {
  lockPath: string;
  serverDir: string;
  pluginDir: string;
  compiledDir: string;
}

/** Everything a sync writes, computed without writing. */
export function pluginServerFiles({
  lockPath,
  serverDir,
  pluginDir,
  compiledDir,
}: Inputs): PluginServerFiles {
  const lock = parse(fs.readFileSync(lockPath, 'utf8')) as PnpmLock;
  const importer = posixPath(path.relative(path.dirname(lockPath), serverDir));
  const server = readJson<PackageJson>(path.join(serverDir, 'package.json'));
  const current = readJson<PackageJson>(path.join(pluginDir, 'package.json'));
  const plugin: PackageJson = {
    ...current,
    dependencies: pluginDependencies(lock, importer, server),
  };
  return {
    packageJson: json(plugin),
    lockfile: json(pluginLockfile(lock, importer, plugin)),
    server: serverModules(compiledDir),
  };
}

/** Plugin-relative paths whose contents differ from what a sync writes, or that a sync removes. */
export function driftedFiles(pluginDir: string, files: PluginServerFiles): string[] {
  const differs = (rel: string, expected: string) => {
    const file = path.join(pluginDir, rel);
    return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expected;
  };
  const serverDir = path.join(pluginDir, 'server');
  const onDisk = fs.existsSync(serverDir)
    ? fs
        .readdirSync(serverDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          posixPath(path.relative(serverDir, path.join(entry.parentPath, entry.name)))
        )
    : [];
  return [
    ...(differs('package.json', files.packageJson) ? ['package.json'] : []),
    ...(differs('package-lock.json', files.lockfile) ? ['package-lock.json'] : []),
    ...[...files.server]
      .filter(([rel, text]) => differs(`server/${rel}`, text))
      .map(([rel]) => `server/${rel}`),
    ...onDisk.filter((rel) => !files.server.has(rel)).map((rel) => `server/${rel}`),
  ].sort();
}

/** Writes plugin/server/, the dependency block, and the lockfile. */
export function writePluginServer(pluginDir: string, files: PluginServerFiles): void {
  const serverDir = path.join(pluginDir, 'server');
  fs.rmSync(serverDir, { recursive: true, force: true });
  files.server.forEach((text, rel) => {
    const file = path.join(serverDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  });
  fs.writeFileSync(path.join(pluginDir, 'package.json'), files.packageJson);
  fs.writeFileSync(path.join(pluginDir, 'package-lock.json'), files.lockfile);
}

/**
 * Compiles the server into a temporary directory without source maps or
 * declarations: a map would name a file the plugin does not ship, and compiling
 * apart from `dist` keeps this from racing a test that rebuilds it.
 */
function compileServer(serverDir: string): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-plugin-server-'));
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'tsc',
      '--outDir',
      outDir,
      '--sourceMap',
      'false',
      '--declaration',
      'false',
      '--declarationMap',
      'false',
    ],
    { cwd: serverDir, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`Compiling the server failed:\n${result.stdout}${result.stderr}`);
  }
  return outDir;
}

function parseArgs(argv: string[]) {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : path.resolve(argv[index + 1]);
  };
  return {
    check: argv.includes('--check'),
    lockPath: valueOf('--lock') ?? path.join(REPO_ROOT, 'pnpm-lock.yaml'),
    serverDir: valueOf('--server') ?? path.join(REPO_ROOT, 'packages/mcp-server'),
    pluginDir: valueOf('--plugin') ?? path.join(REPO_ROOT, 'plugin'),
    compiledDir: valueOf('--compiled'),
  };
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  const { check, lockPath, serverDir, pluginDir, compiledDir } = parseArgs(process.argv.slice(2));
  const compiled = compiledDir ?? compileServer(serverDir);
  try {
    const files = pluginServerFiles({ lockPath, serverDir, pluginDir, compiledDir: compiled });
    const drifted = driftedFiles(pluginDir, files);
    if (check) {
      if (drifted.length > 0) {
        console.error(
          `✗ the plugin's server is out of date with packages/mcp-server: ${drifted
            .map((rel) => path.join(path.relative(REPO_ROOT, pluginDir), rel))
            .join(', ')}\n  Run \`pnpm sync:plugin-server\` to write it.`
        );
        process.exitCode = 1;
      } else {
        console.log('✓ the plugin carries the current server, dependencies, and lockfile');
      }
    } else {
      writePluginServer(pluginDir, files);
      console.log(
        drifted.length === 0
          ? '✓ the plugin already carries the current server'
          : `✓ wrote ${drifted.length} file(s) under ${path.relative(REPO_ROOT, pluginDir) || pluginDir}`
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    if (!compiledDir) {
      fs.rmSync(compiled, { recursive: true, force: true });
    }
  }
}
