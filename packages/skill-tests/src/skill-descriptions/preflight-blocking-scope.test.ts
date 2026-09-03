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
// for a server no step had configured. The setup skill is the only remedy.
//
// The rules that spelled out what NOT to report ("installed but not authenticated",
// no slash command, no authorize-in-the-browser, never pre-announce authentication)
// were deleted with the prose they guarded. This server lists every tool before it
// authenticates, so there is no installed-but-unauthenticated state for a skill to
// describe, and eleven copies of the description cost more attention than they bought.

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
  it('covers the fourteen gated skills', () => {
    expect(gatedSkillMd()).toHaveLength(14);
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

  // The check names ONE CONCRETE TOOL rather than "the Form.io tools". An abstract check
  // invites an agent to reason about whether the tools are present but not yet usable,
  // and no such state exists here: measured against the built server over stdio with a
  // clean HOME, `tools/list` returns all 21 tools, `form_list` among them, before any
  // authentication and without writing a token cache. Auth moved off startup in
  // `lazy-auth-on-first-tool-call` and fires at the first API call. So `form_list` is
  // callable exactly when this server is connected, and the check needs nothing else.
  it('names form_list as the check', () => {
    expect(
      offenders(gatedSkillMd(), (text) => !/`form_list` is callable by you/.test(text))
    ).toEqual([]);
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
