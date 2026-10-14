// `pnpm build:plugin:local` writes a copy of the built plugin whose manifests
// launch the plugin's own bundled server, so `claude --plugin-dir` tests skills
// against the server built from the same commit. Driven through the CLI with
// scratch directories, like the other scripts' tests: scripts/ lives outside this
// package's rootDir, and the repository's own bundle must stay untouched.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/build-plugin-local.ts');
const PUBLISHED = { command: 'npx', args: ['-y', '@formio/mcp@9.9.9'] };
const SYSTEM_CA = process.allowedNodeEnvironmentFlags.has('--use-system-ca')
  ? ['--use-system-ca']
  : [];

function scratchPlugin(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-local-src-'));
  const write = (rel: string, value: unknown) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(value, null, 2));
  };
  write('.claude-plugin/plugin.json', {
    name: 'formio-ai',
    version: '9.9.9',
    mcpServers: { 'formio-mcp': PUBLISHED, other: { command: 'other' } },
  });
  write('.cursor-plugin/plugin.json', {
    name: 'formio-ai',
    mcpServers: { 'formio-mcp': PUBLISHED },
  });
  write('mcp.json', { mcpServers: { 'formio-mcp': { type: 'stdio', ...PUBLISHED } } });
  write('plugin.json', { name: 'formio-ai', version: '9.9.9' });
  fs.mkdirSync(path.join(dir, 'server'));
  fs.writeFileSync(path.join(dir, 'server/stdio.mjs'), '// bundled server');
  return dir;
}

function run(source: string, out: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs'),
      SCRIPT,
      '--skip-build',
      '--source',
      source,
      '--out',
      out,
    ],
    { encoding: 'utf8' }
  );
}

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;

describe('build:plugin:local', () => {
  it('launches the bundled server from every formio-mcp manifest entry', () => {
    const source = scratchPlugin();
    const out = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-local-out-')),
      'plugin-local'
    );
    const result = run(source, out);
    expect(result.status, result.stderr).toBe(0);

    const server = path.join(out, 'server/stdio.mjs');
    const expected = { command: 'node', args: [...SYSTEM_CA, server] };
    const claude = read(path.join(out, '.claude-plugin/plugin.json')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(claude.mcpServers['formio-mcp']).toEqual(expected);
    expect(claude.mcpServers.other).toEqual({ command: 'other' });
    expect(
      (
        read(path.join(out, '.cursor-plugin/plugin.json')) as {
          mcpServers: Record<string, unknown>;
        }
      ).mcpServers['formio-mcp']
    ).toEqual(expected);
    expect(
      (read(path.join(out, 'mcp.json')) as { mcpServers: Record<string, unknown> }).mcpServers[
        'formio-mcp'
      ]
    ).toEqual({ type: 'stdio', ...expected });
    expect(read(path.join(out, 'plugin.json'))).toEqual({ name: 'formio-ai', version: '9.9.9' });
  });

  it('leaves the source plugin unchanged', () => {
    const source = scratchPlugin();
    const before = fs.readFileSync(path.join(source, '.claude-plugin/plugin.json'), 'utf8');
    const out = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-local-out-')),
      'plugin-local'
    );
    expect(run(source, out).status).toBe(0);
    expect(fs.readFileSync(path.join(source, '.claude-plugin/plugin.json'), 'utf8')).toBe(before);
  });

  it('refuses a source with no bundled server', () => {
    const source = scratchPlugin();
    fs.rmSync(path.join(source, 'server'), { recursive: true });
    const out = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-local-out-')),
      'plugin-local'
    );
    const result = run(source, out);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/server\/stdio\.mjs/);
  });
});
