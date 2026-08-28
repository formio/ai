import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectEntry } from '../project-map.js';
import { COMMITTED_CONFIG_FILE } from '../committed-config.js';
import { registerProjectSetTool } from '../tools/project_set.js';
import { connectTools } from './test-helpers.js';

// project_set writes ONE record: the machine-local mapping. The committed
// formio.json is hand-authored — the server reads it and never writes it — so the
// tool must not accept a scope, must never create that file, and must describe the
// hand-authored route rather than a writer it no longer has.
describe('project_set writes only the mapping', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'formio-tool-scope-'));
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.rmSync(path.join(os.homedir(), '.formio'), { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  async function client() {
    return connectTools((server) => registerProjectSetTool(server, { cwd: () => repo }));
  }

  async function call(args: Record<string, unknown>) {
    return (await client()).callTool({ name: 'project_set', arguments: args });
  }

  it('writes the personal mapping', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo });

    expect(result.isError ?? false).toBe(false);
    expect(readProjectEntry(repo)?.env.FORMIO_PROJECT_URL).toBe('https://x.form.io');
    expect(fs.existsSync(path.join(repo, COMMITTED_CONFIG_FILE))).toBe(false);
  });

  // A caller still passing the removed scope argument — from a release that had a
  // committed-file writer — must not get a committed file, and the result must say
  // which record WAS written so the disagreement is visible rather than silent.
  it('never writes a committed file, whatever arguments arrive', async () => {
    const result = await call({ projectUrl: 'https://x.form.io', cwd: repo, scope: 'repo' });

    expect(fs.existsSync(path.join(repo, COMMITTED_CONFIG_FILE))).toBe(false);
    if (!result.isError) {
      expect(JSON.stringify(result.content)).toMatch(/mapping/);
    }
  });

  it('exposes no scope argument in its schema', async () => {
    const { tools } = await (await client()).listTools();
    const schema = tools.find((tool) => tool.name === 'project_set')?.inputSchema as {
      properties?: Record<string, unknown>;
    };

    expect(Object.keys(schema.properties ?? {})).not.toContain('scope');
  });

  it('describes the hand-authored committed file, naming no writer for it', async () => {
    const { tools } = await (await client()).listTools();
    const description = tools.find((tool) => tool.name === 'project_set')?.description ?? '';

    expect(description).toContain(COMMITTED_CONFIG_FILE);
    expect(description).toMatch(/never writes it/);
    expect(description).not.toMatch(/scope: "repo"|--scope|scope argument/);
  });

  // The mapping file is ~/.formio/projects.json — plural, at a named path. The
  // description called it "project.json file in formio configuration folder",
  // which is a file that does not exist: an agent repeating it to the user sends
  // them to edit the wrong path, and the one real path is the one the CLI's own
  // usage text prints.
  it('names the mapping file by its real path', async () => {
    const { tools } = await (await client()).listTools();
    const description = tools.find((tool) => tool.name === 'project_set')?.description ?? '';

    expect(description).toContain('~/.formio/projects.json');
    expect(description).not.toMatch(/project\.json/);
    expect(description).not.toMatch(/formio configuration folder/);
  });
});
