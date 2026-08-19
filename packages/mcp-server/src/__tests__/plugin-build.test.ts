import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist/plugin');
const PLUGIN_JSON = path.join(DIST_PLUGIN, '.claude-plugin/plugin.json');
const SERVER_BUNDLE = path.join(DIST_PLUGIN, 'server/stdio.mjs');
const SKILLS_DIR = path.join(DIST_PLUGIN, 'skills');
const PLUGIN_SRC_README = path.join(REPO_ROOT, 'plugin/README.md');
const DIST_README = path.join(DIST_PLUGIN, 'README.md');
// FORMIO_DEFAULT_PROJECT_URL is gone: the environment is the weakest resolution
// source, so a project set there already suggests without pinning, which is what
// the separate offering variable existed to guarantee.
const REQUIRED_ENV_VARS = [
  'FORMIO_BASE_URL',
  'FORMIO_PROJECT_URL',
  'FORMIO_API_KEY',
  'FORMIO_LOGIN_FORM',
] as const;

function runBuild() {
  execSync('pnpm build:plugin', { cwd: REPO_ROOT, stdio: 'pipe' });
}

function runSmokeTest(): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('pnpm', ['test:plugin'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('pnpm build:plugin', () => {
  beforeAll(() => {
    fs.rmSync(DIST_PLUGIN, { recursive: true, force: true });
    runBuild();
  }, 120_000);

  it('1.1 produces dist/plugin/.claude-plugin/plugin.json with name, version, description, mcpServers', () => {
    expect(fs.existsSync(PLUGIN_JSON)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(typeof manifest.version).toBe('string');
    expect(manifest.version.length).toBeGreaterThan(0);
    expect(typeof manifest.description).toBe('string');
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(manifest.mcpServers).toBeDefined();
    const servers = manifest.mcpServers as Record<string, { command?: string }>;
    const entries = Object.entries(servers);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, server] of entries) {
      expect(typeof server.command).toBe('string');
      expect((server.command ?? '').length).toBeGreaterThan(0);
    }
  });

  it('1.2 writes dist/plugin/server/stdio.mjs that parses as valid JavaScript', () => {
    expect(fs.existsSync(SERVER_BUNDLE)).toBe(true);
    const source = fs.readFileSync(SERVER_BUNDLE, 'utf8');
    expect(source.length).toBeGreaterThan(0);
    expect(() =>
      execSync(`node --check ${JSON.stringify(SERVER_BUNDLE)}`, { stdio: 'pipe' })
    ).not.toThrow();
  });

  it('1.3 includes formio-api/, formio-schema/, formio-form/, and formio-form-builder/ but excludes openspec-* and tdd-* skills', () => {
    expect(fs.existsSync(SKILLS_DIR)).toBe(true);
    const entries = fs.readdirSync(SKILLS_DIR);
    expect(entries).toContain('formio-api');
    expect(entries).toContain('formio-schema');
    expect(entries).toContain('formio-form');
    expect(entries).toContain('formio-form-builder');
    for (const entry of entries) {
      expect(
        entry.startsWith('openspec-'),
        `dist/plugin/skills/${entry} should not ship openspec-* skills`
      ).toBe(false);
      expect(
        entry.startsWith('tdd-'),
        `dist/plugin/skills/${entry} should not ship tdd-* skills`
      ).toBe(false);
    }
  });

  it('1.4 publishes plugin/README.md documenting every server-config env var', () => {
    expect(fs.existsSync(PLUGIN_SRC_README)).toBe(true);
    expect(fs.existsSync(DIST_README)).toBe(true);
    const srcReadme = fs.readFileSync(PLUGIN_SRC_README, 'utf8');
    const distReadme = fs.readFileSync(DIST_README, 'utf8');
    expect(distReadme).toBe(srcReadme);
    for (const envVar of REQUIRED_ENV_VARS) {
      expect(srcReadme, `plugin/README.md must document ${envVar}`).toContain(envVar);
    }
    expect(srcReadme).toMatch(/required/i);
    expect(srcReadme).toMatch(/\/user\/login/);
  });

  // The server no longer reads any host-mode variable, so the manifest must not
  // set one: a launcher that still injects it would suggest a behaviour that no
  // longer exists.
  it('1.6 sets no FORMIO_PLUGIN_CONTEXT in the MCP server environment', () => {
    const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')) as {
      mcpServers: Record<string, { env?: Record<string, string> }>;
    };

    for (const [name, server] of Object.entries(manifest.mcpServers)) {
      expect(
        Object.keys(server.env ?? {}),
        `${name} must not set FORMIO_PLUGIN_CONTEXT`
      ).not.toContain('FORMIO_PLUGIN_CONTEXT');
    }
  });

  it('1.7 ships the Angular resources sub-skill at its spec-conformant path', () => {
    const subSkill = path.join(SKILLS_DIR, 'formio-angular/formio-angular-resources/SKILL.md');

    expect(fs.existsSync(subSkill)).toBe(true);
    expect(fs.existsSync(path.join(SKILLS_DIR, 'formio-angular/resources'))).toBe(false);
    expect(fs.readFileSync(subSkill, 'utf8')).toMatch(/^name: formio-angular-resources$/m);
  });

  it('1.8 answers tools/list including project_set with an empty environment', () => {
    const request = `${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'plugin-build-test', version: '0.0.0' },
      },
    })}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`;

    const result = spawnSync('node', [SERVER_BUNDLE], {
      input: request,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
      } as NodeJS.ProcessEnv,
      timeout: 30_000,
    });

    expect(result.stdout).toContain('project_set');
    expect(result.stdout).toContain('form_list');
  }, 60_000);

  // Every client reads its own manifest, so all three must ship and all three
  // must carry the same version — clients display it and marketplaces key
  // updates on it.
  it('1.9 ships all three manifests plus mcp.json over one skills tree', () => {
    for (const rel of [
      'plugin.json',
      'mcp.json',
      '.cursor-plugin/plugin.json',
      '.claude-plugin/plugin.json',
    ]) {
      expect(fs.existsSync(path.join(DIST_PLUGIN, rel)), `dist/plugin/${rel}`).toBe(true);
    }
    expect(fs.existsSync(SKILLS_DIR)).toBe(true);
    expect(fs.existsSync(path.join(DIST_PLUGIN, 'assets/formio-logo.png'))).toBe(true);
  });

  it('1.10 stamps every manifest version from plugin/package.json', () => {
    const { version } = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'plugin/package.json'), 'utf8')
    ) as { version: string };

    for (const rel of ['plugin.json', '.cursor-plugin/plugin.json', '.claude-plugin/plugin.json']) {
      const manifest = JSON.parse(fs.readFileSync(path.join(DIST_PLUGIN, rel), 'utf8')) as {
        version?: string;
      };
      expect(manifest.version, `dist/plugin/${rel} version`).toBe(version);
    }
  });

  // Three manifests that all lack a version agree with each other, which is
  // exactly what the agreement guard must not accept: an unversioned bundle is
  // the drift it exists to catch, not the absence of drift.
  it('1.11 fails the smoke test when no manifest carries a version', () => {
    const manifests = [
      'plugin.json',
      '.cursor-plugin/plugin.json',
      '.claude-plugin/plugin.json',
    ].map((rel) => path.join(DIST_PLUGIN, rel));
    const originals = manifests.map((file) => fs.readFileSync(file, 'utf8'));

    try {
      for (const file of manifests) {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
        delete manifest.version;
        fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
      }

      const result = runSmokeTest();

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/version/i);
    } finally {
      manifests.forEach((file, index) => fs.writeFileSync(file, originals[index]));
    }
  }, 120_000);

  // A build is a read of the source tree, not a write to it. `prepublishOnly`
  // runs this build, so a build that stamps versions mutates committed manifests
  // during a release — and after any hand-edit of plugin/package.json, outside
  // any `changeset:version` run. Verification belongs to `pnpm sync:versions`.
  it('1.12 leaves the committed source manifests byte-identical', () => {
    const sources = ['plugin.json', '.cursor-plugin/plugin.json', '.claude-plugin/plugin.json'].map(
      (rel) => path.join(REPO_ROOT, 'plugin', rel)
    );
    const before = sources.map((file) => fs.readFileSync(file, 'utf8'));

    runBuild();

    sources.forEach((file, index) => {
      expect(fs.readFileSync(file, 'utf8'), path.relative(REPO_ROOT, file)).toBe(before[index]);
    });
  }, 120_000);

  // Silently shipping a bundle that omits one client's manifest is worse than a
  // failed build: it installs fine everywhere else and breaks in exactly one
  // tool. Asserted through the exported guard rather than by renaming a file in
  // the shared source tree, which raced with every other suite reading it.
  it('1.5 cleans dist/plugin/ before assembling (stale file does not survive rebuild)', () => {
    const stalePath = path.join(DIST_PLUGIN, 'stale-sentinel.txt');
    fs.writeFileSync(stalePath, 'should be removed by next build');
    runBuild();
    expect(fs.existsSync(stalePath)).toBe(false);
    expect(fs.existsSync(PLUGIN_JSON)).toBe(true);
  }, 120_000);
});

