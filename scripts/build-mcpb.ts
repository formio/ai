/**
 * Builds the MCP Bundle (.mcpb) for @formio/mcp.
 *
 * An .mcpb is a one-click install for desktop hosts such as Claude Desktop: the
 * host unpacks it, reads manifest.json, prompts for the settings declared in
 * user_config, and runs the bundled server. No npm, no CLI, no hand-edited JSON —
 * which is the whole point of shipping one alongside the npm package.
 *
 * The server is bundled the same way as the Claude Code plugin (esbuild, ESM,
 * CJS-globals shim) so the bundle carries no node_modules.
 */

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const DIST = path.join(REPO_ROOT, 'dist');
const DIST_MCPB = path.join(DIST, 'mcpb');
const SERVER_ENTRY = path.join(REPO_ROOT, 'packages/mcp-server/src/stdio.ts');
const SERVER_OUT = path.join(DIST_MCPB, 'server/index.mjs');
const MANIFEST_OUT = path.join(DIST_MCPB, 'manifest.json');
// Claude Desktop renders the icon at up to 512x512; the 400x400 next to this one
// exists for the Cline marketplace, which mandates that size.
const ICON_SRC = path.join(REPO_ROOT, 'packages/mcp-server/docs/formio-logo-512.png');
const ICON_OUT = path.join(DIST_MCPB, 'icon.png');
const README_SRC = path.join(REPO_ROOT, 'packages/mcp-server/README.md');
const README_OUT = path.join(DIST_MCPB, 'README.md');
const SERVER_PACKAGE_JSON = path.join(REPO_ROOT, 'packages/mcp-server/package.json');
const BUNDLE_OUT = path.join(DIST, 'formio-mcp.mcpb');

function serverVersion(): string {
  const { version } = JSON.parse(fs.readFileSync(SERVER_PACKAGE_JSON, 'utf8')) as {
    version: string;
  };
  return version;
}

function writeManifest(version: string) {
  const manifest = {
    manifest_version: '0.3',
    name: 'formio-mcp',
    display_name: 'Form.io',
    version,
    description:
      'Create and manage Form.io forms, resources, actions, and roles from your AI assistant.',
    long_description:
      'Gives an assistant first-class tools over a Form.io project, so building a form, ' +
      'wiring its server-side actions, and setting up roles is a conversation rather than a ' +
      'REST session. Covers forms and revisions, roles, actions, and whole-project template ' +
      'import and export, plus a no-auth `hello` tool for checking the connection.',
    author: { name: 'Form.io', url: 'https://form.io' },
    repository: { type: 'git', url: 'https://github.com/formio/ai.git' },
    homepage: 'https://form.io/ai',
    documentation: 'https://github.com/formio/ai/tree/main/packages/mcp-server',
    support: 'https://github.com/formio/ai/issues',
    icon: 'icon.png',
    license: 'MIT',
    keywords: ['formio', 'forms', 'form-builder', 'data-collection', 'workflow'],
    server: {
      type: 'node',
      entry_point: 'server/index.mjs',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/server/index.mjs'],
        env: {
          FORMIO_PROJECT_URL: '${user_config.formio_project_url}',
          FORMIO_BASE_URL: '${user_config.formio_base_url}',
          FORMIO_API_KEY: '${user_config.formio_api_key}',
        },
      },
    },
    user_config: {
      formio_project_url: {
        type: 'string',
        title: 'Project URL',
        description:
          'Full URL of your Form.io project, e.g. https://myproject.form.io or ' +
          'https://forms.example.com/myproject',
        required: true,
      },
      formio_base_url: {
        type: 'string',
        title: 'Base URL',
        description:
          'Base URL of the deployment. Leave as-is for Form.io SaaS; change it when self-hosting.',
        default: 'https://api.form.io',
        required: false,
      },
      formio_api_key: {
        type: 'string',
        title: 'Project API key (optional)',
        description:
          'Leave blank to sign in through the browser on first use. Set it to skip that ' +
          'sign-in, or when running somewhere a browser cannot open.',
        sensitive: true,
        required: false,
      },
    },
    compatibility: {
      platforms: ['darwin', 'win32', 'linux'],
      runtimes: { node: '>=20.0.0' },
    },
    // Left for the host to discover at runtime: the tool list is registered in code,
    // and a hand-copied list here would drift the moment a tool is added.
    tools_generated: true,
  };

  fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
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
      // Same shim as the plugin build: bundled CJS deps (express) need these globals
      // to resolve inside ESM output.
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

function copyAssets() {
  fs.copyFileSync(ICON_SRC, ICON_OUT);
  fs.copyFileSync(README_SRC, README_OUT);
}

function pack() {
  // `mcpb pack` validates the manifest on the way through, so a malformed manifest
  // fails the build rather than shipping. Run the pinned dev dependency rather than
  // `npx @latest`: the build should not reach the network, and a packer that changes
  // under us would be an unpleasant surprise mid-release.
  const mcpb = path.join(REPO_ROOT, 'node_modules/.bin/mcpb');
  execFileSync(mcpb, ['pack', DIST_MCPB, BUNDLE_OUT], { cwd: REPO_ROOT, stdio: 'pipe' });
}

export async function buildMcpb() {
  fs.rmSync(DIST_MCPB, { recursive: true, force: true });
  fs.rmSync(BUNDLE_OUT, { force: true });
  const version = serverVersion();
  writeManifest(version);
  await bundleServer();
  copyAssets();
  pack();
  const size = fs.statSync(BUNDLE_OUT).size;
  console.log(
    `built ${path.relative(REPO_ROOT, BUNDLE_OUT)} (v${version}, ${Math.round(size / 1024)} KB)`
  );
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  buildMcpb().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
