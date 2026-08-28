// What the preflight is allowed to BLOCK.
//
// The gate exists to stop an agent hand-rolling HTTP against a live deployment.
// It was written as the first section of every skill and phrased absolutely —
// "stop and connect the server before doing anything else" — so an agent read it
// at activation and answered a "build me a CRM" request with a blocked-on-setup
// message before it had heard the idea. Understanding a request, planning a
// resource map, and writing template.md / template.json touch no deployment and
// need no server; the gate belongs at the first tool call, not at activation.
//
// The same run produced the other half of this file: told the tools were absent,
// the agent invented a remedy — "run /mcp, pick the Form.io server, authorize" —
// for a server no step had configured, and reported an "installed but not
// authenticated" state that does not exist in this design. The setup skill is the
// only remedy, and authentication is implicit.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

function walk(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, name);
    return entry.isFile() && entry.name === name ? [full] : [];
  });
}

function allMarkdown(): string[] {
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
    });
  return collect(skillsRoot);
}

// formio-mcp-setup is the remedy, not a holder of the gate: it runs precisely
// when no tools exist, and it is the one skill allowed to give install and
// reload instructions.
function gatedSkillMd(): string[] {
  return walk(skillsRoot, 'SKILL.md').filter((path) => !path.includes('/formio-mcp-setup/'));
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function offenders(paths: string[], predicate: (text: string) => boolean): string[] {
  return paths.filter((path) => predicate(read(path))).map((path) => relative(repoRoot, path));
}

describe('the preflight blocks the tool call, not the turn', () => {
  it('covers the eleven gated skills', () => {
    expect(gatedSkillMd()).toHaveLength(11);
  });

  it('carries no instruction to stop before doing anything else', () => {
    expect(offenders(allMarkdown(), (text) => /before doing anything else/i.test(text))).toEqual(
      []
    );
  });

  it('says the check happens at the first tool call rather than at activation', () => {
    expect(
      offenders(
        gatedSkillMd(),
        (text) => !/not when this skill activates|not when this skill is activated/i.test(text)
      )
    ).toEqual([]);
  });

  it('tells the agent to finish the work that needs no server first', () => {
    expect(offenders(gatedSkillMd(), (text) => !/needs? no server/i.test(text))).toEqual([]);
  });
});

describe('the preflight offers one remedy and invents none', () => {
  it('names formio-mcp-setup as the only remedy', () => {
    expect(
      offenders(
        gatedSkillMd(),
        (text) => !/formio-mcp-setup/.test(text) || !/only remedy/i.test(text)
      )
    ).toEqual([]);
  });

  // The invented instruction from the failing run was a client slash command plus
  // "authorize in the browser". Both are banned by name — generically, because
  // agent-neutral-prose.test.ts forbids these documents from spelling any one
  // client's command, even inside a prohibition.
  it('forbids inventing a client-specific setup or authorization step', () => {
    expect(
      offenders(
        gatedSkillMd(),
        (text) => !/no slash command/i.test(text) || !/authorize in the browser/i.test(text)
      )
    ).toEqual([]);
  });

  it('rules out reporting a server as present but unauthenticated', () => {
    expect(
      offenders(gatedSkillMd(), (text) => !/installed but not authenticated/i.test(text))
    ).toEqual([]);
  });

  // A Form.io-branded MCP entry that exposes only connection/authentication tools
  // is what the agent mistook for this server. The check is the named tools.
  it('states that a Form.io-branded server without these tools is not this server', () => {
    expect(offenders(gatedSkillMd(), (text) => !/is not this server/i.test(text))).toEqual([]);
  });

  it('keeps authentication implicit rather than a step to announce', () => {
    expect(offenders(gatedSkillMd(), (text) => !/pre-announce authentication/i.test(text))).toEqual(
      []
    );
  });
});

describe('the orchestrator resolves the project when it writes, not before', () => {
  const orchestrator = () => read(join(skillsRoot, 'formio-application/SKILL.md'));
  const intent = () => read(join(skillsRoot, 'formio-application/INTENT.md'));

  it('no longer claims the configuration is settled before Step 1', () => {
    for (const text of [orchestrator(), intent()]) {
      expect(text).not.toMatch(/settles it before Step 1/i);
      expect(text).not.toMatch(/already resolved by this point/i);
    }
  });

  it('names Step 3 as where the project is resolved', () => {
    expect(orchestrator()).toMatch(/Step 3[^\n]*project_get|project_get[^\n]*Step 3/);
  });

  it('says Steps 1 and 2 run with no server', () => {
    expect(orchestrator()).toMatch(/Steps? 1 and 2[^\n]*no server|no server[^\n]*Steps? 1 and 2/i);
  });
});

describe('the planner states that planning needs no server at all', () => {
  it('says so in the skill that calls no MCP tool', () => {
    const planner = read(join(skillsRoot, 'formio-resource-planner/SKILL.md'));

    expect(planner).toMatch(/calls? no Form\.io tool|no MCP tool/i);
    expect(planner).toMatch(/needs no server/i);
  });
});
