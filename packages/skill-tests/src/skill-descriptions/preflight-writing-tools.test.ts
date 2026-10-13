// The shared preflight's last sentence names the calls that WRITE, so an agent states
// the resolved project before the first of them. A writing tool missing from that
// list is a write that lands on a deployment nobody confirmed.
//
// Which tools write is the server's to say: packages/mcp-server's
// preflight-writing-tools test derives the set from the registered tools'
// annotations and checks every copy against it. This test holds the skills' side —
// every gated skill carries the sentence, and every copy names the same set — so a
// copy that drifts fails here even before the server test runs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allSkills, repoRoot } from './helpers.js';

// The handoff target carries no preflight, and the planner calls no MCP tool.
const EXEMPT = ['formio-mcp-setup', 'formio-resource-planner'];

const WRITES_SENTENCE = /Before the first call that WRITES \(([^)]*)\)/;

function writingToolsNamedIn(path: string): string[] | undefined {
  const match = readFileSync(join(repoRoot, path), 'utf8').match(WRITES_SENTENCE);
  return match ? [...match[1].matchAll(/`([a-z_]+)`/g)].map((name) => name[1]) : undefined;
}

describe('the shared preflight names its writing tools', () => {
  const gated = allSkills().filter((skill) => !EXEMPT.includes(skill.directoryName));

  it('has gated skills to check', () => {
    expect(gated.length).toBeGreaterThan(1);
  });

  it.each(gated.map((skill) => skill.path))('%s carries the WRITES sentence', (path) => {
    expect(
      writingToolsNamedIn(path),
      `${path} has no "Before the first call that WRITES (…)" sentence`
    ).toBeDefined();
  });

  it('names the same writing tools in every copy', () => {
    const sets = new Set(
      gated.map((skill) => (writingToolsNamedIn(skill.path) ?? []).slice().sort().join(', '))
    );
    expect([...sets]).toHaveLength(1);
  });
});
