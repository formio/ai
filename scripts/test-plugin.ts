import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist/plugin');
const PLUGIN_JSON = path.join(DIST_PLUGIN, '.claude-plugin/plugin.json');
const SERVER_BUNDLE = path.join(DIST_PLUGIN, 'server/stdio.mjs');
const SKILLS_DIR = path.join(DIST_PLUGIN, 'skills');
const REQUIRED_SKILL_DIRS = ['formio-api', 'formio-form'];
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
