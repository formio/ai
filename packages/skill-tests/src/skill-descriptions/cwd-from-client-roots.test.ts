// With no `cwd` argument the server takes the directory from the client's workspace
// roots, then CLAUDE_PROJECT_DIR, and only then its own working directory, and
// `project_get` reports which of them supplied it as `cwdSource`. So the shared
// preflight calls `project_get` without `cwd`, and an agent passes `cwd` afterwards
// only when that report says `server` — the one source that is not where the user is
// working — or to target a different directory on purpose.
//
// `shared-prose-stays-identical` keeps every copy of the preflight the same; this
// keeps what that one text says right, and keeps the retired rule — pass `cwd` on
// every call — out of every skill document.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allSkills, repoRoot, toPosixPath } from './helpers.js';

const PREFLIGHT_LEAD = '**Available tools are not a configured project.**';

// The handoff target carries no preflight, and the planner calls no MCP tool.
const EXEMPT = ['formio-mcp-setup', 'formio-resource-planner'];

function preflightOf(path: string): string | undefined {
  return readFileSync(join(repoRoot, path), 'utf8')
    .split('\n')
    .find((line) => line.startsWith(PREFLIGHT_LEAD));
}

function markdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownUnder(full);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

// Each shape the retired rule took: "pass `cwd` … on every Form.io tool call", "pass
// that same cwd on every call", and the reason it gave, which is no longer true —
// an omitted cwd now resolves the client's workspace root first.
const RETIRED = [
  /\bcwd\b[^.\n]*\bon every\b[^.\n]*\bcall\b/i,
  /\bevery (Form\.io |project-scoped )?(tool )?call\b[^.\n]*\bcwd\b/i,
  /omitting (it|`?cwd`?) resolves against the MCP server/i,
];

describe('the shared preflight lets the client supply the directory', () => {
  const gated = allSkills().filter((skill) => !EXEMPT.includes(skill.directoryName));

  it('has gated skills to check', () => {
    expect(gated.length).toBeGreaterThan(1);
  });

  it.each(gated.map((skill) => skill.path))(
    '%s calls project_get without cwd and passes cwd only when cwdSource is server',
    (path) => {
      const preflight = preflightOf(path);

      expect(preflight, `${path} has no shared preflight paragraph`).toBeDefined();
      expect(preflight).toMatch(/`project_get`[^.]*without `cwd`/);
      expect(preflight).toMatch(/`cwdSource`[^.]*`server` or `claude-project-dir`[^.]*pass `cwd`/);
      expect(preflight).toMatch(/only[^.]*another directory|another directory[^.]*only/);
    }
  );
});

describe('no skill says to pass cwd on every call', () => {
  const documents = markdownUnder(join(repoRoot, 'plugin/skills')).map((full) =>
    toPosixPath(relative(repoRoot, full))
  );

  it('has skill documents to check', () => {
    expect(documents.length).toBeGreaterThan(10);
  });

  it.each(documents)('%s', (path) => {
    const text = readFileSync(join(repoRoot, path), 'utf8');
    const found = RETIRED.flatMap((pattern) => text.match(pattern)?.[0] ?? []);

    expect(found).toEqual([]);
  });
});
