import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DIST_MCPB = path.join(REPO_ROOT, 'dist/mcpb');
const MANIFEST = path.join(DIST_MCPB, 'manifest.json');
const SERVER_BUNDLE = path.join(DIST_MCPB, 'server/index.mjs');
const ICON = path.join(DIST_MCPB, 'icon.png');
const BUNDLE = path.join(REPO_ROOT, 'dist/formio-mcp.mcpb');
const SERVER_PACKAGE_JSON = path.join(REPO_ROOT, 'packages/mcp-server/package.json');

type Manifest = {
  manifest_version: string;
  name: string;
  display_name?: string;
  version: string;
  description: string;
  author: { name: string };
  license?: string;
  icon?: string;
  repository?: { type: string; url: string };
  server: {
    type: string;
    entry_point: string;
    mcp_config: { command: string; args: string[]; env?: Record<string, string> };
  };
  user_config?: Record<
    string,
    { type: string; title: string; description?: string; required?: boolean; sensitive?: boolean }
  >;
  compatibility?: { runtimes?: Record<string, string>; platforms?: string[] };
  tools?: { name: string }[];
};

function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest;
}

describe('pnpm build:mcpb', () => {
  beforeAll(() => {
    fs.rmSync(DIST_MCPB, { recursive: true, force: true });
    fs.rmSync(BUNDLE, { force: true });
    execSync('pnpm build:mcpb', { cwd: REPO_ROOT, stdio: 'pipe' });
  }, 180_000);

  it('1.1 writes a manifest with the fields the MCPB spec requires', () => {
    expect(fs.existsSync(MANIFEST)).toBe(true);
    const m = readManifest();
    expect(m.manifest_version).toBe('0.3');
    expect(m.name).toBe('formio-mcp');
    expect(m.description).toBeTruthy();
    expect(m.author.name).toBe('Form.io');
    expect(m.server.type).toBe('node');
  });

  it('1.2 keeps the manifest version in step with the published package', () => {
    const { version } = JSON.parse(fs.readFileSync(SERVER_PACKAGE_JSON, 'utf8')) as {
      version: string;
    };
    expect(readManifest().version).toBe(version);
  });

  it('1.3 points the entry point at the bundled server, which exists', () => {
    const m = readManifest();
    expect(m.server.entry_point).toBe('server/index.mjs');
    expect(fs.existsSync(SERVER_BUNDLE)).toBe(true);
    expect(m.server.mcp_config.command).toBe('node');
    expect(m.server.mcp_config.args[0]).toContain('${__dirname}');
    expect(m.server.mcp_config.args[0]).toContain('server/index.mjs');
  });

  it('1.4 asks the user only for what the server needs, and marks the key sensitive', () => {
    const cfg = readManifest().user_config ?? {};
    expect(Object.keys(cfg).sort()).toEqual([
      'formio_api_key',
      'formio_base_url',
      'formio_project_url',
    ]);
    // The project URL is the one setting the server cannot start without.
    expect(cfg.formio_project_url.required).toBe(true);
    expect(cfg.formio_base_url.required).toBeFalsy();
    // An API key is a credential: it must never be stored in plain text by the host.
    expect(cfg.formio_api_key.sensitive).toBe(true);
    expect(cfg.formio_api_key.required).toBeFalsy();
  });

  it('1.5 wires each user_config entry through to the env var the server reads', () => {
    const env = readManifest().server.mcp_config.env ?? {};
    expect(env.FORMIO_PROJECT_URL).toBe('${user_config.formio_project_url}');
    expect(env.FORMIO_BASE_URL).toBe('${user_config.formio_base_url}');
    expect(env.FORMIO_API_KEY).toBe('${user_config.formio_api_key}');
    // Plugin-only behaviour must not leak into the desktop bundle: with it set the
    // server would ignore FORMIO_PROJECT_URL and expect a per-cwd project map.
    expect(env.FORMIO_PLUGIN_CONTEXT).toBeUndefined();
  });

  it('1.6 ships an icon and declares a Node runtime floor', () => {
    const m = readManifest();
    expect(m.icon).toBe('icon.png');
    expect(fs.existsSync(ICON)).toBe(true);
    expect(m.compatibility?.runtimes?.node).toBeTruthy();
  });

  it('1.7 produces a .mcpb archive', () => {
    expect(fs.existsSync(BUNDLE)).toBe(true);
    // .mcpb is a zip; check the magic bytes rather than trusting the extension.
    const head = fs.readFileSync(BUNDLE).subarray(0, 2).toString('binary');
    expect(head).toBe('PK');
    expect(fs.statSync(BUNDLE).size).toBeGreaterThan(10_000);
  });

  it('1.8 the bundled server actually starts and answers a tool call', () => {
    const request = [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"mcpb-test","version":"1"}}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"hello","arguments":{"name":"MCPB"}}}',
      '',
    ].join('\n');

    const result = spawnSync('node', [SERVER_BUNDLE], {
      input: request,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, FORMIO_PROJECT_URL: 'https://example.form.io' },
    });

    expect(result.stdout).toContain('"serverInfo"');
    expect(result.stdout).toContain('Hello from formio-mcp, MCPB!');
  }, 90_000);
});
