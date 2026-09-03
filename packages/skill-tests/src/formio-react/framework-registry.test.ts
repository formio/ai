// FRAMEWORK.md's registry gains a React row, which makes the multi-framework
// branch the live build-new path. These tests hold the routing rules that
// branch depends on — including the ones that were self-cancelling before.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const frameworkMd = join(repoRoot, 'plugin/skills/formio-application/FRAMEWORK.md');
const applicationSkillMd = join(repoRoot, 'plugin/skills/formio-application/SKILL.md');

const framework = () => readFileSync(frameworkMd, 'utf8');

function registryRows(): string[] {
  return framework()
    .split('\n')
    .filter((line) => line.startsWith('| ') && line.includes('formio-'))
    .filter((line) => !line.includes('| --- |'));
}

describe('the registry carries a React row', () => {
  it('names the entry skill and the nested extend sub-skill', () => {
    const react = registryRows().find((row) => row.startsWith('| React '));
    expect(react, 'a React row must exist').toBeDefined();
    expect(react).toContain('`formio-react`');
    expect(react).toContain('formio-react/formio-react-resources/SKILL.md');
  });

  it('detects React by its own dependency alone', () => {
    const react = registryRows().find((row) => row.startsWith('| React '));
    expect(react).toContain('`react` listed in `package.json` dependencies');
  });

  // A signal that excludes another framework makes the multi-match branch below
  // unreachable: a workspace with both would match exactly one row and route
  // silently, which is the behaviour the tie-break exists to prevent.
  it('has no signal that excludes another framework', () => {
    for (const row of registryRows()) {
      expect(row).not.toMatch(/AND no `?angular\.json/i);
      expect(row).not.toMatch(/AND no `?react/i);
    }
    expect(framework()).toContain("only for its own framework's presence");
  });
});

describe('exactly one row is the default', () => {
  it('marks Angular as the default and nothing else', () => {
    const defaults = registryRows().filter((row) => /\|\s*yes\s*\|?\s*$/.test(row));
    expect(defaults).toHaveLength(1);
    expect(defaults[0]).toMatch(/^\| Angular /);
  });

  it('has a Default column in the header and separator', () => {
    const lines = framework().split('\n');
    const header = lines.findIndex((line) => line.includes('| Detection signal | Default |'));
    expect(header).toBeGreaterThan(-1);
    // A separator missing the extra column renders the table wrong.
    expect(lines[header + 1].split('|').filter((cell) => cell.trim()).length).toBe(5);
  });
});

describe('build-new asks, and the default only resolves a declined choice', () => {
  it('presents the default row first, labelled', () => {
    const text = framework();
    expect(text).toContain('`Default: yes` row first');
    expect(text.toLowerCase()).toContain('label it the default');
  });

  it('describes each option by what it generates', () => {
    const text = framework();
    expect(text).toContain('Generate an Angular workspace using `@formio/angular`');
    expect(text).toContain('Generate a Vite + React Router workspace using `@formio/react`');
  });

  it('states the default is not a licence to skip asking', () => {
    expect(framework()).toContain('NOT a licence to skip asking');
  });

  it('states which framework it proceeded with when the default resolves', () => {
    expect(framework().toLowerCase()).toContain('say which framework you are proceeding with');
  });

  it('skips the round when the request already named a framework', () => {
    expect(framework().toLowerCase()).toContain('has already answered');
  });
});

describe('modify-existing detects rather than asking a preference', () => {
  it('asks only on a genuine multi-match, never by row order', () => {
    const text = framework();
    expect(text).toContain('both `angular.json` and a `react` dependency');
    expect(text.toLowerCase()).toContain('never resolve a multi-match by the table');
  });

  it('scopes the preference question to build-new', () => {
    expect(framework()).toContain('framework-preference question belongs to build-new only');
  });
});

describe('the how-to-add example does not name a live framework', () => {
  it('uses Vue as the placeholder', () => {
    const text = framework();
    const howTo = text.slice(text.indexOf('## How to add a new framework'));
    expect(howTo).toContain('| Vue | formio-vue |');
    expect(howTo).not.toContain('| React | formio-react |');
  });

  it('carries no second React detection signal', () => {
    expect(framework()).not.toContain('vite.config.* with react deps');
    expect(framework()).not.toContain('next.config.*');
  });
});

describe('the extend payload names each framework own config path', () => {
  it('does not assume the Angular path for every framework', () => {
    const text = framework();
    expect(text).toContain('`src/config.ts` for React');
    expect(text).toContain('`src/app/config.ts` for Angular');
  });
});

describe('formio-application description', () => {
  const description = () => {
    const text = readFileSync(applicationSkillMd, 'utf8');
    const start = text.indexOf('description: >-') + 'description: >-'.length;
    return text.slice(start, text.indexOf('\n---', start)).replace(/\s+/g, ' ').trim();
  };

  it('names the React skills in its Not for clause', () => {
    expect(description()).toContain('formio-react');
    expect(description()).toContain('formio-react-resources');
  });

  it('still fits the budget', () => {
    expect(description().length).toBeLessThanOrEqual(1024);
  });

  // The repository retired the MCP-configuration step; two shipped suites fail
  // any live document that mentions it.
  it('names no MCP-configuration step or restart pause', () => {
    expect(description()).not.toContain('.mcp.json');
    expect(description().toLowerCase()).not.toContain('restart claude code');
  });
});
