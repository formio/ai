// Getting the two URLs does not require the MCP server.
//
// The server owns project RESOLUTION — the mapping, the precedence, the writes to
// ~/.formio/projects.json — and every skill that calls a tool delegates to it. But
// a document that writes `FormioAppConfig` or `Formio.setProjectUrl(...)` needs
// only the two VALUES, and needs them to configure the application being built,
// not to reach a deployment. Requiring an MCP install for that is a gate on work
// that touches nothing.
//
// So these documents take one of two paths, chosen on whether the tools are
// callable: ask the server, or ask the user. Both apply the same rules, which
// means the rules have to exist somewhere readable with no server present — one
// canonical document, and no second copy anywhere else.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

const CANONICAL = 'formio-mcp-setup/references/project-urls.md';

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

function canonical(): string {
  return read(join(skillsRoot, CANONICAL));
}

// Every document that puts one of these values into a file the user keeps — a
// generated config.ts, an SDK bootstrap call, an auth example. These are the
// documents that need a no-server path.
function consumingDocs(): string[] {
  return allMarkdown().filter((path) => {
    if (path.endsWith(CANONICAL)) return false;
    const text = read(path);
    return (
      /Where these two values come from/.test(text) ||
      /`FormioAppConfig` renames both URLs/.test(text)
    );
  });
}

function offenders(paths: string[], predicate: (text: string) => boolean): string[] {
  return paths.filter((path) => predicate(read(path))).map((path) => relative(repoRoot, path));
}

describe('the canonical URL-values document', () => {
  it('exists', () => {
    expect(existsSync(join(skillsRoot, CANONICAL))).toBe(true);
  });

  it('states that the server is not required just to learn these two values', () => {
    expect(canonical()).toMatch(/do not install the (Form\.io )?MCP server (just )?to/i);
  });

  it('gives both paths and names the tools on the server path', () => {
    const text = canonical();

    expect(text).toMatch(/project_get/);
    expect(text).toMatch(/project_set/);
    expect(text).toMatch(/ask the user/i);
  });

  it('documents the aliases both values travel under', () => {
    const text = canonical();

    expect(text).toMatch(/`appUrl`[^\n]*`projectUrl`|`projectUrl`[^\n]*`appUrl`/);
    expect(text).toMatch(/`apiUrl`[^\n]*`baseUrl`|`baseUrl`[^\n]*`apiUrl`/);
  });

  // With no server present its messages cannot carry these, so the interview has
  // to. All three project-URL shapes, and the one shape whose base URL cannot be
  // derived — the only case where a second question is asked.
  it('carries the shape and derivation rules the interview applies', () => {
    const text = canonical();

    expect(text).toMatch(/https:\/\/examples\.form\.io|https:\/\/[a-z]+\.form\.io/);
    expect(text).toMatch(/https:\/\/forms\.mysite\.com\/myproject/);
    expect(text).toMatch(/https:\/\/myproject\.mysite\.com/);
    expect(text).toMatch(/https:\/\/api\.form\.io/);
    expect(text).toMatch(/cannot be derived|could not be derived/i);
  });

  it('keeps the rules that hold whichever path was taken', () => {
    const text = canonical();

    expect(text).toMatch(/never build a Project URL by appending/i);
    expect(text).toMatch(/never edit `?~\/\.formio\/projects\.json/i);
  });
});

describe('every document that writes a URL value offers both paths', () => {
  it('finds the consuming documents at all', () => {
    expect(consumingDocs().length).toBeGreaterThanOrEqual(12);
  });

  it('links to the canonical document', () => {
    expect(offenders(consumingDocs(), (text) => !text.includes('project-urls.md'))).toEqual([]);
  });

  it('names the server path and the no-server path', () => {
    expect(
      offenders(consumingDocs(), (text) => !/project_get/.test(text) || !/ask the user/i.test(text))
    ).toEqual([]);
  });

  // The regression this whole change is against: a document that says "take these
  // from the server" and stops has told an agent with no server to install one.
  it('never makes the MCP server a precondition for the values', () => {
    expect(
      offenders(consumingDocs(), (text) =>
        /take both URLs from the MCP server rather than typing them/.test(text)
      )
    ).toEqual([]);
  });
});

// The Angular resolver phase is the highest-traffic consumer: what it resolves
// goes straight into the generated src/app/config.ts. It was Path A only, under a
// heading that read "Ask the server, do not interview" — correct when a server is
// connected, and a dead end for a skills-only install building an app that needs
// no tool call until something is imported.
describe('the Angular resolver phase has a no-server path', () => {
  const setup = () => read(join(skillsRoot, 'formio-angular/SETUP.md'));

  it('no longer forbids interviewing outright', () => {
    expect(setup()).not.toMatch(/Ask the server, do not interview/);
  });

  it('offers both paths and links to the canonical rules', () => {
    const text = setup();

    expect(text).toMatch(/project_get/);
    expect(text).toMatch(/ask the user/i);
    expect(text).toContain('project-urls.md');
  });

  // Two different failures that used to share one remedy: no Form.io tools at all
  // is the interview path, while tools present without project_get is a server too
  // old to answer, which the setup skill repairs.
  it('separates "no server" from "a server too old to answer"', () => {
    const text = setup();

    expect(text).toMatch(/predates|too old/i);
    expect(text).toMatch(/formio-mcp-setup/);
  });
});

// The branch is decided by which tools answer, so naming a version in the prose
// that describes it adds a fact nothing keeps current. sync-server-pin.ts
// restamps launch COMMANDS only, and `project_get` ships in the release AFTER the
// one every currently shipped manifest pins — so a sentence saying "older than
// <pinned>" is wrong by one release from the day it is written, and tells an agent
// connected to that exact version that its server is current.
describe('the too-old branch names no version', () => {
  const semver = /\d+\.\d+\.\d+/;

  it('no document dates the availability of project_get', () => {
    const dated = allMarkdown().filter((path) =>
      read(path)
        .split('\n')
        .some((line) => line.includes('project_get') && semver.test(line))
    );

    expect(dated.map((path) => relative(repoRoot, path))).toEqual([]);
  });

  it('both documents send the reader to the tool list instead', () => {
    for (const file of ['formio-angular/SETUP.md', 'formio-mcp-setup/SKILL.md']) {
      expect(read(join(skillsRoot, file))).toMatch(/never (from|on) a version number/i);
    }
  });
});

describe('the rules live in exactly one document', () => {
  const others = () => allMarkdown().filter((path) => !path.endsWith(CANONICAL));

  it('no other document restates the base-URL derivation', () => {
    expect(offenders(others(), (text) => /not derivable/i.test(text))).toEqual([]);
  });

  it('no other document carries URL validation rules of its own', () => {
    expect(offenders(others(), (text) => /Trailing slash\.|Strip trailing/i.test(text))).toEqual(
      []
    );
  });
});
