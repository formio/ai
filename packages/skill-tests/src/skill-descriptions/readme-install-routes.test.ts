// The README's install story.
//
// Two routes, and they are alternatives rather than steps: a plugin install for
// clients with a marketplace (skills plus MCP plus an install-time prompt), and
// the skills CLI for everything else (skills only, with `formio-mcp-setup`
// connecting the server on first use). Nothing is hosted beyond the GitHub
// repository in either case.
//
// The one thing the README must never do again is imply a single MCP config file
// works everywhere: Codex is TOML-only, and VS Code uses a `servers` key.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const readme = () => readFileSync(join(repoRoot, 'README.md'), 'utf8');
const llmsInstall = () => readFileSync(join(repoRoot, 'llms-install.md'), 'utf8');
const contributing = () => readFileSync(join(repoRoot, 'CONTRIBUTING.md'), 'utf8');

function gettingStarted(): string {
  const text = readme();
  const start = text.indexOf('## Getting Started');
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end === -1 ? undefined : end);
}

describe('README quickstart', () => {
  it('leads with the one command that works in any skills-capable agent', () => {
    expect(gettingStarted()).toContain('npx skills add formio/ai');
  });

  it('does not ask the reader to hand-write an MCP configuration file', () => {
    const section = gettingStarted();

    expect(section).not.toMatch(/create (a )?`?\.mcp\.json/i);
    expect(section).not.toMatch(/echo .* > \.mcp\.json/);
  });

  it('names the skill that connects the server on first use', () => {
    expect(gettingStarted()).toContain('formio-mcp-setup');
  });
});

describe('README install matrix', () => {
  it('has a row for every client that has a marketplace', () => {
    const text = readme();

    for (const client of ['Claude Code', 'Cursor', 'Copilot', 'VS Code', 'Codex']) {
      expect(text, `install matrix must cover ${client}`).toContain(client);
    }
    expect(text).toContain('/plugin install formio-ai@formio');
  });

  // A marketplace whose install has not been verified end to end says so rather
  // than naming a command: publishing an unverified recipe costs the reader more
  // than an honest gap does. Every such row must carry one or the other.
  it('either names the install command or marks the route as not live yet', () => {
    const rows = readme()
      .split('\n')
      .filter((line) => /^\| (Cursor|GitHub Copilot CLI|VS Code|Codex)/.test(line));

    expect(rows, 'one matrix row per marketplace client').toHaveLength(4);
    for (const row of rows) {
      expect(row, row).toMatch(/`[^`]+`|coming soon/i);
    }
  });

  it('presents the two routes as alternatives, not steps', () => {
    const text = readme();

    expect(text).toMatch(/already includes|no need to|either route|alternative/i);
  });

  it('states that the skills CLI installs skills only', () => {
    const text = readme();

    expect(text).toMatch(/skills only|does not (itself )?configure|no MCP server/i);
  });

  it('still documents that there is no universal MCP config file', () => {
    expect(readme()).toContain('no universal `.mcp.json`');
  });
});

describe('agent-facing and contributor docs', () => {
  it('llms-install.md points an installing agent at the setup skill', () => {
    expect(llmsInstall()).toContain('formio-mcp-setup');
  });

  it('llms-install.md names the universal skills directory', () => {
    expect(llmsInstall()).toContain('.agents/skills');
  });

  it('CONTRIBUTING.md explains that the OpenSpec skill mirrors are generated', () => {
    const text = contributing();

    expect(text).toMatch(/\.claude\/skills\/openspec|generated.*mirror|openspec.*generated/i);
    expect(text).toMatch(/openspec/i);
  });
});
