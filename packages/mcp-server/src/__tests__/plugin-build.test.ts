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

  it('1.3 includes formio-api/ and formio-form/ but excludes openspec-* and tdd-* skills', () => {
    expect(fs.existsSync(SKILLS_DIR)).toBe(true);
    const entries = fs.readdirSync(SKILLS_DIR);
    expect(entries).toContain('formio-api');
    expect(entries).toContain('formio-form');
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

  it('1.5 cleans dist/plugin/ before assembling (stale file does not survive rebuild)', () => {
    const stalePath = path.join(DIST_PLUGIN, 'stale-sentinel.txt');
    fs.writeFileSync(stalePath, 'should be removed by next build');
    runBuild();
    expect(fs.existsSync(stalePath)).toBe(false);
    expect(fs.existsSync(PLUGIN_JSON)).toBe(true);
  }, 120_000);
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

    it('3.3 confirms formio-api/ and formio-form/ skills are present', () => {
      const { status, stdout } = runSmokeTest();
      expect(status).toBe(0);
      expect(stdout).toMatch(/formio-api/);
      expect(stdout).toMatch(/formio-form/);
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
