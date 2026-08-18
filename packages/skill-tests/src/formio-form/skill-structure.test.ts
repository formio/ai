// Structural tests for the `formio-form` skill (plugin/skills/formio-form/).
// These assert the authoring contract from the `formio-form-skill` spec:
// directory layout, the three-clause description, canonical inclusion modes,
// forbidden imports, the MCP Tool Preference section, and the dev symlink.

import { describe, expect, it } from 'vitest';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-form');
const skillMdPath = join(skillDir, 'SKILL.md');
const referencesDir = join(skillDir, 'references');

const REFERENCE_DOCS = [
  'setup.md',
  'rendering.md',
  'javascript-api.md',
  'options.md',
  'json-logic.md',
  'field-logic.md',
  'conditionals.md',
  'calculated-values.md',
  'validation.md',
  'external-data.md',
  'wizards.md',
] as const;

function readSkillMd(): string {
  return readFileSync(skillMdPath, 'utf8');
}

function frontmatterOf(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('SKILL.md has no YAML frontmatter block');
  }
  return match[1];
}

function allSkillDocs(): Array<{ file: string; content: string }> {
  const docs = [{ file: 'SKILL.md', content: readSkillMd() }];
  for (const doc of REFERENCE_DOCS) {
    const path = join(referencesDir, doc);
    docs.push({ file: `references/${doc}`, content: readFileSync(path, 'utf8') });
  }
  return docs;
}

describe('formio-form directory layout', () => {
  it('SKILL.md exists with name: formio-form and a non-empty description', () => {
    expect(existsSync(skillMdPath)).toBe(true);
    const frontmatter = frontmatterOf(readSkillMd());
    expect(frontmatter).toMatch(/^name: formio-form$/m);
    expect(frontmatter).toMatch(/^description:\s*\S/m);
  });

  it('all eleven reference docs exist, are non-empty, and have no frontmatter', () => {
    for (const doc of REFERENCE_DOCS) {
      const path = join(referencesDir, doc);
      expect(existsSync(path), `references/${doc} missing`).toBe(true);
      const content = readFileSync(path, 'utf8');
      expect(content.trim().length, `references/${doc} is empty`).toBeGreaterThan(0);
      expect(content.startsWith('---'), `references/${doc} must not have frontmatter`).toBe(false);
    }
  });

  it('references/ contains exactly the eleven required docs', () => {
    const found = readdirSync(referencesDir).filter((f) => f.endsWith('.md'));
    expect(found.sort()).toEqual([...REFERENCE_DOCS].sort());
  });

  it('.claude/skills/formio-form symlink resolves to plugin/skills/formio-form', () => {
    const link = join(repoRoot, '.claude/skills/formio-form');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(skillDir));
  });
});

describe('formio-form three-clause description', () => {
  it('capability clause names @formio/js', () => {
    expect(frontmatterOf(readSkillMd())).toContain('@formio/js');
  });

  it('trigger clause begins with "Use when the user asks to"', () => {
    expect(frontmatterOf(readSkillMd())).toContain('Use when the user asks to');
  });

  it('negative clause names every sibling skill', () => {
    const frontmatter = frontmatterOf(readSkillMd());
    expect(frontmatter).toContain('Not for:');
    const notFor = frontmatter.slice(frontmatter.indexOf('Not for:'));
    for (const sibling of [
      'formio-angular',
      'formio-application',
      'formio-resource-planner',
      'formio-api',
      'formio-sdk',
    ]) {
      expect(notFor, `Not for: clause missing ${sibling}`).toContain(sibling);
    }
  });
});

