// The formio-sdk skill documents an execution surface — `Utils.Evaluator`
// compiles strings into code, `requireLibrary` injects scripts into the page,
// `Formio.createForm` renders whatever definition it is handed — and a
// reference that documents such a surface without stating where trust ends is
// read, by agents and by the security scanners that audit published skills, as
// documenting an unbounded capability. `formio-form` documents the same surface
// and is rated safe because its SKILL.md states the boundaries in one place.
//
// These tests lock the equivalent statements for formio-sdk: a `## Security`
// section in SKILL.md with four rules mapping one-to-one onto the four
// findings the skill was flagged for, the class of example that must never
// appear (a literal credential), and the rule carried beside each API in the
// reference that documents it.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-sdk');

const read = (rel: string) => readFileSync(join(skillDir, rel), 'utf8');

function everyMarkdownUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return everyMarkdownUnder(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

/** The body of one `## <heading>` section — everything up to the next `## `. */
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}`);
  if (start === -1) return '';
  const rest = markdown.slice(start + 1);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('SKILL.md carries a Security section', () => {
  const skill = read('SKILL.md');

  it('has a `## Security` heading between Authentication and MCP Tool Preference', () => {
    const auth = skill.indexOf('\n## Authentication');
    const security = skill.indexOf('\n## Security');
    const mcp = skill.indexOf('\n## MCP Tool Preference');
    expect(security, 'no `## Security` section').toBeGreaterThan(-1);
    expect(security).toBeGreaterThan(auth);
    expect(security).toBeLessThan(mcp);
  });

  it('names the four bounded surfaces: credentials, loaders, the evaluator, returned data', () => {
    const body = section(skill, 'Security');
    expect(body).toContain('setToken');
    expect(body).toContain('requireLibrary');
    expect(body).toContain('registerEvaluator');
    expect(body).toContain('Utils.sanitize');
    expect(body).toContain('registerPlugin');
  });

  it('states that what the SDK returns is data and never an instruction to the agent', () => {
    const body = section(skill, 'Security');
    expect(body).toMatch(/never instruct/i);
    expect(body).toMatch(/report(ed)? (it )?to the user/i);
  });
});

