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
// Same server bytes, a manifest Smithery accepts and `mcpb pack` does not.
const SMITHERY_BUNDLE = path.join(REPO_ROOT, 'dist/formio-mcp.smithery.mcpb');
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
  tools?: {
    name: string;
    description?: string;
    inputSchema?: { type?: string; properties?: Record<string, { description?: string }> };
    outputSchema?: { type?: string };
    annotations?: { title?: string; readOnlyHint?: boolean };
  }[];
  tools_generated?: boolean;
  privacy_policies?: string[];
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
      'formio_default_project_url',
    ]);
    // Nothing here is required. The server starts with an empty environment and
    // serves its whole tool list; the tools that need a project raise an
    // actionable error at call time. A host that blocks installation on a value
    // the server runs without is describing a constraint that does not exist.
    expect(cfg.formio_default_project_url.required).toBeFalsy();
    expect(cfg.formio_default_project_url.description).toMatch(/https/);
    expect(cfg.formio_base_url.required).toBeFalsy();
    // An API key is a credential: it must never be stored in plain text by the host.
    expect(cfg.formio_api_key.sensitive).toBe(true);
    expect(cfg.formio_api_key.required).toBeFalsy();
  });

  it('1.5 wires each user_config entry through to the env var the server reads', () => {
    const env = readManifest().server.mcp_config.env ?? {};
    expect(env.FORMIO_DEFAULT_PROJECT_URL).toBe('${user_config.formio_default_project_url}');
    expect(env.FORMIO_BASE_URL).toBe('${user_config.formio_base_url}');
    expect(env.FORMIO_API_KEY).toBe('${user_config.formio_api_key}');
    // The install answer is a suggestion the agent confirms, never a pin: an
    // answer given once at install must not outrank a project_set mapping in
    // every directory the user later works in.
    expect(env.FORMIO_PROJECT_URL).toBeUndefined();
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

  // Directories that ingest the bundle read this list instead of launching the
  // server — Smithery's listing showed no tools at all while the manifest
  // declared none. It is generated from the built server rather than hand-written,
  // so it cannot drift from what the server actually serves.
  it('1.9 declares every tool the bundled server serves, with descriptions', () => {
    const declared = readManifest().tools ?? [];
    expect(declared.length).toBeGreaterThan(0);

    const request = [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"mcpb-test","version":"1"}}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}',
      '',
    ].join('\n');
    // No project URL: the manifest must describe the surface a fresh install
    // exposes, which is exactly what a crawler sees.
    const result = spawnSync('node', [SERVER_BUNDLE], {
      input: request,
      encoding: 'utf8',
      timeout: 60_000,
      env: { PATH: process.env.PATH },
    });
    const listed = (
      result.stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[] } })
        .find((m) => m.id === 2)?.result?.tools ?? []
    ).map((t) => t.name);

    expect(listed.length).toBeGreaterThan(0);
    expect(declared.map((t) => t.name).sort()).toEqual([...listed].sort());
    for (const tool of declared) {
      expect(tool.description, `${tool.name} declared without a description`).toBeTruthy();
    }
  }, 90_000);

  it('1.10 does not claim its tools are generated at runtime once they are declared', () => {
    expect(readManifest().tools_generated).toBe(false);
  });

  // The Anthropic Software Directory requires all three of a README section, this
  // manifest array, and HTTPS URLs — "missing or incomplete privacy policies
  // result in immediate rejection". Asserting the trio here is what stops a
  // submission failing on a field nobody remembers to set.
  it('1.13 declares a privacy policy the way the directory requires', () => {
    const policies = readManifest().privacy_policies ?? [];
    expect(policies.length).toBeGreaterThan(0);
    for (const url of policies) {
      expect(url, `${url} must be served over HTTPS`).toMatch(/^https:\/\//);
    }
    // manifest_version 0.2+ is the floor for the field.
    expect(Number(readManifest().manifest_version)).toBeGreaterThanOrEqual(0.2);
  });

  it('1.14 ships a Privacy Policy section inside the bundle README', () => {
    const readme = execSync(`unzip -p "${BUNDLE}" README.md`, { encoding: 'utf8' });
    expect(readme).toMatch(/^#{1,4}\s*Privacy Policy\s*$/m);
    // The section is only useful if it points somewhere.
    const section = readme.slice(readme.search(/^#{1,4}\s*Privacy Policy\s*$/m));
    expect(section).toContain('https://form.io/privacy');
  });

  // The MCPB schema is strict: it permits only name and description per tool and
  // rejects an inputSchema outright ("Unrecognized key(s)"), which is why the
  // Smithery variant exists separately.
  it('1.11 keeps the spec bundle within what the MCPB schema permits', () => {
    for (const tool of readManifest().tools ?? []) {
      expect(Object.keys(tool).sort()).toEqual(['description', 'name']);
    }
    const mcpb = path.join(REPO_ROOT, 'node_modules/.bin/mcpb');
    const result = spawnSync(mcpb, ['validate', MANIFEST], { encoding: 'utf8', timeout: 60_000 });
    expect(result.stdout + result.stderr).toContain('validation passes');
  }, 90_000);

  // Smithery's CLI copies manifest.tools verbatim into the serverCard it uploads
  // and validates against the MCP Tool type: entries with no inputSchema object
  // were refused with a 400, once per tool. A manifest that satisfies it cannot be
  // packed by `mcpb pack`, so it ships as its own archive.
  it('1.12 gives Smithery the full tool definitions in its own bundle', () => {
    expect(fs.existsSync(SMITHERY_BUNDLE)).toBe(true);
    const manifest = JSON.parse(
      execSync(`unzip -p "${SMITHERY_BUNDLE}" manifest.json`, { encoding: 'utf8' })
    ) as Manifest;

    const declared = manifest.tools ?? [];
    // Same tools as the spec bundle — the two differ only in how much they say.
    expect(declared.map((t) => t.name).sort()).toEqual(
      (readManifest().tools ?? []).map((t) => t.name).sort()
    );
    expect(manifest.version).toBe(readManifest().version);

    for (const tool of declared) {
      expect(tool.description, `${tool.name} declared without a description`).toBeTruthy();
      expect(tool.inputSchema?.type, `${tool.name} declared without an inputSchema`).toBe('object');
      expect(tool.outputSchema?.type, `${tool.name} declared without an outputSchema`).toBe(
        'object'
      );
      expect(
        tool.annotations?.title,
        `${tool.name} declared without an annotation title`
      ).toBeTruthy();
      for (const [param, schema] of Object.entries(tool.inputSchema?.properties ?? {})) {
        expect(schema.description, `${tool.name}.${param} has no description`).toBeTruthy();
      }
    }
  }, 90_000);
});
