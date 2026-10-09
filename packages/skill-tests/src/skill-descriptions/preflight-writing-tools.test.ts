// The shared preflight's last sentence names the calls that WRITE, so an agent states
// the resolved project before the first of them. A writing tool missing from that
// list is a write that lands on a deployment nobody confirmed.
//
// `shared-prose-stays-identical` keeps every copy the same; this keeps the one text
// they share complete. The two together fail an edit that reaches some copies only,
// and an edit that reaches every copy but leaves a writing tool out.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allSkills, repoRoot } from './helpers.js';

// Every tool that changes the deployment. A read is not on the list: confirming the
// target before a read guards nothing that cannot be repeated.
const WRITING_TOOLS = [
  'form_create',
  'form_update',
  'form_publish',
  'form_revert',
  'role_create',
  'role_update',
  'action_create',
  'action_update',
  'action_delete',
  'project_import',
];

// The handoff target carries no preflight, and the planner calls no MCP tool.
const EXEMPT = ['formio-mcp-setup', 'formio-resource-planner'];

const WRITES_SENTENCE = /Before the first call that WRITES \(([^)]*)\)/;

function writingToolsNamedIn(path: string): string[] | undefined {
  const match = readFileSync(join(repoRoot, path), 'utf8').match(WRITES_SENTENCE);
  return match ? [...match[1].matchAll(/`([a-z_]+)`/g)].map((name) => name[1]) : undefined;
}

describe('the shared preflight names every writing tool', () => {
  const gated = allSkills().filter((skill) => !EXEMPT.includes(skill.directoryName));

  it('has gated skills to check', () => {
    expect(gated.length).toBeGreaterThan(1);
  });

  it.each(gated.map((skill) => skill.path))('%s lists every writing tool', (path) => {
    const named = writingToolsNamedIn(path);

    expect(named, `${path} has no "Before the first call that WRITES (…)" sentence`).toBeDefined();
    expect(named?.slice().sort()).toEqual(WRITING_TOOLS.slice().sort());
  });
});