describe('formio-form canonical inclusion modes', () => {
  it('no doc contains a forbidden import', () => {
    for (const { file, content } of allSkillDocs()) {
      expect(content, `${file} imports @formio/core`).not.toMatch(/from ['"]@formio\/core['"]/);
      expect(content, `${file} uses a deep import`).not.toMatch(/from ['"]@formio\/js\/lib\//);
      expect(content, `${file} uses require()`).not.toMatch(/require\(['"]@formio\/js['"]\)/);
    }
  });

  it('setup.md documents the CDN mode as a version-pinned, integrity-pinned renderer bundle', () => {
    const setup = readFileSync(join(referencesDir, 'setup.md'), 'utf8');
    expect(setup).toMatch(
      /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@formio\/js@\d+\.\d+\.\d+\/dist\/formio\.form\.min\.js"\s+integrity="sha384-[A-Za-z0-9+/=]+"\s+crossorigin="anonymous"/
    );
    expect(setup).toMatch(
      /<link[^>]+href="https:\/\/cdn\.jsdelivr\.net\/npm\/@formio\/js@\d+\.\d+\.\d+\/dist\/formio\.form\.min\.css"[^>]+integrity="sha384-[A-Za-z0-9+/=]+"/
    );
  });

  it('no doc loads @formio/js from an unpinnable URL', () => {
    for (const { file, content } of allSkillDocs()) {
      expect(content, `${file} names a fixed-path vendor bundle`).not.toContain('cdn.form.io');
      for (const url of content.match(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/@formio\/js[^\s"')`]*/g
      ) ?? []) {
        expect(url, `${file} loads @formio/js from an unversioned URL`).toMatch(
          /^https:\/\/cdn\.jsdelivr\.net\/npm\/@formio\/js@\d+\.\d+\.\d+\//
        );
      }
    }
  });

  it('no doc script-loads the builder bundle in an embed-only skill', () => {
    for (const { file, content } of allSkillDocs()) {
      expect(content, `${file} script-loads formio.full.min.js`).not.toMatch(
        /<script[^>]+formio\.full\.min\.js/
      );
    }
  });

  it('setup.md documents the canonical ESM import', () => {
    const setup = readFileSync(join(referencesDir, 'setup.md'), 'utf8');
    expect(setup).toContain(`import { Formio } from '@formio/js';`);
  });
});

describe('formio-form JSON Logic primer', () => {
  const CONSUMER_DOCS = [
    'conditionals.md',
    'calculated-values.md',
    'validation.md',
    'field-logic.md',
  ] as const;

  it('json-logic.md documents the operations vocabulary and var resolution', () => {
    const primer = readFileSync(join(referencesDir, 'json-logic.md'), 'utf8');
    for (const operation of ['if', '===', 'var', 'reduce', 'substr', 'missing']) {
      expect(primer, `primer missing operation ${operation}`).toContain(`\`${operation}\``);
    }
    expect(primer).toContain('`data`');
    expect(primer).toContain('`row`');
    expect(primer).toContain('jsonlogic.com');
  });

  it('consumer docs reference json-logic.md by path instead of re-listing operations', () => {
    for (const doc of CONSUMER_DOCS) {
      const content = readFileSync(join(referencesDir, doc), 'utf8');
      expect(content, `${doc} must reference json-logic.md`).toContain('json-logic.md');
      for (const primerOnlyOperation of ['`substr`', '`reduce`', '`missing`']) {
        expect(
          content,
          `${doc} re-lists primer-only operation ${primerOnlyOperation}`
        ).not.toContain(primerOnlyOperation);
      }
    }
  });
});

describe('sibling skill descriptions route embed requests to formio-form', () => {
  const SIBLING_SKILLS = ['formio-sdk', 'formio-application', 'formio-angular'] as const;

  it.each(SIBLING_SKILLS)('%s Not for: clause names formio-form', (sibling) => {
    const skillMd = readFileSync(join(repoRoot, `plugin/skills/${sibling}/SKILL.md`), 'utf8');
    const frontmatter = frontmatterOf(skillMd);
    expect(frontmatter).toContain('Not for:');
    const notFor = frontmatter.slice(frontmatter.indexOf('Not for:'));
    expect(notFor, `${sibling} Not for: clause must name formio-form`).toContain('formio-form');
  });
});

describe('formio-form MCP Tool Preference', () => {
  it('SKILL.md has the section naming the first-party tools and portal-login auth', () => {
    const skillMd = readSkillMd();
    expect(skillMd).toContain('## MCP Tool Preference');
    const section = skillMd.slice(skillMd.indexOf('## MCP Tool Preference'));
    expect(section).toContain('form_get');
    expect(section).toContain('authenticate');
    expect(section).toContain('x-jwt-token');
  });
});
