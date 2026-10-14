import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist/plugin');
const PLUGIN_JSON = path.join(DIST_PLUGIN, '.claude-plugin/plugin.json');
const AGENT_PLUGIN_JSON = path.join(DIST_PLUGIN, 'plugin.json');
const CURSOR_PLUGIN_JSON = path.join(DIST_PLUGIN, '.cursor-plugin/plugin.json');
const MCP_JSON = path.join(DIST_PLUGIN, 'mcp.json');
const AGENT_PLUGINS_SPEC = '1.0.0';
const SERVER_PACKAGE_JSON = path.join(REPO_ROOT, 'packages/mcp-server/package.json');
const SKILLS_DIR = path.join(DIST_PLUGIN, 'skills');
const REQUIRED_SKILL_DIRS = ['formio-api', 'formio-schema'];
const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'description'] as const;

type Manifest = {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  mcpServers?: Record<string, { command?: unknown }>;
};

type RpcResponse = {
  id?: number;
  result?: { tools?: Array<{ name: string }>; serverInfo?: { version?: string } };
  error?: { message: string };
};

type LockEntry = { version?: string };

function fail(message: string): never {
  console.error(`smoke-test failed: ${message}`);
  process.exit(1);
}

function assertBuildExists() {
  if (!fs.existsSync(DIST_PLUGIN)) {
    fail(`dist/plugin/ is missing — run \`pnpm build:plugin\` first.`);
  }
}

function validateManifest() {
  if (!fs.existsSync(PLUGIN_JSON)) fail(`plugin.json is missing at ${PLUGIN_JSON}`);
  const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')) as Manifest;
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    const value = manifest[field];
    if (typeof value !== 'string' || value.length === 0) {
      fail(`plugin.json is missing required field "${field}"`);
    }
  }
  const servers = Object.entries(manifest.mcpServers ?? {});
  if (servers.length === 0) {
    fail('plugin.json is missing required field "mcpServers"');
  }
  for (const [name, server] of servers) {
    if (typeof server.command !== 'string' || server.command.length === 0) {
      fail(`plugin.json mcpServers["${name}"].command must be a non-empty string`);
    }
  }
  console.log('✓ plugin.json structure OK');
}

// Each client reads its own manifest, so each has to be validated. A layout that
// ships unvalidated is a layout that breaks in a client nobody here runs.
function validateAgentPluginManifests() {
  for (const [label, file, expectedSchema] of [
    [
      'plugin.json',
      AGENT_PLUGIN_JSON,
      `https://agent-plugins.org/schemas/${AGENT_PLUGINS_SPEC}/plugin.schema.json`,
    ],
    [
      'mcp.json',
      MCP_JSON,
      `https://agent-plugins.org/schemas/${AGENT_PLUGINS_SPEC}/mcp.schema.json`,
    ],
  ] as const) {
    if (!fs.existsSync(file)) fail(`${label} is missing at ${file}`);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { $schema?: unknown };
    if (parsed.$schema !== expectedSchema) {
      fail(`${label} must declare $schema ${expectedSchema} (found ${String(parsed.$schema)})`);
    }
  }

  const mcp = JSON.parse(fs.readFileSync(MCP_JSON, 'utf8')) as {
    mcpServers?: Record<string, { type?: string; command?: string }>;
  };
  const servers = Object.entries(mcp.mcpServers ?? {});
  if (servers.length === 0) fail('mcp.json declares no mcpServers');
  for (const [name, server] of servers) {
    if (server.type !== 'stdio') fail(`mcp.json mcpServers["${name}"].type must be "stdio"`);
    if (!server.command) fail(`mcp.json mcpServers["${name}"].command must be a non-empty string`);
  }
  console.log('✓ Agent Plugins manifests OK');
}

