// The ratchet. Every rule this change established is enforced here so it cannot
// silently rot back: no live instruction names a client-specific tool, slash
// command, plugin namespace, or configuration path.
//
// This catches regression, not novelty — a newly invented client-specific
// instruction still passes. The authoring rule is the standard; this is the
// backstop.

import { describe, expect, it } from 'vitest';
import {
  CLIENT_SPECIFIC_DOC_EXEMPTIONS,
  allSkillDocuments,
  liveSkillDocuments,
  skillDocument,
} from './helpers.js';

// Each entry matches text that only ever appears in an instruction one client
// can follow. Deliberately NOT on this list: the bare word "Claude" (naming a
// client tool as a parenthetical example is the sanctioned pattern), and the
// name `frontend-design` — that is a portable Agent Skill, so naming it is
// correct; only its Claude-specific install and reload commands are banned.
//
// The slash commands are matched as inline code rather than as bare substrings:
// "/mcp" is a substring of the package name `@formio/mcp`, which every skill
// legitimately names.
const DENYLIST: Array<[label: string, pattern: RegExp]> = [
  ['mcp__plugin_', /mcp__plugin_/],
  ['claude plugin install', /claude plugin install/],
  ['claude-plugins-official', /claude-plugins-official/],
  ['the /reload-plugins slash command', /`\/reload-plugins`|run \/reload-plugins/],
  ['the /mcp slash command', /`\/mcp`|run \/mcp\b/],
  ['restart Claude Code', /restart Claude Code/],
  ['Claude Code plugin', /Claude Code plugin/],
  ['-a claude-code', /-a claude-code/],
  ['the verify-project-url hook', /verify-project-url/],
  ['FORMIO_PLUGIN_CONTEXT', /FORMIO_PLUGIN_CONTEXT/],
];

describe('no live skill document names a client-specific mechanism', () => {
  it.each(DENYLIST)('none contains %s', (label, pattern) => {
    const offenders = liveSkillDocuments()
      .filter((doc) => pattern.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders, `${label} is an instruction only one client can follow`).toEqual([]);
  });

  it('none addresses Claude as the acting agent', () => {
    // "in Claude Code, `AskUserQuestion`" is fine. "Claude may not resolve the
    // name" is not — it tells one client's agent what it does.
    const asActor =
      /Claude(?! Code|\.ai)(?:'s)?\s+(?:may|will|should|must|can|cannot|does|activates|reads|loads|needs)/;
    const offenders = liveSkillDocuments()
      .filter((doc) => asActor.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('names a client question tool only inside a parenthetical example', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes('AskUserQuestion'))
      .filter((doc) => !/\(in Claude Code, `AskUserQuestion`\)/.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

describe('the exemption list is explicit, never a heuristic', () => {
  it('exempts the setup skill by path', () => {
    expect(CLIENT_SPECIFIC_DOC_EXEMPTIONS).toContain('plugin/skills/formio-mcp-setup/SKILL.md');
  });

  // Eval runbooks needed an exemption while they lived under plugin/. They no
  // longer do, so the rule holds without one — which is the stronger position.
  it('needs no exemption for eval runbooks, because none ship', () => {
    const runbooks = allSkillDocuments().filter((doc) => doc.path.includes('/evals/'));

    expect(runbooks).toEqual([]);
  });

  it('excludes every exempt path from the enforced set', () => {
    const live = new Set(liveSkillDocuments().map((doc) => doc.path));

    for (const exempt of CLIENT_SPECIFIC_DOC_EXEMPTIONS) {
      expect(live.has(exempt)).toBe(false);
    }
  });

  it('still enforces over the rest of the library', () => {
    const live = liveSkillDocuments();

    expect(live.length).toBeGreaterThan(20);
    expect(live.some((doc) => doc.path === 'plugin/skills/formio-application/SKILL.md')).toBe(true);
  });
});

describe('the sanctioned parenthetical pattern passes', () => {
  it('accepts a portable instruction that names a client tool as an example', () => {
    const sample =
      "Ask both questions in one round using the client's structured question mechanism (in Claude Code, `AskUserQuestion`).";

    for (const [, pattern] of DENYLIST) {
      expect(pattern.test(sample)).toBe(false);
    }
    expect(/\(in Claude Code, `AskUserQuestion`\)/.test(sample)).toBe(true);
  });
});

// Phase 2 plan item 1 was already delivered by formio-mcp-setup. This change
// verifies it rather than rewriting it, so the four-client table and the
// four-client reload list must both still be there.
describe('the setup skill still owns the per-client surface', () => {
  const setup = () => skillDocument('plugin/skills/formio-mcp-setup/SKILL.md').body;

  it.each([
    ['.mcp.json', 'mcpServers'],
    ['.cursor/mcp.json', 'mcpServers'],
    ['.vscode/mcp.json', 'servers'],
    ['.codex/config.toml', 'mcp_servers'],
  ])('documents %s with the %s key', (file, key) => {
    const body = setup();

    expect(body).toContain(file);
    expect(body).toContain(key);
  });

  it('lists the reload step for all four clients', () => {
    const body = setup();

    for (const client of ['Claude Code', 'Cursor', 'VS Code', 'Codex']) {
      expect(body).toContain(client);
    }
  });
});