describe('plugin/package.json files list', () => {
  // A manifest present in the repo but missing from the tarball installs cleanly
  // from git and breaks from npm — the failure mode this guards.
  it('4.5 covers every manifest that ships', () => {
    const { files } = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'plugin/package.json'), 'utf8')
    ) as { files: string[] };

    for (const entry of ['plugin.json', 'mcp.json', '.cursor-plugin', 'assets']) {
      expect(files, `plugin/package.json files must include ${entry}`).toContain(entry);
    }
  });

  // Every manifest launches `npx -y @formio/mcp`, so the bundled server file is
  // dead weight in the tarball — and shipping it invites the reading that an
  // install runs it. The build still writes it for the smoke test.
  it('4.5c ships no server bundle no manifest launches', () => {
    const { files } = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'plugin/package.json'), 'utf8')
    ) as { files: string[] };

    expect(files).not.toContain('server');
  });

  // `files` is a closed list, so the changelog only reaches npm by being named.
  it('4.5d ships the changelog anyone upgrading reads', () => {
    const { files } = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'plugin/package.json'), 'utf8')
    ) as { files: string[] };

    expect(files).toContain('CHANGELOG.md');
  });

  it('4.5b lists nothing the built tree lacks', () => {
    const { files } = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'plugin/package.json'), 'utf8')
    ) as { files: string[] };

    for (const entry of files) {
      expect(fs.existsSync(path.join(DIST_PLUGIN, entry)), `dist/plugin/${entry}`).toBe(true);
    }
  });
});