// Cursor rejects a variables/placeholder mismatch at submission, so catch it here
// rather than in a review cycle.
function validateCursorManifest() {
  if (!fs.existsSync(CURSOR_PLUGIN_JSON)) {
    fail(`.cursor-plugin/plugin.json is missing at ${CURSOR_PLUGIN_JSON}`);
  }
  const manifest = JSON.parse(fs.readFileSync(CURSOR_PLUGIN_JSON, 'utf8')) as {
    name?: unknown;
    version?: unknown;
    skills?: unknown;
    mcpServers?: unknown;
    variables?: { properties?: Record<string, unknown> };
  };
  for (const field of ['name', 'version', 'skills'] as const) {
    if (typeof manifest[field] !== 'string' || (manifest[field] as string).length === 0) {
      fail(`.cursor-plugin/plugin.json is missing required field "${field}"`);
    }
  }
  const skillsDir = path.join(DIST_PLUGIN, manifest.skills as string);
  if (!fs.existsSync(skillsDir)) {
    fail(`.cursor-plugin/plugin.json skills path does not resolve: ${skillsDir}`);
  }

  const placeholders = new Set(
    [...JSON.stringify(manifest.mcpServers ?? {}).matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1])
  );
  const declared = new Set(Object.keys(manifest.variables?.properties ?? {}));
  for (const placeholder of placeholders) {
    if (!declared.has(placeholder)) {
      fail(
        `.cursor-plugin/plugin.json references \${${placeholder}} but declares no such variable`
      );
    }
  }
  for (const variable of declared) {
    if (!placeholders.has(variable)) {
      fail(`.cursor-plugin/plugin.json declares variable ${variable} but never references it`);
    }
  }
  console.log(`✓ Cursor manifest OK (variables: ${[...declared].join(', ') || 'none'})`);
}

function validateManifestVersionsAgree() {
  const manifests = [PLUGIN_JSON, AGENT_PLUGIN_JSON, CURSOR_PLUGIN_JSON].map((file) => {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: unknown };
    return { label: path.relative(DIST_PLUGIN, file), version: parsed.version };
  });

  // Checked before agreement, because absence agrees with itself: three
  // manifests that all lack a version are unanimous and unversioned, which is
  // the drift this guard exists to catch rather than a passing state.
  const unversioned = manifests.filter(
    ({ version }) => typeof version !== 'string' || version.length === 0
  );
  if (unversioned.length > 0) {
    fail(
      `manifest version missing or not a non-empty string: ${unversioned
        .map(({ label, version }) => `${label}=${JSON.stringify(version)}`)
        .join(', ')}`
    );
  }

  const distinct = new Set(manifests.map(({ version }) => version as string));
  if (distinct.size !== 1) {
    fail(
      `manifest versions disagree: ${manifests
        .map(({ label, version }) => `${label}=${String(version)}`)
        .join(', ')}`
    );
  }
  console.log(`✓ manifest versions agree (${[...distinct][0]})`);
}

function validateSkills() {
  if (!fs.existsSync(SKILLS_DIR)) fail(`skills directory missing at ${SKILLS_DIR}`);
  for (const name of REQUIRED_SKILL_DIRS) {
    const dir = path.join(SKILLS_DIR, name);
    if (!fs.existsSync(dir)) fail(`required skill directory missing: ${name}/`);
  }
  console.log(`✓ skills present: ${REQUIRED_SKILL_DIRS.join(', ')}`);
}

/**
 * Installs the plugin's dependencies the way Claude Code does — from the
 * lockfile, frozen, with no lifecycle scripts and no user `.npmrc` — into a copy
 * of the built tree, and checks every installed version against its lockfile
 * entry. A lockfile that installs only through a contributor's own mirror, or
 * that installs something other than what it pins, fails here.
 */
