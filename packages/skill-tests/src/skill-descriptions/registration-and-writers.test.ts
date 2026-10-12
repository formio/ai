// Two contracts between skills.
//
// Registration: `form_create` gives a new form a Save action with empty settings,
// which stores submissions on the form itself; Login searches only the forms in
// its `settings.resources`. A registration pattern that leaves that Save alone
// produces users who can never sign in, so it repoints the Save at the user
// resource.
//
// Writing a saved form: `formio-form-builder`'s edit lane shows the change and
// asks before `form_update`. `formio-form` documents behaviour and `formio-schema`
// documents shapes; neither writes a saved form itself.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');
const read = (path: string): string => readFileSync(join(skillsRoot, path), 'utf8');

function section(markdown: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 2;
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trimEnd() === heading);
  if (start === -1) throw new Error(`no "${heading}" heading`);
  const closes = new RegExp(`^#{1,${level}} `);
  const end = lines.findIndex((line, index) => index > start && closes.test(line));
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

const body = (path: string): string => read(path).replace(/^---\n[\s\S]*?\n---\n/, '');

describe('registration saves into the user resource', () => {
  const pattern = section(
    read('formio-actions/SKILL.md'),
    '### User registration with role assignment'
  );

  it('repoints the default Save action at the user resource', () => {
    expect(pattern).not.toMatch(/built-in, usually already present/);
    expect(pattern).toMatch(/action_update/);
    expect(pattern).toMatch(/`settings\.resource`/);
    expect(pattern).toMatch(/`settings\.fields`/);
  });

  it('adds Role Assignment only when the user resource does not already assign it', () => {
    expect(pattern).toMatch(/Skip it when the user resource already/);
  });

  it('routes to the planner when the project has no user resource', () => {
    expect(pattern).toMatch(/no user resource[^.]*`formio-resource-planner`/);
  });

  it('login-forms.md describes the same Save', () => {
    const registration = read('formio-auth/references/login-forms.md');
    expect(registration).not.toMatch(/\*\*Save Submission\*\* \(built-in\)/);
    expect(registration).toMatch(/Save Submission\*\*[^\n]*`settings\.resource`/);
  });
});

describe('one writer for a saved form', () => {
  it('formio-form sends saved-form changes to formio-form-builder', () => {
    const preference = section(read('formio-form/SKILL.md'), '## MCP Tool Preference');
    expect(preference).not.toMatch(/persist component changes/);
    expect(preference).toMatch(/`formio-form-builder`'s edit lane/);
    expect(preference).not.toMatch(/`authenticate`/);
  });

  it('formio-schema does not write saved forms itself', () => {
    const text = body('formio-schema/SKILL.md');
    expect(text).not.toMatch(/modify them via the MCP server tools/);
    expect(text).toMatch(/`formio-form-builder`'s edit lane/);
  });
});

// Paths an installed skill names resolve relative to the file that names them.
describe('formio-auth and formio-actions name installed paths', () => {
  const markdownUnder = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return markdownUnder(full);
      return entry.name.endsWith('.md') ? [full] : [];
    });
  const files = ['formio-auth', 'formio-actions'].flatMap((skill) =>
    markdownUnder(join(skillsRoot, skill))
  );

  it.each(files.map((path) => [path.slice(skillsRoot.length + 1), path]))(
    '%s has no repository path, and its planner paths resolve',
    (_name, path) => {
      const text = readFileSync(path, 'utf8');
      expect(text).not.toContain('plugin/skills/');
      const planner = [...text.matchAll(/`((?:\.\.\/)+formio-resource-planner\/[^`\s]+?)`/g)].map(
        (match) => match[1]
      );
      const missing = planner.filter((target) => !existsSync(resolve(dirname(path), target)));
      expect(missing).toEqual([]);
    }
  );
});

// form_create gives every new form a Save action. On a login form it runs before
// Login and turns the form's own storage back on, so each login attempt would be
// stored as a submission there; Form.io's own login form carries no Save.
describe('a login form keeps no submissions', () => {
  it('formio-actions says to delete the Save action form_create added', () => {
    const skill = readFileSync(join(skillsRoot, 'formio-actions/SKILL.md'), 'utf8');
    expect(skill).not.toMatch(/login doesn't create a submission/);
    expect(skill).toMatch(/### Login form\n\n[^\n]*`action_delete`[^\n]*Save/);
  });
});
