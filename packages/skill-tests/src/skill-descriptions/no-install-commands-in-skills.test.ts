// Only the setup skill hands out install commands.
//
// Every gated skill carried the same fallback quote for the case where the tools
// are absent AND `formio-mcp-setup` is not installed — a message telling the user
// to run `npx skills add formio/ai` and to configure `npx -y @formio/mcp@<version>`.
// Two problems with keeping it. It duplicates, in eleven places, instructions the
// setup skill owns and keeps current; and it is a runtime remote-code-execution
// instruction sitting in a document whose own rule is that the setup skill is the
// only remedy it offers. A skill that cannot reach its tools can say so and name
// where the install route is documented without carrying the commands itself.
//
// `formio-mcp-setup` is exempt: writing that configuration is its entire job.
// Angular's own scaffolding commands in BOOTSTRAP.md are a different subject —
// they install Angular, not this server — and are not covered here.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

function allMarkdown(): string[] {
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
    });
  return collect(skillsRoot);
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function nonSetupDocs(): string[] {
  return allMarkdown().filter((path) => !path.includes('/formio-mcp-setup/'));
}

function offenders(paths: string[], predicate: (text: string) => boolean): string[] {
  return paths.filter((path) => predicate(read(path))).map((path) => relative(repoRoot, path));
}

describe('no skill but the setup skill carries a Form.io install command', () => {
  it('none tells the user to run the skills installer', () => {
    expect(offenders(nonSetupDocs(), (text) => /npx skills add formio\/ai/.test(text))).toEqual([]);
  });

  it('none spells a runnable launch of the MCP server', () => {
    expect(
      offenders(nonSetupDocs(), (text) =>
        /(npx|npm exec|npm x|pnpm dlx|yarn dlx|bunx)[^\n]*@formio\/mcp/.test(text)
      )
    ).toEqual([]);
  });

  it('none carries the old fallback quote', () => {
    expect(
      offenders(nonSetupDocs(), (text) =>
        /`formio-mcp-setup` skill that would connect it is not installed/.test(text)
      )
    ).toEqual([]);
  });

  // The setup skill still has them — it is the document whose job is writing that
  // configuration, and emptying it would leave the library with no install route
  // at all.
  it('the setup skill still documents the install route', () => {
    const setup = read(join(skillsRoot, 'formio-mcp-setup/SKILL.md'));

    expect(setup).toMatch(/@formio\/mcp/);
    expect(setup).toMatch(/npx/);
  });
});

// The fallback quote this once guarded — what to say when the tools are absent AND
// `formio-mcp-setup` is not installed either — is gone. `npx skills add formio/ai`
// installs the library as a unit, so a gated skill that is present never has the setup
// skill missing beside it, and eleven copies of a message for that state cost more
// attention than the state was worth.
describe('the replacement still tells the user what to do', () => {
  const gatedSkillMd = () =>
    allMarkdown().filter(
      (path) => path.endsWith('SKILL.md') && !path.includes('/formio-mcp-setup/')
    );

  it('covers the eleven gated skills', () => {
    expect(gatedSkillMd()).toHaveLength(11);
  });

  it('each still routes to the setup skill first', () => {
    expect(offenders(gatedSkillMd(), (text) => !/formio-mcp-setup/.test(text))).toEqual([]);
  });
});
