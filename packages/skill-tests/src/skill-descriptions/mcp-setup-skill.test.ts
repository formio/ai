// The `formio-mcp-setup` skill and the preflight contract every other skill
// carries.
//
// A skills-only install (`npx skills add formio/ai`) delivers no MCP server —
// the string `mcp` does not appear anywhere in that CLI. The skills therefore
// have to connect it themselves: each one checks for the tools before its first
// call, and hands off to `formio-mcp-setup` when they are missing.
//
// The load-bearing rule is the raw-HTTP prohibition. `formio-api` documents the
// whole Form.io REST surface, so an agent with no tools and no prohibition will
// hand-roll requests against a live deployment — worse than stopping.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_BUDGET, allSkills } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');
const setupSkillDir = join(skillsRoot, 'formio-mcp-setup');
const setupSkillMd = join(setupSkillDir, 'SKILL.md');
const descriptionSnapshot = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/descriptions-before-preflight.json'
);

function body(path: string): string {
  return readFileSync(path, 'utf8').replace(/^---\n[\s\S]*?\n---/, '');
}

function skillMdPaths(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && entry.name === 'SKILL.md' ? [full] : [];
    });
  return walk(skillsRoot);
}

describe('formio-mcp-setup skill', () => {
  it('exists in a directory named after itself', () => {
    expect(existsSync(setupSkillMd)).toBe(true);
    expect(readFileSync(setupSkillMd, 'utf8')).toMatch(/^name: formio-mcp-setup$/m);
  });

  it('triggers on a missing server, an explicit install request, and a preflight handoff', () => {
    const description =
      allSkills().find((skill) => skill.frontmatter.name === 'formio-mcp-setup')?.description ?? '';

    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    expect(description).toMatch(/MCP server/i);
    expect(description.toLowerCase()).toMatch(/install|connect|configure/);
    expect(description.toLowerCase()).toMatch(
      /missing|not available|unavailable|no form\.io tools/
    );
    expect(description).toContain('Not for');
  });

  // The too-old branch tells the agent to edit the pin in "the file your client
  // reads" — which does not exist for a plugin install, where the pin belongs to
  // the plugin. The missing-server branch already handles that case; without the
  // same answer here an agent hunts for an `mcpServers` entry nothing wrote, and
  // writing one leaves two servers configured.
  it('answers the too-old case for a plugin install as well as a file', () => {
    const text = body(setupSkillMd);
    const branch = text.slice(
      text.indexOf('### Already connected, but too old'),
      text.indexOf('## Step 2')
    );

    expect(branch.length).toBeGreaterThan(0);
    expect(branch).toMatch(/marketplace/i);
    expect(branch).toMatch(/update the plugin/i);
  });

  // The remedy "change the pin to the one the Step 2 blocks carry" is circular in
  // the window this branch was written for. `sync:pins` restamps those blocks only
  // at release, and skills install straight off the default branch, so between
  // merging a tool and publishing it the blocks name the very release that lacks
  // it — and the user is told to upgrade to what they already run, forever. The
  // branch has to compare the two and say what to do when they match.
  it('does not send a matching pin round the upgrade loop', () => {
    const text = body(setupSkillMd);
    const branch = text.slice(
      text.indexOf('### Already connected, but too old'),
      text.indexOf('## Step 2')
    );

    expect(branch.length).toBeGreaterThan(0);
    // Compare before editing.
    expect(branch).toMatch(/already (?:names|carries)|same version|matches the (?:pin|version)/i);
    // And name the state the comparison can find: the release is not out yet.
    expect(branch).toMatch(
      /not (?:yet )?(?:been )?published|no published release|not published yet/i
    );
    // Editing a pin to itself is the outcome this branch must forbid.
    expect(branch).toMatch(/do not edit|nothing to edit|no edit/i);
  });

  // Every client reads a different file, and two do not use `mcpServers` at all.
  // All four stay documented, because the fallback still writes them all.
  it('documents all four client configurations with the right shape', () => {
    const text = body(setupSkillMd);

    expect(text).toContain('.mcp.json');
    expect(text).toContain('.cursor/mcp.json');
    expect(text).toContain('.vscode/mcp.json');
    expect(text).toContain('.codex/config.toml');
    expect(text).toContain('mcpServers');
    expect(text).toMatch(/"servers"/);
    expect(text).toMatch(/\[mcp_servers\.formio-mcp\]/);
  });

  // Writing four files for three clients the user does not run is noise the
  // agent can avoid: it knows which product it is. Detection is by self-
  // identity, then one question, and only then the write-everything fallback.
  it("writes the running client's file first, with all four as the fallback", () => {
    const text = body(setupSkillMd);

    expect(text).toMatch(/client you are running|running client|which client you are/i);
    // The fallback is explicit, and it is the last resort rather than the default.
    expect(text).toMatch(/cannot determine|cannot tell|not sure|unclear/i);
    expect(text).toMatch(/inert/);
    // Stale directories are not evidence of the running host.
    expect(text).toMatch(/\.vscode\/|\.cursor\//);
    // The old rule must be gone: it forbade the detection this step now requires.
    expect(text).not.toMatch(/Do not try to work out which client/i);
  });

  it('launches the published server and hard-codes no configuration', () => {
    const text = body(setupSkillMd);

    expect(text).toContain('@formio/mcp');
    expect(text).toMatch(/npx/);
    // No project URL, base URL, or key baked into what it writes.
    const fenced = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
      .map((match) => match[1])
      .join('\n');
    expect(fenced).not.toMatch(/FORMIO_API_KEY\s*[:=]/);
    expect(fenced).not.toMatch(/https:\/\/[a-z0-9.-]*form\.io/i);
  });

  it('writes only workspace-relative paths', () => {
    const text = body(setupSkillMd);

    expect(text).not.toMatch(/~\/\.(codex|cursor|claude)/);
    expect(text).not.toMatch(/\$HOME/);
  });

  it('gates on approval, names every reload step, and hands control back', () => {
    const text = body(setupSkillMd).toLowerCase();

    expect(text).toMatch(/approv/);
    for (const client of ['claude', 'cursor', 'vs code', 'codex']) {
      expect(text, `reload guidance for ${client}`).toContain(client);
    }
    expect(text).toMatch(/restart|reload|reconnect/);
    expect(text).toMatch(/re-?ask|re-?issue|ask again|repeat your request/);
  });

  it('offers a path where npx cannot reach the registry', () => {
    const text = body(setupSkillMd).toLowerCase();

    expect(text).toMatch(/offline|air-?gapped|cannot reach|no network|blocked/);
    expect(text).toMatch(/global install|npm install -g|\.mcpb/);
  });
});

describe('preflight contract', () => {
  it('is present in every other skill body', () => {
    const missing = skillMdPaths()
      .filter((path) => path !== setupSkillMd)
      .filter((path) => {
        const text = body(path);
        return !(
          text.includes('form_list') &&
          text.includes('formio-mcp-setup') &&
          /preflight/i.test(text)
        );
      });

    expect(missing.map((path) => relative(repoRoot, path))).toEqual([]);
  });

  it('forbids working around missing tools with raw HTTP', () => {
    const offenders = skillMdPaths()
      .filter((path) => path !== setupSkillMd)
      .filter((path) => !/\bHTTP\b/i.test(body(path).split(/^## /m)[0] + body(path)));

    expect(offenders.map((path) => relative(repoRoot, path))).toEqual([]);
  });

  it('does not tell the setup skill to load itself', () => {
    const preflight = body(setupSkillMd);

    expect(preflight).not.toMatch(/load the `formio-mcp-setup` skill/i);
  });

  // The preflight belongs in bodies. Frontmatter is bound by the 1,024-character
  // budget and by trigger-collision guards, so it must not move.
  //
  // The fixture is a deliberate snapshot, not an immutable law: when a change
  // means to edit a description, it updates the fixture and says why. Three
  // entries have moved since the snapshot was taken — formio-application dropped
  // the sentence promising a `.mcp.json` write and a Claude Code restart, because
  // the step that did that is gone; formio-sdk dropped `Formio.builder` from its
  // rendering clause, because the library no longer documents the form builder;
  // and formio-mcp-setup now says it asks the server which project the directory
  // resolves to and captures only the URL it reports missing, rather than offering
  // to capture both, because the server owns that wording and the step probes
  // before it asks.
  //
  // formio-application has moved once more: its `Not for:` clause now names
  // `formio-react` and `formio-react-resources`, because React is a second
  // framework row in FRAMEWORK.md's registry and framework-explicit React
  // phrasing must route past the orchestrator the way Angular's already does.
  //
  // formio-form has moved too: its `Not for:` clause now names `formio-react`,
  // because React-named embedding has its own sub-skill, and its Angular clause
  // was shortened to keep the description inside the 1,024-character budget.
  //
  // formio-angular and formio-form moved again when Angular gained an embedding
  // sub-skill: the Angular parent became a two-branch router and claims Angular-named
  // embed triggers, and formio-form's Angular clause turned from "no such skill
  // exists" into a handoff. Both fixture entries were re-snapshotted with those
  // descriptions, which is what a deliberate change looks like here.
  //
  // formio-mcp-setup was ADDED to the fixture by that same change. It postdated
  // the original snapshot, so nothing was pinning the one description most likely
  // to drift as the setup flow changed. It has since moved again: the skill writes
  // the configuration for the client it is running in rather than all four in one
  // pass, and the description says so, because the write-everything path is now a
  // fallback rather than the promise.
  it('left every existing description byte-identical', () => {
    const before = JSON.parse(readFileSync(descriptionSnapshot, 'utf8')) as Record<string, string>;
    const now = Object.fromEntries(
      allSkills().map((skill) => [
        relative(skillsRoot, join(repoRoot, skill.path)),
        skill.description,
      ])
    );

    for (const [path, description] of Object.entries(before)) {
      expect(now[path], `${path} description changed`).toBe(description);
    }
  });
});
