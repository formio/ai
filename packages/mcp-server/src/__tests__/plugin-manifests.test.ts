// Source-manifest invariants for the multi-client plugin directory.
//
// One `skills/` tree and one `mcp.json` are consumed through three manifests —
// Agent Plugins (`plugin.json`), Cursor (`.cursor-plugin/plugin.json`), and
// Claude Code (`.claude-plugin/plugin.json`). Each client detects its own by
// location, so a manifest that drifts breaks exactly one client, silently, in a
// tool nobody on the team happens to run. These assertions are the guard.
//
// Build-output assertions live in plugin-build.test.ts; everything here reads the
// source tree and needs no build.

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const PLUGIN_SRC = path.join(REPO_ROOT, 'plugin');
const AGENT_PLUGIN_MANIFEST = path.join(PLUGIN_SRC, 'plugin.json');
const MCP_MANIFEST = path.join(PLUGIN_SRC, 'mcp.json');
const CURSOR_MANIFEST = path.join(PLUGIN_SRC, '.cursor-plugin/plugin.json');
const CLAUDE_MANIFEST = path.join(PLUGIN_SRC, '.claude-plugin/plugin.json');
const SKILLS_DIR = path.join(PLUGIN_SRC, 'skills');
const SERVER_PACKAGE_JSON = path.join(REPO_ROOT, 'packages/mcp-server/package.json');
const REGISTRY_MANIFEST = path.join(REPO_ROOT, 'server.json');
const PLUGIN_PACKAGE_JSON = path.join(PLUGIN_SRC, 'package.json');

const AGENT_PLUGINS_SPEC_VERSION = '1.0.0';
const PLUGIN_SCHEMA = `https://agent-plugins.org/schemas/${AGENT_PLUGINS_SPEC_VERSION}/plugin.schema.json`;
const MCP_SCHEMA = `https://agent-plugins.org/schemas/${AGENT_PLUGINS_SPEC_VERSION}/mcp.schema.json`;

const SPEC_TOP_LEVEL_KEYS = [
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
];

function readText(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readText(file)) as Record<string, unknown>;
}

function pluginVersion(): string {
  return (readJson(PLUGIN_PACKAGE_JSON) as { version: string }).version;
}

