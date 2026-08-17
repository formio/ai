import { spawn } from 'node:child_process';
import fs from 'node:fs';
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
const SERVER_BUNDLE = path.join(DIST_PLUGIN, 'server/stdio.mjs');
const SKILLS_DIR = path.join(DIST_PLUGIN, 'skills');
const REQUIRED_SKILL_DIRS = ['formio-api', 'formio-schema'];
const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'description'] as const;

type Manifest = {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  mcpServers?: Record<string, { command?: unknown }>;
};

type ToolsListResponse = {
  id: number;
  result?: { tools?: Array<{ name: string }> };
  error?: { message: string };
};

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

async function exerciseToolsList() {
  if (!fs.existsSync(SERVER_BUNDLE)) fail(`server bundle missing at ${SERVER_BUNDLE}`);
  const child = spawn('node', [SERVER_BUNDLE], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORMIO_PROJECT_URL: 'https://smoke-test.invalid' },
  });

  let buffer = '';
  const response = await new Promise<ToolsListResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timed out waiting for tools/list response after 10s'));
    }, 10_000);

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      let newlineIdx = buffer.indexOf('\n');
      while (newlineIdx !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (line) {
          try {
            const parsed = JSON.parse(line) as ToolsListResponse;
            clearTimeout(timer);
            child.kill();
            resolve(parsed);
            return;
          } catch {
            // Not a JSON-RPC frame (e.g., stray log line); keep scanning.
          }
        }
        newlineIdx = buffer.indexOf('\n');
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });

  if (response.error) fail(`tools/list returned error: ${response.error.message}`);
  const tools = response.result?.tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    fail('tools/list returned no tools');
  }
  console.log(`✓ tools/list responded with ${tools.length} tool(s)`);
}

async function main() {
  assertBuildExists();
  validateManifest();
  validateAgentPluginManifests();
  validateCursorManifest();
  validateManifestVersionsAgree();
  validateSkills();
  await exerciseToolsList();
  console.log('plugin smoke-test passed');
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  main().catch((err: Error) => {
    console.error(`smoke-test failed: ${err.message}`);
    process.exit(1);
  });
}
