import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PLUGIN_SRC = path.join(REPO_ROOT, 'plugin');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist/plugin');
const PACKAGE_JSON = path.join(PLUGIN_SRC, 'package.json');
const MANIFEST_OUT = path.join(DIST_PLUGIN, '.claude-plugin/plugin.json');
const SERVER_ENTRY = path.join(REPO_ROOT, 'packages/mcp-server/src/stdio.ts');
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

function syncManifestVersion() {
  const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as { version: string };
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_OUT, 'utf8')) as Record<string, unknown>;
  manifest.version = version;
  fs.writeFileSync(MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`);
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
  copyStatic();
  syncManifestVersion();
  await bundleServer();
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  buildPlugin().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
