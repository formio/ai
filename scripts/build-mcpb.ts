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
import { execFileSync, spawnSync } from 'node:child_process';
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

interface DeclaredTool {
  name: string;
  description: string;
}

/**
 * Asks the freshly bundled server what tools it serves.
 *
 * Directories that ingest the bundle read the manifest's `tools` rather than
 * launching anything — Smithery's listing reported no tools at all while this was
 * left for runtime discovery. Introspecting the real server keeps the list honest:
 * it cannot drift the way a hand-maintained copy would, and a tool added in code
 * appears here on the next build with no edit.
 *
 * Launched with a bare environment on purpose. That is the surface a fresh install
 * exposes, so it is what the manifest should advertise.
 */
function readToolsFromServer(): DeclaredTool[] {
  const request =
    [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"mcpb-build","version":"1"}}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}',
    ].join('\n') + '\n';

  const result = spawnSync(process.execPath, [SERVER_OUT], {
    input: request,
    encoding: 'utf8',
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '' },
  });

  if (result.error) {
    throw new Error(`Could not run the bundled server to enumerate tools: ${result.error.message}`);
  }

  const listed = result.stdout
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as { id?: number; result?: { tools?: DeclaredTool[] } }];
      } catch {
        return [];
      }
    })
    .find((message) => message.id === 2)?.result?.tools;

  if (!listed?.length) {
    // Shipping a manifest that silently claims no tools is how this went unnoticed
    // the first time, so fail the build instead.
    throw new Error(
      `The bundled server listed no tools. stderr: ${result.stderr.slice(0, 500) || '(empty)'}`
    );
  }

  return listed.map(({ name, description }) => ({ name, description }));
}

function writeManifest(version: string, tools: DeclaredTool[]) {
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
    // Read from the built server on every build (see readToolsFromServer), so the
    // list is accurate without being maintained by hand.
    tools,
    tools_generated: false,
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
  // Bundle first: the manifest's tool list is read from the built server.
  await bundleServer();
  writeManifest(version, readToolsFromServer());
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