describe('pnpm test:plugin — smoke test', () => {
  describe('after a successful build', () => {
    beforeAll(() => {
      runBuild();
    }, 120_000);

    it('3.1 validates plugin.json has required fields and exits 0', () => {
      const { status } = runSmokeTest();
      expect(status).toBe(0);
    }, 60_000);

    it('3.2 exercises tools/list against the bundled MCP server and exits 0', () => {
      const { status, stdout } = runSmokeTest();
      expect(status).toBe(0);
      expect(stdout).toMatch(/tools\/list|tools-list|tools list/i);
    }, 60_000);

    it('3.5 validates every manifest and exits non-zero when one is missing', () => {
      const target = path.join(DIST_PLUGIN, 'mcp.json');
      const stash = `${target}.stashed`;
      fs.renameSync(target, stash);
      try {
        const { status, stdout, stderr } = runSmokeTest();
        expect(status).not.toBe(0);
        expect(`${stdout}\n${stderr}`).toMatch(/mcp\.json/);
      } finally {
        fs.renameSync(stash, target);
      }
    }, 60_000);

    // Driven by ADDING an undeclared placeholder rather than deleting a
    // declaration: the manifest now prompts for nothing, so there is no
    // declaration left to delete — and the invariant that matters is still that a
    // placeholder without a declaration is caught, which Cursor rejects at
    // submission.
    it('3.6 exits non-zero when the Cursor variables and placeholders disagree', () => {
      const target = path.join(DIST_PLUGIN, '.cursor-plugin/plugin.json');
      const original = fs.readFileSync(target, 'utf8');
      const manifest = JSON.parse(original) as {
        mcpServers: Record<string, { env?: Record<string, string> }>;
      };
      manifest.mcpServers['formio-mcp'].env = { FORMIO_BASE_URL: '${FORMIO_BASE_URL}' };
      fs.writeFileSync(target, JSON.stringify(manifest, null, 2));
      try {
        const { status, stdout, stderr } = runSmokeTest();
        expect(status).not.toBe(0);
        expect(`${stdout}\n${stderr}`).toMatch(/FORMIO_BASE_URL|variable/i);
      } finally {
        fs.writeFileSync(target, original);
      }
    }, 60_000);

    it('3.3 confirms formio-api/ and formio-schema/ skills are present', () => {
      const { status, stdout } = runSmokeTest();
      expect(status).toBe(0);
      expect(stdout).toMatch(/formio-api/);
      expect(stdout).toMatch(/formio-schema/);
    }, 60_000);
  });

  describe('when dist/plugin is missing', () => {
    beforeAll(() => {
      fs.rmSync(DIST_PLUGIN, { recursive: true, force: true });
    });

    it('3.4 exits non-zero with a message telling the user to build first', () => {
      const { status, stderr, stdout } = runSmokeTest();
      expect(status).not.toBe(0);
      const combined = `${stdout}\n${stderr}`.toLowerCase();
      expect(combined).toMatch(/build/);
      expect(combined).toMatch(/dist\/plugin|plugin build/);
    }, 60_000);
  });
});