function specVersionOf(schemaUrl: string): string {
  const match = schemaUrl.match(/schemas\/([^/]+)\//);
  return match ? match[1] : '';
}

interface McpServer {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

function mcpServers(): Record<string, McpServer> {
  return readJson(MCP_MANIFEST).mcpServers as Record<string, McpServer>;
}

describe('plugin/plugin.json — Agent Plugins manifest', () => {
  it('exists', () => {
    expect(fs.existsSync(AGENT_PLUGIN_MANIFEST)).toBe(true);
  });

  it('declares the Agent Plugins 1.0.0 schema and the plugin name', () => {
    const manifest = readJson(AGENT_PLUGIN_MANIFEST);

    expect(manifest.$schema).toBe(PLUGIN_SCHEMA);
    expect(manifest.name).toBe('formio-ai');
  });

  it('carries the metadata a marketplace listing needs', () => {
    const manifest = readJson(AGENT_PLUGIN_MANIFEST);

    expect(typeof manifest.description).toBe('string');
    expect((manifest.description as string).length).toBeGreaterThan(30);
    expect(manifest.license).toBe('MIT');
    expect(manifest.repository).toContain('github.com/formio/ai');
    expect(manifest.homepage).toMatch(/^https:\/\//);
    expect(manifest.author).toMatchObject({ name: 'Form.io' });
    expect(Array.isArray(manifest.keywords)).toBe(true);
  });

  it('declares no top-level field outside the specification set', () => {
    const unexpected = Object.keys(readJson(AGENT_PLUGIN_MANIFEST)).filter(
      (key) => !SPEC_TOP_LEVEL_KEYS.includes(key)
    );

    expect(unexpected).toEqual([]);
  });

  it('carries the version, because the repository tree is an install source', () => {
    expect(readJson(AGENT_PLUGIN_MANIFEST).version).toBe(pluginVersion());
  });
});

describe('plugin/mcp.json — Agent Plugins MCP declaration', () => {
  it('exists', () => {
    expect(fs.existsSync(MCP_MANIFEST)).toBe(true);
  });

  it('declares the same specification version as plugin.json', () => {
    const mcp = readJson(MCP_MANIFEST);

    expect(mcp.$schema).toBe(MCP_SCHEMA);
    expect(specVersionOf(mcp.$schema as string)).toBe(
      specVersionOf(readJson(AGENT_PLUGIN_MANIFEST).$schema as string)
    );
  });

  it('declares exactly one stdio server named formio-mcp', () => {
    const servers = mcpServers();

    expect(Object.keys(servers)).toEqual(['formio-mcp']);
    expect(servers['formio-mcp'].type).toBe('stdio');
  });

  // A git-installed plugin has no build output, so a path into the plugin
  // directory cannot resolve. The published package is the only command that
  // works for every install route.
  it('launches the published server with npx rather than a bundled file', () => {
    const server = mcpServers()['formio-mcp'];

    expect(server.command).toBe('npx');
    expect(server.args).toContain('-y');
    expect(server.args).toContain('@formio/mcp');
  });

  it('names this repository’s server package', () => {
    const declared = mcpServers()['formio-mcp'].args ?? [];
    const { name } = readJson(SERVER_PACKAGE_JSON) as { name: string };

    expect(declared).toContain(name);
  });

  it('uses no placeholder the specification does not define', () => {
    const placeholders = [...JSON.stringify(mcpServers()).matchAll(/\$\{([^}]+)\}/g)].map(
      (match) => match[1]
    );

    for (const placeholder of placeholders) {
      expect(
        ['PLUGIN_ROOT', 'PLUGIN_DATA'],
        `unsupported placeholder \${${placeholder}}`
      ).toContain(placeholder);
    }
  });
});

describe('plugin/.cursor-plugin/plugin.json — Cursor manifest', () => {
  it('exists', () => {
    expect(fs.existsSync(CURSOR_MANIFEST)).toBe(true);
  });

  it('carries the metadata the Cursor marketplace requires', () => {
    const manifest = readJson(CURSOR_MANIFEST);

    expect(manifest.name).toBe('formio-ai');
    expect(typeof manifest.description).toBe('string');
    expect(manifest.license).toBe('MIT');
    expect(manifest.repository).toContain('github.com/formio/ai');
    expect(manifest.author).toMatchObject({ name: 'Form.io' });
    expect(typeof manifest.logo).toBe('string');
  });

  it('points at the one shared skills directory', () => {
    expect(readJson(CURSOR_MANIFEST).skills).toBe('skills');
  });

  it('resolves its skills path to the shipped library', () => {
    const declared = path.join(PLUGIN_SRC, readJson(CURSOR_MANIFEST).skills as string);
    const shipped = fs
      .readdirSync(declared, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => fs.existsSync(path.join(declared, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();

    expect(declared).toBe(SKILLS_DIR);
    expect(shipped).toContain('formio-application');
    expect(shipped).toContain('formio-api');
    expect(shipped.length).toBeGreaterThanOrEqual(10);
  });

  // Cursor's `variables` is its install-time prompt — the analogue of Claude
  // Code's userConfig. A declared-but-unused variable, or a placeholder with no
  // declaration, is rejected at marketplace submission.
  it('declares exactly the variables its placeholders reference', () => {
    const manifest = readJson(CURSOR_MANIFEST);
    const placeholders = new Set(
      [...JSON.stringify(manifest.mcpServers).matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1])
    );
    const variables = manifest.variables as { properties?: Record<string, unknown> };

    expect([...placeholders].sort()).toEqual(Object.keys(variables.properties ?? {}).sort());
  });

  it('defaults the base URL to the hosted cloud', () => {
    const variables = readJson(CURSOR_MANIFEST).variables as {
      properties: Record<string, { default?: string; title?: string }>;
    };

    expect(variables.properties.FORMIO_BASE_URL.default).toBe('https://api.form.io');
  });

  // A deployment is shared across a developer's projects; a Form.io project is
  // one-to-one with the application built against it. Prompting for a project
  // URL at install time offers one folder's answer to every later folder, and
  // the one it is offered in is precisely the one where it is wrong. The
  // directory mapping written by project_set is the only project scope.
  it('prompts for the deployment only — never for a project', () => {
    const variables = readJson(CURSOR_MANIFEST).variables as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(variables.properties)).toEqual(['FORMIO_BASE_URL']);
  });

  // The server starts with no configuration and tells the agent to call
  // project_set, so an install that skips configuration still works.
  it('requires nothing at install time', () => {
    const variables = readJson(CURSOR_MANIFEST).variables as { required?: string[] };

    expect(variables.required ?? []).toEqual([]);
  });

  it('declares the same MCP server as mcp.json', () => {
    const cursorServers = readJson(CURSOR_MANIFEST).mcpServers as Record<string, McpServer>;

    expect(Object.keys(cursorServers)).toEqual(['formio-mcp']);
    expect(cursorServers['formio-mcp'].command).toBe('npx');
    expect(cursorServers['formio-mcp'].args).toContain('@formio/mcp');
  });
});

// The bundle ships no hooks at all. A hook works in one client and is inert in
// the rest, and the guidance this one carried is now in the server's own
// instructions and its project-resolution error — identical everywhere.
describe('the bundle declares no hooks', () => {
  it('is declared by no manifest', () => {
    for (const manifest of [AGENT_PLUGIN_MANIFEST, CURSOR_MANIFEST, CLAUDE_MANIFEST]) {
      expect(
        readJson(manifest).hooks,
        `${path.basename(manifest)} must not declare hooks`
      ).toBeUndefined();
    }
  });

  it('ships no hooks directory', () => {
    expect(fs.existsSync(path.join(PLUGIN_SRC, 'hooks'))).toBe(false);
  });
});

describe('the Claude manifest and the marketplace source', () => {
  const MARKETPLACE = path.join(REPO_ROOT, '.claude-plugin/marketplace.json');

  // A repository path source is what lets the skills CLI discover the library
  // (it reads skill paths declared in a plugin marketplace manifest) and what
  // lets Claude Code install from a clone without waiting on an npm publish.
  it('declares the plugin from the repository path, not the npm package', () => {
    const marketplace = readJson(MARKETPLACE) as {
      plugins: Array<{ name: string; source: unknown }>;
    };
    const entry = marketplace.plugins.find((plugin) => plugin.name === 'formio-ai');

    expect(entry?.source).toBe('./plugin');
  });

  it('launches the published server with npx while keeping the user-config prompt', () => {
    const manifest = readJson(CLAUDE_MANIFEST) as {
      mcpServers: Record<string, McpServer>;
      userConfig?: Record<string, unknown>;
    };
    const server = manifest.mcpServers['formio-mcp'];

    expect(server.command).toBe('npx');
    expect(server.args).toContain('@formio/mcp');
    expect(server.env?.FORMIO_BASE_URL).toBe('${user_config.formio_base_url}');
    expect(Object.keys(manifest.userConfig ?? {})).toContain('formio_base_url');
  });

  // `@formio/mcp` is a 0.x line, so a range in a shipped manifest is a liability
  // either way: a floor goes stale at the next minor, and a ceiling freezes an
  // installed plugin on an old server. The merge-to-release window a floor would
  // guard is closed by release ordering instead, and a server too old to serve
  // project_set shows up as missing tools — which every skill's preflight already
  // routes to formio-mcp-setup.
  it('launches the package by name, with no version range hard-coded', () => {
    for (const manifest of [MCP_MANIFEST, CURSOR_MANIFEST, CLAUDE_MANIFEST]) {
      const servers = (readJson(manifest).mcpServers ?? {}) as Record<string, McpServer>;

      for (const [name, server] of Object.entries(servers)) {
        const args = server.args ?? [];
        expect(args, `${path.basename(manifest)} → ${name}`).toContain('@formio/mcp');
        expect(
          args.filter((arg) => arg.startsWith('@formio/mcp@')),
          `${path.basename(manifest)} → ${name} must not hard-code a version`
        ).toEqual([]);
      }
    }
  });

  // The server defaults the base URL to the hosted cloud and starts with no
  // configuration at all, so blocking an install on a value it supplies itself
  // states a constraint that does not exist — and the docs, the Cursor manifest,
  // and the desktop bundle all describe it as optional. Three manifests, one
  // answer.
  it('asks for the base URL without requiring it, and offers the same default', () => {
    const userConfig = (readJson(CLAUDE_MANIFEST).userConfig ?? {}) as Record<
      string,
      { required?: boolean; default?: string }
    >;

    expect(userConfig.formio_base_url.required ?? false).toBe(false);
    expect(userConfig.formio_base_url.default).toBe('https://api.form.io');
  });

  // Every manifest reachable by a git clone must avoid build output: dist/ does
  // not exist in a clone.
  it('has no manifest launching an MCP server from a path inside the plugin', () => {
    for (const manifest of [
      AGENT_PLUGIN_MANIFEST,
      CURSOR_MANIFEST,
      CLAUDE_MANIFEST,
      MCP_MANIFEST,
    ]) {
      const servers = (readJson(manifest).mcpServers ?? {}) as Record<string, McpServer>;
      for (const [name, server] of Object.entries(servers)) {
        const launch = [server.command ?? '', ...(server.args ?? [])].join(' ');
        expect(launch, `${path.basename(manifest)} → ${name}`).not.toMatch(
          /\$\{CLAUDE_PLUGIN_ROOT\}|\$\{PLUGIN_ROOT\}/
        );
      }
    }
  });

  it('agrees on plugin identity across all three manifests', () => {
    const names = [AGENT_PLUGIN_MANIFEST, CURSOR_MANIFEST, CLAUDE_MANIFEST].map(
      (manifest) => readJson(manifest).name
    );

    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe('formio-ai');
  });

  // `source: "./plugin"` means a marketplace install reads these manifests
  // straight out of the repository tree, where the build's dist/ stamping never
  // ran. An unversioned manifest there is what a client displays and keys
  // updates on, so the version has to be committed — `pnpm sync:versions` (and
  // `changeset:version`, which calls it) writes it from plugin/package.json.
  it('carries a version agreeing with plugin/package.json in every source manifest', () => {
    for (const manifest of [AGENT_PLUGIN_MANIFEST, CURSOR_MANIFEST, CLAUDE_MANIFEST]) {
      expect(readJson(manifest).version, path.basename(manifest)).toBe(pluginVersion());
    }
  });

  // None of the three is in .prettierignore and `changeset:version` runs the
  // sync, so a rewrite that is merely valid JSON lands in the release PR
  // unformatted and turns `format:check` red on every release. Staling the
  // version and re-syncing has to reproduce the committed bytes exactly —
  // formatting included, which a bare JSON.stringify does not.
  it('rewrites a stale version without disturbing the committed formatting', () => {
    // Inside the repository, not the system temp directory: the rewrite resolves
    // Prettier's configuration from the file's own path, and a scratch copy
    // outside the tree would be formatted with Prettier's defaults instead of
    // this repository's — a difference the assertion would report as drift.
    // node_modules keeps it out of the working tree and out of git.
    const scratch = fs.mkdtempSync(path.join(REPO_ROOT, 'node_modules', '.manifest-sync-'));

    try {
      // One invocation for all three, because the script takes a list. Spawning
      // it per manifest cost three cold starts of pnpm, tsx and Prettier, which
      // fit in the default 5s test budget locally and overran it on CI.
      const targets = [AGENT_PLUGIN_MANIFEST, CURSOR_MANIFEST, CLAUDE_MANIFEST].map((manifest) => ({
        manifest,
        target: path.join(scratch, `${path.basename(path.dirname(manifest))}.json`),
      }));

      for (const { manifest, target } of targets) {
        fs.writeFileSync(
          target,
          `${JSON.stringify({ ...readJson(manifest), version: '0.0.0-stale' }, null, 2)}\n`,
          'utf8'
        );
      }

      execSync(
        `pnpm sync:versions ${targets.map(({ target }) => JSON.stringify(target)).join(' ')}`,
        { cwd: REPO_ROOT, stdio: 'pipe' }
      );

      for (const { manifest, target } of targets) {
        expect(readText(target), path.relative(REPO_ROOT, manifest)).toBe(readText(manifest));
      }
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    // Explicit, like every other subprocess-driving test in this package: one
    // pnpm boot on a cold runner is still seconds, and the budget should not
    // depend on how fast the machine is.
  }, 30_000);

  // A build must not rewrite committed source. `pnpm build:plugin` runs on every
  // `prepublishOnly`, so a build that syncs would silently mutate tracked
  // manifests outside a `changeset:version` run — a source edit nobody asked
  // for, attributed to a build. The build verifies instead, and `--check` is the
  // verification it shares with anyone who wants to see the drift.
  it('reports drift without writing when --check is passed', () => {
    const scratch = fs.mkdtempSync(path.join(REPO_ROOT, 'node_modules', '.manifest-check-'));

    try {
      const stale = path.join(scratch, 'plugin.json');
      const before = `${JSON.stringify({ ...readJson(CLAUDE_MANIFEST), version: '0.0.0-stale' }, null, 2)}\n`;
      fs.writeFileSync(stale, before, 'utf8');

      const result = spawnSync('pnpm', ['sync:versions', '--check', stale], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/0\.0\.0-stale|sync:versions/);
      expect(readText(stale)).toBe(before);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }, 30_000);

  it('exits 0 from --check when the manifests already agree', () => {
    const result = spawnSync('pnpm', ['sync:versions', '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  }, 30_000);
});

// The MCP Registry entry is a fourth install route, and its environment list is
// what a registry installer prompts for. It has to describe the same server the
// manifests do.
describe('the MCP Registry entry', () => {
  const environmentVariables = () => {
    const registry = readJson(REGISTRY_MANIFEST) as {
      packages: Array<{ environmentVariables?: Array<{ name: string; isRequired?: boolean }> }>;
    };
    return registry.packages.flatMap((pkg) => pkg.environmentVariables ?? []);
  };

  // FORMIO_PROJECT_URL pins the server and project_set cannot redirect it. Making
  // a registry installer block on it hands every directory the same project and
  // defeats the per-directory mapping — and the server has not required it since
  // getConfig stopped throwing.
  it('requires no environment variable to install', () => {
    const required = environmentVariables()
      .filter((variable) => variable.isRequired)
      .map((variable) => variable.name);

    expect(required).toEqual([]);
  });

  it('documents the variables that steer project resolution and the login flow', () => {
    const names = environmentVariables().map((variable) => variable.name);

    for (const name of [
      'FORMIO_PROJECT_URL',
      'FORMIO_DEFAULT_PROJECT_URL',
      'FORMIO_BASE_URL',
      'FORMIO_API_KEY',
      'FORMIO_FORCE_BROWSER',
    ]) {
      expect(names, `server.json environmentVariables`).toContain(name);
    }
  });
});
