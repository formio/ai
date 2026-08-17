import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSourceManifestVersionsAgree } from './sync-manifest-versions.js';

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
const SERVER_ENTRY = path.join(REPO_ROOT, 'packages/mcp-server/src/stdio.ts');
// Built, not published: `plugin/package.json`'s `files` omits `server/`, because
// every manifest launches `npx -y @formio/mcp@…` and a second copy in the tarball
// would invite the reading that an install runs it. What the bundle is for is the
// smoke test — `pnpm test:plugin` spawns it and sends `tools/list`, which catches
// bundling regressions (a missing CJS shim, a wrong entry point) that no
// module-level test sees. The `.mcpb` desktop bundle builds its own copy at
// dist/mcpb/server/index.mjs.
const SERVER_OUT = path.join(DIST_PLUGIN, 'server/stdio.mjs');

function cleanDist() {
  fs.rmSync(DIST_PLUGIN, { recursive: true, force: true });
}

function copyStatic() {
  fs.mkdirSync(path.dirname(DIST_PLUGIN), { recursive: true });
  fs.cpSync(PLUGIN_SRC, DIST_PLUGIN, {
    recursive: true,
    filter: (src: string) => path.basename(src) !== '__pycache__',
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

async function bundleServer() {
  fs.mkdirSync(path.dirname(SERVER_OUT), { recursive: true });
  await build({
    entryPoints: [SERVER_ENTRY],
    outfile: SERVER_OUT,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: {
      // Shim CommonJS globals for ESM output so bundled CJS deps (e.g. express) resolve correctly.
      // The source file's own `#!/usr/bin/env node` shebang is preserved by esbuild above this.
      js: [
        "import { createRequire as __createRequire } from 'node:module';",
        "import { fileURLToPath as __fileURLToPath } from 'node:url';",
        "import { dirname as __dirname_fn } from 'node:path';",
        'const require = __createRequire(import.meta.url);',
        'const __filename = __fileURLToPath(import.meta.url);',
        'const __dirname = __dirname_fn(__filename);',
      ].join('\n'),
    },
    logLevel: 'warning',
  });
  fs.chmodSync(SERVER_OUT, 0o755);
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
  copyStatic();
  syncManifestVersions();
  await bundleServer();
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  buildPlugin().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