describe('no literal credential anywhere under the skill', () => {
  // Narrow on purpose: a SendGrid key shape, and a credential property assigned
  // a quoted string. Each is a value an agent could copy into real source.
  const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
    { label: 'SendGrid key literal (`SG.`)', pattern: /['"`]SG\./ },
    { label: '`api_key` assigned a string literal', pattern: /api_key:\s*['"`]/ },
    { label: '`password` assigned a string literal', pattern: /password:\s*['"`]/ },
  ];

  it('every markdown file is free of the forbidden credential shapes', () => {
    const offenders = everyMarkdownUnder(skillDir).flatMap((path) => {
      const body = readFileSync(path, 'utf8');
      return FORBIDDEN.filter(({ pattern }) => pattern.test(body)).map(
        ({ label }) => `${relative(skillDir, path)}: ${label}`
      );
    });
    expect(offenders).toEqual([]);
  });

  it('projects.md says where credential-bearing settings belong instead of showing one', () => {
    const doc = read('references/projects.md');
    expect(doc).toMatch(/portal/i);
    expect(doc).toMatch(/secret store/i);
  });
});

describe('each reference carries the rule beside the API it bounds', () => {
  it('setup.md states the origin rule next to the library loaders', () => {
    const body = section(read('references/setup.md'), 'API');
    const loaders = body.slice(body.indexOf('Lazy-library'));
    expect(loaders).toMatch(/version-pinned/);
    expect(loaders).toMatch(/host (the application|you) own/);
    expect(loaders).toMatch(/never (assembled|built|derived) from/);
  });

  it('rendering.md bounds formSrc to a project the application controls and links to formio-form', () => {
    const doc = read('references/rendering.md');
    expect(doc).toMatch(/project (the application|you) control/);
    expect(doc).toContain('../../formio-form/SKILL.md');
  });

  it('submissions.md marks data.* as end-user input and names Utils.sanitize', () => {
    const doc = read('references/submissions.md');
    expect(doc).toMatch(/`data\.\*`.*end-user input|end-user input.*`data\.\*`/);
    expect(doc).toContain('Utils.sanitize');
  });
});

describe('references not named in the original findings carry their own boundary', () => {
  it('auth.md bounds the SSO callback token and localStorage persistence', () => {
    const doc = read('references/auth.md');
    expect(doc).toContain('history.replaceState');
    expect(doc).toMatch(/`localStorage` is readable by any script/);
  });

  it('submissions.md treats temp-token URLs as secrets', () => {
    expect(read('references/submissions.md')).toMatch(/treat the URL as the secret it is/);
  });

  it('files.md treats a file descriptor as end-user input and checks storage and url', () => {
    const doc = read('references/files.md');
    expect(doc).toMatch(/descriptor lives in `data\.\*`, so it is end-user input/);
    expect(doc).toMatch(/Check `storage` against the providers/);
  });

  it('plugins.md states that a plugin sees the token and must not take its URL from runtime data', () => {
    const doc = read('references/plugins.md');
    expect(doc).toContain('x-jwt-token');
    expect(doc).toMatch(/never build a plugin's target URL from submission data/);
  });

  it('utils-conditions.md and utils-logic.md say their strings are compiled and owned by the project', () => {
    expect(read('references/utils-conditions.md')).toMatch(/`custom` string is compiled and run/);
    expect(read('references/utils-logic.md')).toMatch(/compiled and executed/);
  });

  it('utils-form-traversal.md bounds the fetch of component.data.url', () => {
    expect(read('references/utils-form-traversal.md')).toMatch(
      /validate its shape before assigning it/
    );
  });

  it('utils-mask-sanitize.md says where widening loses sanitization', () => {
    expect(read('references/utils-mask-sanitize.md')).toMatch(
      /Widening is where sanitization is lost/
    );
  });
});

describe('utils-evaluator.md states the escaping direction the source implements', () => {
  // @formio/core Evaluator.ts: interpolate = {{ }} (raw), escape = {{{ }}} (HTML-escaped).
  it('{{ }} is documented as raw and {{{ }}} as HTML-escaped', () => {
    const doc = read('references/utils-evaluator.md');
    expect(doc).toMatch(/`\{\{ data\.firstName \}\}`[^\n]*raw/);
    expect(doc).toMatch(/`\{\{\{ data\.htmlField \}\}\}`[^\n]*HTML-escaped/);
    expect(doc).not.toMatch(/`\{\{ data\.firstName \}\}`[^\n]*; HTML-escaped/);
  });

  it('the sandboxed evaluator example states its cost to the application’s own expressions', () => {
    expect(read('references/utils-evaluator.md')).toMatch(
      /disables JavaScript expressions in the application's own form definitions/
    );
  });
});

describe('utils-evaluator.md leads with the sandboxed path', () => {
  const examples = section(read('references/utils-evaluator.md'), 'Examples');
  const headings = [...examples.matchAll(/^### (.+)$/gm)].map((m) => m[1]);

  it('the first example installs a sandboxed evaluator', () => {
    expect(headings[0]).toMatch(/sandboxed evaluator/i);
  });

  it('the JSONLogic example precedes every string-code example', () => {
    const jsonLogic = headings.findIndex((h) => /JSONLogic/.test(h));
    const firstStringCode = headings.findIndex((h) =>
      /Interpolate a template|custom validation expression|Compile and reuse/i.test(h)
    );
    expect(jsonLogic).toBeGreaterThan(-1);
    expect(firstStringCode).toBeGreaterThan(-1);
    expect(jsonLogic).toBeLessThan(firstStringCode);
  });

  it('every string-code example is introduced as an authored literal', () => {
    // Split the Examples section into one chunk per `###` heading and inspect the
    // chunks whose fenced code passes a string to evaluate / evaluator.
    const chunks = examples.split(/^### /m).slice(1);
    const stringCode = chunks.filter((chunk) =>
      /Evaluator\.(evaluate|evaluator)\(\s*'/.test(chunk)
    );
    expect(stringCode.length).toBeGreaterThan(0);
    for (const chunk of stringCode) {
      expect(chunk, chunk.split('\n')[0]).toMatch(/authored literal/i);
    }
  });
});
