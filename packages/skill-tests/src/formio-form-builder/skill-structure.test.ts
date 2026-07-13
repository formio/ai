// Structural tests for the `formio-form-builder` skill (plugin/skills/formio-form-builder/).
// These assert the authoring contract from the `formio-form-builder-skill` spec:
// orchestrator directory layout (root-level step docs, no references/), the
// three-clause description with the form-vs-resource boundary rule, and the
// dev symlink.
//
// `formio-form-builder` contains the substring `formio-form`, so every
// assertion that distinguishes the two names matches backtick-delimited
// names (`formio-form` vs `formio-form-builder`) — never a plain substring.

import { describe, expect, it } from 'vitest';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillDir = join(repoRoot, 'plugin/skills/formio-form-builder');
const skillMdPath = join(skillDir, 'SKILL.md');

const STEP_DOCS = ['FORM_TYPES.md', 'INTENT.md', 'SAVE.md', 'EMBED.md'] as const;

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

// Backtick-delimited name matcher: finds `name` exactly, so `formio-form`
// does not match inside `formio-form-builder` and vice versa.
function namesExactly(text: string, skillName: string): boolean {
  return text.includes(`\`${skillName}\``);
}

describe('formio-form-builder directory layout', () => {
  it('SKILL.md exists with name: formio-form-builder and a non-empty description', () => {
    expect(existsSync(skillMdPath)).toBe(true);
    const frontmatter = frontmatterOf(readSkillMd());
    expect(frontmatter).toMatch(/^name: formio-form-builder$/m);
    expect(frontmatter).toMatch(/^description:\s*\S/m);
  });

  it('all four step docs exist, are non-empty, and have no frontmatter', () => {
    for (const doc of STEP_DOCS) {
      const path = join(skillDir, doc);
      expect(existsSync(path), `${doc} missing`).toBe(true);
      const content = readFileSync(path, 'utf8');
      expect(content.trim().length, `${doc} is empty`).toBeGreaterThan(0);
      expect(content.startsWith('---'), `${doc} must not have frontmatter`).toBe(false);
    }
  });

  it('uses the orchestrator layout: root-level step docs, no references/ directory', () => {
    expect(existsSync(join(skillDir, 'references'))).toBe(false);
    const rootDocs = readdirSync(skillDir).filter((f) => f.endsWith('.md'));
    expect(rootDocs.sort()).toEqual([...STEP_DOCS, 'SKILL.md'].sort());
  });

  it('.claude/skills/formio-form-builder symlink resolves to plugin/skills/formio-form-builder', () => {
    const link = join(repoRoot, '.claude/skills/formio-form-builder');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(skillDir));
  });
});

describe('sibling skill descriptions route form creation to formio-form-builder', () => {
  const SIBLING_SKILLS = ['formio-application', 'formio-resource-planner', 'formio-form'] as const;

  it.each(SIBLING_SKILLS)('%s Not for: clause names `formio-form-builder`', (sibling) => {
    const skillMd = readFileSync(join(repoRoot, `plugin/skills/${sibling}/SKILL.md`), 'utf8');
    const frontmatter = frontmatterOf(skillMd);
    expect(frontmatter).toContain('Not for:');
    const notFor = frontmatter.slice(frontmatter.indexOf('Not for:'));
    expect(
      namesExactly(notFor, 'formio-form-builder'),
      `${sibling} Not for: clause must name \`formio-form-builder\``
    ).toBe(true);
  });

  it('formio-schema description contains no formio-form substring (spec-forbidden — no reverse pointer)', () => {
    const skillMd = readFileSync(join(repoRoot, 'plugin/skills/formio-schema/SKILL.md'), 'utf8');
    const frontmatter = frontmatterOf(skillMd);
    const description = frontmatter.slice(frontmatter.indexOf('description:'));
    expect(description).not.toContain('formio-form');
  });
});

describe('formio-form-builder three-clause description', () => {
  it('capability clause names the form types and the end-to-end pipeline', () => {
    const frontmatter = frontmatterOf(readSkillMd());
    for (const term of ['webform', 'wizard', 'PDF']) {
      expect(frontmatter, `description missing form type ${term}`).toContain(term);
    }
  });

  it('trigger clause begins with "Use when the user asks to" and claims single-form creation intents', () => {
    const frontmatter = frontmatterOf(readSkillMd());
    expect(frontmatter).toContain('Use when the user asks to');
    for (const trigger of [
      'build a form',
      'create a form',
      'multi-page form',
      'survey',
      'contact form',
      'intake form',
      'registration form',
      'questionnaire',
      'pdf form',
    ]) {
      expect(frontmatter, `trigger clause missing "${trigger}"`).toContain(trigger);
    }
  });

  it('states the form-vs-resource boundary rule', () => {
    const frontmatter = frontmatterOf(readSkillMd());
    expect(frontmatter).toContain('build a form to collect');
    expect(frontmatter).toMatch(/data model/i);
  });

  it('negative clause names every sibling with backtick-delimited names', () => {
    const frontmatter = frontmatterOf(readSkillMd());
    expect(frontmatter).toContain('Not for:');
    const notFor = frontmatter.slice(frontmatter.indexOf('Not for:'));
    for (const sibling of [
      'formio-form',
      'formio-application',
      'formio-resource-planner',
      'formio-schema',
      'formio-api',
    ]) {
      expect(namesExactly(notFor, sibling), `Not for: clause missing \`${sibling}\``).toBe(true);
    }
  });
});
