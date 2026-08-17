// The orchestrator's MCP-configuration step is gone: writing
// env.FORMIO_PROJECT_URL into a client config pins the server and defeats the
// project_set call the step before it makes. What remains is a five-step flow
// with no restart boundary on either branch.

import { describe, expect, it } from 'vitest';
import { liveSkillDocuments, skillDocument, skillDocumentExists } from './helpers.js';

// Some strings here are also covered by the general ratchet in
// agent-neutral-prose.test.ts. That suite owns the library-wide rule; this one
// asserts the specific rewrite, so a failure here names the concrete contract
// that broke rather than just "a banned string appeared somewhere".

const APPLICATION = 'plugin/skills/formio-application';
const SKILL_MD = `${APPLICATION}/SKILL.md`;
const MCP_CONFIG_MD = `${APPLICATION}/MCP_CONFIG.md`;

const CLIENT_CONFIG_PATHS = ['.mcp.json', '.cursor/mcp.json', '.vscode/mcp.json'];

describe('MCP configuration is not written by any skill', () => {
  it.each(CLIENT_CONFIG_PATHS)('no live document instructs writing %s', (configPath) => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes(configPath))
      .map((doc) => doc.path);

    expect(offenders, `${configPath} must only appear in formio-mcp-setup`).toEqual([]);
  });

  it('no live document names the Codex configuration file', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes('config.toml'))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('MCP_CONFIG.md is deleted', () => {
    expect(skillDocumentExists(MCP_CONFIG_MD)).toBe(false);
  });

  it('nothing links to MCP_CONFIG.md', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes('MCP_CONFIG'))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

describe('no skill halts for an MCP reload', () => {
  // Only instructions to reload are banned. "No restart boundary" is prose
  // stating the opposite, and formio-mcp-setup's reload list is exempt by path.
  const RELOAD_INSTRUCTIONS = ['restart Claude Code', '/reload-plugins', 'restart the session'];

  it.each(RELOAD_INSTRUCTIONS)('no live document instructs "%s"', (phrase) => {
    const offenders = liveSkillDocuments()
      .filter((doc) => doc.body.includes(phrase))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });
});

describe('formio-application orchestration', () => {
  it('enumerates exactly five steps', () => {
    const { body } = skillDocument(SKILL_MD);
    const stepHeadings = [...body.matchAll(/^### Step (\d[\w.]*) — (.+)$/gm)].map((match) => ({
      number: match[1],
      title: match[2],
    }));

    expect(stepHeadings.map((step) => `${step.number} ${step.title}`)).toEqual([
      '1 Intent',
      '2 Plan',
      // Both branches: modify-existing skips the interview, not the mapping.
      '3 Deployment',
      '4 Import',
      '4.5 Auth handoff (conditional)',
      '5 Framework routing',
    ]);
  });

  it('links only the four surviving sibling documents', () => {
    const { body } = skillDocument(SKILL_MD);
    const linked = new Set([...body.matchAll(/\(\.\/([A-Z_]+\.md)\)/g)].map((match) => match[1]));

    expect([...linked].sort()).toEqual(['DEPLOYMENT.md', 'FRAMEWORK.md', 'IMPORT.md', 'INTENT.md']);
  });

  it('states that Deployment and Import run in one invocation, resolved at tool-call time', () => {
    const { body } = skillDocument(SKILL_MD);

    expect(body).toMatch(/same invocation/i);
    expect(body).toMatch(/tool-call time/);
    expect(body).not.toMatch(/halt/i);
  });

  it('routes a failed tool probe to formio-mcp-setup and writes nothing itself', () => {
    const { body } = skillDocument(SKILL_MD);

    expect(body).toContain('formio-mcp-setup');
    expect(body).toMatch(/writes no MCP configuration|does not write MCP configuration/i);
  });

  it('has no plugin-mode branch', () => {
    const { body } = skillDocument(SKILL_MD);

    expect(body).not.toMatch(/plugin mode/i);
  });
});

// Deleting the MCP-configuration step renumbers everything after Deployment.
// A gap ("Step 3, then Step 5") reads as a document with a missing section.
//
// Scope matters: BOOTSTRAP.md runs its own independent phase numbering that has
// nothing to do with the orchestrator, so the ban covers the orchestrator's own
// documents plus any cross-reference that names formio-application explicitly.
describe('step numbering after the deletion', () => {
  const RETIRED_REFERENCES = ['Step 6', 'Step 5.5', 'Step 5 (Import)', 'Steps 5–6', 'Steps 2–5'];

  const orchestratorDocuments = () =>
    liveSkillDocuments().filter((doc) => doc.path.startsWith(APPLICATION));

  it.each(RETIRED_REFERENCES)('no orchestrator document references "%s"', (phrase) => {
    const offenders = orchestratorDocuments()
      .filter((doc) => doc.body.includes(phrase))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('no document sends a reader to a retired formio-application step', () => {
    const offenders = liveSkillDocuments()
      .filter((doc) => /formio-application[^.]{0,20}Step 6/.test(doc.body))
      .map((doc) => doc.path);

    expect(offenders).toEqual([]);
  });

  it('IMPORT.md is Step 4 and hands off to Step 5', () => {
    const { body } = skillDocument(`${APPLICATION}/IMPORT.md`);

    expect(body).toMatch(/during Step 4/);
    expect(body).toMatch(/What Step 4 hands to Step 5/);
  });

  it('FRAMEWORK.md identifies itself as Step 5 with a Step 5a pre-check', () => {
    const { body } = skillDocument(`${APPLICATION}/FRAMEWORK.md`);

    expect(body).toMatch(/Step 5a/);
    expect(body).not.toMatch(/Step 6a|Step 6\b/);
  });
});
