// The shared preflight in every tool-calling skill names the calls that WRITE, so an
// agent states the resolved project before the first of them. The set is derived from
// the tools' own annotations — a write that reaches the deployment is not read-only
// and talks to a system outside this process — so registering a writing tool fails
// this test until every preflight copy names it. `project_set` writes only the local
// mapping and is rightly left out.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { registerAllTools } from '../tools/index.js';
import { connectTools, TEST_CONFIG } from './test-helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');
const WRITES_SENTENCE = /Before the first call that WRITES \(([^)]*)\)/;

function skillFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return skillFiles(full);
    return entry.name === 'SKILL.md' ? [full] : [];
  });
}

/** The registered tools that write to a deployment, by their annotations. */
export function writingTools(tools: Tool[]): string[] {
  return tools
    .filter(
      ({ annotations }) =>
        annotations?.readOnlyHint === false && annotations?.openWorldHint === true
    )
    .map(({ name }) => name)
    .sort();
}

describe('the preflight names exactly the tools that write to a deployment', () => {
  it('derives the writing set from the annotations', async () => {
    const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
    const derived = writingTools((await client.listTools()).tools);

    expect(derived).toContain('form_create');
    expect(derived).not.toContain('project_set');
    expect(derived).not.toContain('form_get');
  });

  it('matches the set in every preflight copy', async () => {
    const client = await connectTools((server) => registerAllTools(server, TEST_CONFIG));
    const derived = writingTools((await client.listTools()).tools);
    const copies = skillFiles(skillsRoot).flatMap((path) => {
      const match = readFileSync(path, 'utf8').match(WRITES_SENTENCE);
      return match
        ? [
            {
              path: relative(repoRoot, path),
              named: [...match[1].matchAll(/`([a-z_]+)`/g)].map((m) => m[1]).sort(),
            },
          ]
        : [];
    });

    expect(copies.length).toBeGreaterThan(1);
    const wrong = copies.filter(({ named }) => named.join() !== derived.join());
    expect(wrong.map(({ path, named }) => `${path}: ${named.join(', ')}`)).toEqual([]);
  });
});
