import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILLS_DIR = path.join(REPO_ROOT, 'plugin/skills');

const PARENT_SKILL = path.join(SKILLS_DIR, 'formio-angular/SKILL.md');
const PARENT_SETUP = path.join(SKILLS_DIR, 'formio-angular/SETUP.md');
const PARENT_CONFIG = path.join(SKILLS_DIR, 'formio-angular/CONFIG.md');
const PARENT_AUTH = path.join(SKILLS_DIR, 'formio-angular/AUTH.md');
const SUB_SKILL = path.join(SKILLS_DIR, 'formio-angular/resources/SKILL.md');
const SUB_EVALS = path.join(SKILLS_DIR, 'formio-angular/resources/evals');

const OLD_SKILL_DIR = path.join(SKILLS_DIR, 'formio-resource-angular');

// Trigger-surface assertions for formio-angular + formio-angular-resources live
// in formio-application-layout.test.ts now — after the `add-formio-application-orchestrator`
// change demoted these two skills to framework-explicit triggers only.
// This file retains only the infrastructure assertions (file layout, symlinks,
// sibling-doc content) that don't depend on trigger-surface wording.

function exists(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function readFrontmatter(file: string): Record<string, unknown> {
  const raw = fs.readFileSync(file, 'utf8');
  return matter(raw).data as Record<string, unknown>;
}

function readBody(file: string): string {
  const raw = fs.readFileSync(file, 'utf8');
  return matter(raw).content;
}

describe('formio-angular skill layout', () => {
  it('parent SKILL.md and sibling reference docs exist, old resource-angular dir removed', () => {
    expect(exists(PARENT_SKILL)).toBe(true);
    expect(exists(PARENT_SETUP)).toBe(true);
    expect(exists(PARENT_CONFIG)).toBe(true);
    expect(exists(PARENT_AUTH)).toBe(true);
    expect(exists(SUB_SKILL)).toBe(true);
    expect(exists(OLD_SKILL_DIR)).toBe(false);
  });
});

describe('formio-angular sub-skill frontmatter', () => {
  it('sub-skill name is formio-angular-resources', () => {
    const fm = readFrontmatter(SUB_SKILL);
    expect(fm.name).toBe('formio-angular-resources');
  });

  it('sub-skill description contains Not-for clause naming parent formio-angular', () => {
    const fm = readFrontmatter(SUB_SKILL);
    const description = String(fm.description ?? '');
    expect(description).toMatch(/not for:/i);
    expect(description).toContain('formio-angular');
  });
});

describe('formio-angular parent frontmatter', () => {
  it('parent name and description are set', () => {
    const fm = readFrontmatter(PARENT_SKILL);
    expect(fm.name).toBe('formio-angular');
    expect(String(fm.description ?? '').length).toBeGreaterThan(0);
  });

  it('parent description negatives point at formio-angular-resources', () => {
    const fm = readFrontmatter(PARENT_SKILL);
    const description = String(fm.description ?? '');
    expect(description).toContain('formio-angular-resources');
    expect(description).toMatch(/not for:/i);
  });

  it('parent body names the four phases in SETUP, CONFIG, AUTH, Resources order', () => {
    const body = readBody(PARENT_SKILL);
    const setupIdx = body.search(/\bSETUP\b/);
    const configIdx = body.search(/\bCONFIG\b/);
    const authIdx = body.search(/\bAUTH\b/);
    const resourcesIdx = body.search(/formio-angular-resources/);
    expect(setupIdx).toBeGreaterThan(-1);
    expect(configIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeGreaterThan(-1);
    expect(resourcesIdx).toBeGreaterThan(-1);
    expect(setupIdx).toBeLessThan(configIdx);
    expect(configIdx).toBeLessThan(authIdx);
    expect(authIdx).toBeLessThan(resourcesIdx);
  });
});

describe('formio-angular SETUP.md', () => {
  it('has no YAML frontmatter', () => {
    const raw = fs.readFileSync(PARENT_SETUP, 'utf8');
    expect(raw.startsWith('---')).toBe(false);
  });

  it('captures Project URL and Base URL', () => {
    const raw = fs.readFileSync(PARENT_SETUP, 'utf8');
    expect(raw).toMatch(/Project URL/);
    expect(raw).toMatch(/Base URL/);
  });

  it('names FORMIO_PROJECT_URL and FORMIO_BASE_URL explicitly', () => {
    const raw = fs.readFileSync(PARENT_SETUP, 'utf8');
    expect(raw).toContain('FORMIO_PROJECT_URL');
    expect(raw).toContain('FORMIO_BASE_URL');
  });

  it('batches the URL questions into a single AskUserQuestion', () => {
    const raw = fs.readFileSync(PARENT_SETUP, 'utf8');
    expect(raw).toMatch(/AskUserQuestion/);
    expect(raw).toMatch(/(single|one|batch)/i);
  });
});

describe('formio-angular CONFIG.md', () => {
  it('has no frontmatter', () => {
    const raw = fs.readFileSync(PARENT_CONFIG, 'utf8');
    expect(raw.startsWith('---')).toBe(false);
  });

  it('references canonical external URLs', () => {
    const raw = fs.readFileSync(PARENT_CONFIG, 'utf8');
    expect(raw).toContain('https://help.form.io/developers/introduction/application');
    expect(raw).toContain('https://github.com/formio/angular-demo/blob/master/src/app/config.ts');
    expect(raw).toContain(
      'https://github.com/formio/angular-demo/blob/master/src/app/app.module.ts'
    );
  });

  it('contains a config.ts code template with FormioAppConfig', () => {
    const raw = fs.readFileSync(PARENT_CONFIG, 'utf8');
    expect(raw).toContain('AppConfig');
    expect(raw).toContain('FormioAppConfig');
    expect(raw).toContain('appUrl');
    expect(raw).toContain('apiUrl');
  });

  it('guides AppModule wiring with provider token and FormioModule import', () => {
    const raw = fs.readFileSync(PARENT_CONFIG, 'utf8');
    expect(raw).toContain('provide: FormioAppConfig');
    expect(raw).toContain('useValue: AppConfig');
    expect(raw).toContain('FormioModule');
    expect(raw).toContain('@formio/angular');
  });

  it('describes preview-then-approve gate', () => {
    const raw = fs.readFileSync(PARENT_CONFIG, 'utf8');
    expect(raw).toMatch(/preview/i);
    expect(raw).toMatch(/approv/i);
  });

  it('describes skip-if-already-wired detection', () => {
    const raw = fs.readFileSync(PARENT_CONFIG, 'utf8');
    expect(raw).toMatch(/skip/i);
    expect(raw).toMatch(/(already|existing)/i);
  });
});

describe('formio-angular AUTH.md', () => {
  it('has no frontmatter', () => {
    const raw = fs.readFileSync(PARENT_AUTH, 'utf8');
    expect(raw.startsWith('---')).toBe(false);
  });

  it('references canonical external URLs', () => {
    const raw = fs.readFileSync(PARENT_AUTH, 'utf8');
    expect(raw).toContain(
      'https://help.form.io/developers/introduction/application#user-authentication'
    );
    expect(raw).toContain(
      'https://github.com/formio/angular-demo/blob/master/src/app/auth/auth.module.ts'
    );
    expect(raw).toContain(
      'https://github.com/formio/angular-demo/blob/master/src/app/app.module.ts#L71'
    );
  });

  it('documents template.json extraction rules', () => {
    const raw = fs.readFileSync(PARENT_AUTH, 'utf8');
    expect(raw).toMatch(/template\.json/);
    expect(raw).toMatch(/user resource/i);
    expect(raw).toMatch(/login form/i);
    expect(raw).toMatch(/register form/i);
    expect(raw).toMatch(/role/i);
  });

  it('contains an auth.module.ts template using FormioAuthConfig', () => {
    const raw = fs.readFileSync(PARENT_AUTH, 'utf8');
    expect(raw).toContain('FormioAuthConfig');
    expect(raw).toContain('@formio/angular/auth');
  });

  it('documents no-template fallback TODO pointing at api skill references', () => {
    const raw = fs.readFileSync(PARENT_AUTH, 'utf8');
    expect(raw).toMatch(/TODO/);
    expect(raw).toContain('runtime-auth');
    expect(raw).toContain('platform-auth');
  });

  it('describes preview gate and skip-if-already-wired', () => {
    const raw = fs.readFileSync(PARENT_AUTH, 'utf8');
    expect(raw).toMatch(/preview/i);
    expect(raw).toMatch(/approv/i);
    expect(raw).toMatch(/skip/i);
    expect(raw).toMatch(/AuthModule/);
  });
});

describe('formio-angular eval-artifact paths', () => {
  it('evals dir contains no "formio-resource-angular" references', () => {
    const files = ['grade.py', 'README.md', 'evals.json'];
    for (const f of files) {
      const raw = fs.readFileSync(path.join(SUB_EVALS, f), 'utf8');
      expect(raw, `${f} must not reference old skill name`).not.toMatch(/formio-resource-angular/);
    }
  });

  it('grade.py references the renamed .eval-artifacts path', () => {
    const raw = fs.readFileSync(path.join(SUB_EVALS, 'grade.py'), 'utf8');
    expect(raw).toContain('formio-angular-resources');
  });
});

describe('repo-wide skill-name references', () => {
  it('CLAUDE.md names formio-angular and has no formio-resource-angular references', () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    expect(raw).toContain('formio-angular');
    expect(raw).not.toMatch(/formio-resource-angular/);
    expect(raw).toMatch(/skills\/formio-angular\/resources/);
  });

  it('formio-resource-planner skill has no formio-resource-angular references', () => {
    const plannerDir = path.join(SKILLS_DIR, 'formio-resource-planner');
    const stack = [plannerDir];
    const offenders: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!/\.(md|json|py|ts|txt)$/.test(entry.name)) continue;
        const raw = fs.readFileSync(full, 'utf8');
        if (raw.includes('formio-resource-angular')) offenders.push(full);
      }
    }
    expect(offenders, `files still reference old skill name: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('formio-angular SKILL.md files parse as valid markdown+frontmatter', () => {
  it('both parent and sub-skill parse cleanly', () => {
    for (const file of [PARENT_SKILL, SUB_SKILL]) {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = matter(raw);
      expect(parsed.data, `${file} must have frontmatter`).toBeDefined();
      expect(typeof parsed.data.name).toBe('string');
      expect(typeof parsed.data.description).toBe('string');
      expect(parsed.content.length).toBeGreaterThan(0);
    }
  });
});
