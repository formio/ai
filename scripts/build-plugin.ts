import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSourceManifestVersionsAgree } from './sync-manifest-versions.js';
import { assertServerPinsAgree } from './sync-server-pin.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PLUGIN_SRC = path.join(REPO_ROOT, 'plugin');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist/plugin');
const PACKAGE_JSON = path.join(PLUGIN_SRC, 'package.json');
// One version, three manifests: Claude Code, Cursor, and the vendor-neutral
// Agent Plugins layout. Clients display the version and marketplaces key
// updates on it, so a manifest that drifts is a release defect.
const MANIFESTS_OUT = [
  path.join(DIST_PLUGIN, '.claude-plugin/plugin.json'),
  path.join(DIST_PLUGIN, '.cursor-plugin/plugin.json'),
  path.join(DIST_PLUGIN, 'plugin.json'),
];
// Never copied: pnpm installs the plugin's dependencies into plugin/node_modules
// because plugin/ is a workspace package, but a consumer installs them from the
// lockfile, so the built tree carries none.
const NOT_SHIPPED = new Set(['__pycache__', 'node_modules']);

function cleanDist() {
  fs.rmSync(DIST_PLUGIN, { recursive: true, force: true });
}

function copyStatic() {
  fs.mkdirSync(path.dirname(DIST_PLUGIN), { recursive: true });
  fs.cpSync(PLUGIN_SRC, DIST_PLUGIN, {
    recursive: true,
    filter: (src: string) => !NOT_SHIPPED.has(path.basename(src)),
  });
}

/**
 * A bundle that silently omits one client's manifest installs fine everywhere
 * else and breaks in exactly that client, so a missing manifest fails the build
 * rather than shipping. Exported so it can be tested without mutating the
 * shared source tree.
 */
export function assertManifestsPresent(manifestPaths: readonly string[]): void {
  const missing = manifestPaths.filter((manifestPath) => !fs.existsSync(manifestPath));
  if (missing.length > 0) {
    throw new Error(`Expected manifests are missing from the build: ${missing.join(', ')}`);
  }
}

function syncManifestVersions() {
  assertManifestsPresent(MANIFESTS_OUT);
  const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as { version: string };
  for (const manifestPath of MANIFESTS_OUT) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.version = version;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

/**
 * Throws unless plugin/server/, the plugin's dependency block, and its lockfile
 * match this commit's server: the Claude manifest launches that copy, so a
 * drifted one would publish a server other than the one this commit tested.
 */
function assertVendoredServerCurrent() {
  const check = spawnSync('pnpm', ['-s', 'sync:plugin-server', '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (check.status !== 0) {
    throw new Error(
      `${check.stdout}${check.stderr}`.trim() ||
        'plugin/server/ is out of date; run `pnpm sync:plugin-server`.'
    );
  }
}

export async function buildPlugin() {
  cleanDist();
  // Verify, never write: the repository tree is itself an install source (the
  // Claude marketplace declares `source: "./plugin"`), so the committed
  // manifests have to carry the version — but a build is a read of the source
  // tree. `prepublishOnly` runs this build, so stamping here would mutate
  // tracked files during a release and after any hand-edit of
  // plugin/package.json. `pnpm sync:versions` is the only writer.
  assertSourceManifestVersionsAgree();
  // Same rule for the `@formio/mcp@<version>` pin every manifest and skill
  // carries, whose writer is `pnpm sync:pins`. Checked here because a
  // plugin-only release runs plugin/package.json's `prepublishOnly`
  // (build:plugin && test:plugin) and never the server package's tests — so
  // without this a stale or hand-edited pin publishes in the plugin tarball
  // with nothing having looked at it.
  assertServerPinsAgree();
  // Same rule for the server the Claude manifest launches, whose writer is
  // `pnpm sync:plugin-server`.
  assertVendoredServerCurrent();
  copyStatic();
  syncManifestVersions();
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  buildPlugin().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