function installLikeClaudeCode(): string {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-plugin-smoke-'));
  fs.cpSync(DIST_PLUGIN, copy, { recursive: true });
  const userConfig = path.join(copy, '.smoke-npmrc');
  fs.writeFileSync(userConfig, '');
  const started = Date.now();
  const install = spawnSync(
    'npm',
    ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'],
    {
      cwd: copy,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_userconfig: userConfig,
        npm_config_registry: 'https://registry.npmjs.org/',
      },
    }
  );
  fs.rmSync(userConfig);
  if (install.status !== 0) {
    fail(`npm ci from package-lock.json failed:\n${install.stdout}${install.stderr}`);
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const lock = JSON.parse(fs.readFileSync(path.join(copy, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockEntry>;
  };
  const locked = Object.entries(lock.packages).filter(([key]) => key !== '');
  const mismatched = locked.filter(([key, entry]) => {
    const manifest = path.join(copy, key, 'package.json');
    return (
      !fs.existsSync(manifest) ||
      (JSON.parse(fs.readFileSync(manifest, 'utf8')) as LockEntry).version !== entry.version
    );
  });
  if (mismatched.length > 0) {
    fail(
      `installed versions differ from the lockfile: ${mismatched.map(([key]) => key).join(', ')}`
    );
  }
  console.log(`✓ installed ${locked.length} locked packages in ${seconds}s`);
  return copy;
}

/** Sends `initialize` then `tools/list` to the Claude manifest's server; resolves both replies. */
async function exchange(serverPath: string): Promise<Map<number, RpcResponse>> {
  const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORMIO_PROJECT_URL: 'https://smoke-test.invalid' },
  });
  const replies = new Map<number, RpcResponse>();
  let buffer = '';
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timed out waiting for initialize and tools/list after 10s'));
    }, 10_000);
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
        try {
          const parsed = JSON.parse(line) as RpcResponse;
          if (typeof parsed.id === 'number') replies.set(parsed.id, parsed);
        } catch {
          // Not a JSON-RPC frame (e.g., stray log line); keep scanning.
        }
      }
      if (replies.has(1) && replies.has(2)) {
        clearTimeout(timer);
        child.kill();
        resolve();
      }
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    const frames = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'plugin-smoke-test', version: '0.0.0' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    ];
    child.stdin.write(frames.map((frame) => `${JSON.stringify(frame)}\n`).join(''));
  });
  return replies;
}

async function exerciseVendoredServer() {
  const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')) as {
    mcpServers?: Record<string, { args?: string[] }>;
  };
  const launched = manifest.mcpServers?.['formio-mcp']?.args?.[0] ?? '';
  const relative = launched.replace(/^\$\{CLAUDE_PLUGIN_ROOT\}\//, '');
  if (!relative || relative === launched) {
    fail(
      `plugin.json formio-mcp must launch a file under \${CLAUDE_PLUGIN_ROOT} (found ${launched})`
    );
  }

  const copy = installLikeClaudeCode();
  try {
    const replies = await exchange(path.join(copy, relative));
    const initialize = replies.get(1);
    const list = replies.get(2);
    if (initialize?.error) fail(`initialize returned error: ${initialize.error.message}`);
    if (list?.error) fail(`tools/list returned error: ${list.error.message}`);

    const { version } = JSON.parse(fs.readFileSync(SERVER_PACKAGE_JSON, 'utf8')) as {
      version: string;
    };
    const reported = initialize?.result?.serverInfo?.version;
    if (reported !== version) {
      fail(`the vendored server reports ${String(reported)}, not @formio/mcp ${version}`);
    }
    console.log(`✓ the vendored server reports @formio/mcp ${version}`);

    const tools = list?.result?.tools ?? [];
    if (!tools.some((tool) => tool.name === 'project_set')) {
      fail('tools/list returned no project_set tool');
    }
    console.log(`✓ tools/list responded with ${tools.length} tool(s)`);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

async function main() {
  assertBuildExists();
  validateManifest();
  validateAgentPluginManifests();
  validateCursorManifest();
  validateManifestVersionsAgree();
  validateSkills();
  await exerciseVendoredServer();
  console.log('plugin smoke-test passed');
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  main().catch((err: Error) => {
    console.error(`smoke-test failed: ${err.message}`);
    process.exit(1);
  });
}
