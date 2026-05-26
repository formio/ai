import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILLS_DIR = path.join(REPO_ROOT, 'plugin/skills');

const SCHEMA_DIR = path.join(SKILLS_DIR, 'formio-schema');
const SCHEMA_SKILL = path.join(SCHEMA_DIR, 'SKILL.md');
const REFERENCES_DIR = path.join(SCHEMA_DIR, 'references');
const FORM_REFS_DIR = path.join(REFERENCES_DIR, 'form');

const FORM_REFERENCE_FILES = [
  'form-definition.md',
  'base-component.md',
  'input-components.md',
  'layout-components.md',
  'data-components.md',
] as const;

const SUBMISSION_REFS_DIR = path.join(REFERENCES_DIR, 'submission');
const PROJECT_REFS_DIR = path.join(REFERENCES_DIR, 'project');

const PROJECT_REFERENCE_FILES = [
  'project-definition.md',
  'project-type-and-framework.md',
  'project-settings.md',
  'project-access.md',
] as const;

const PROJECT_DEFINITION_PROPERTIES = [
  '_id',
  'title',
  'name',
  'type',
  'description',
  'tag',
  'owner',
  'externalOwner',
  'project',
  'remote',
  'plan',
  'billing',
  'apiCalls',
  'steps',
  'framework',
  'primary',
  'access',
  'trial',
  'lastDeploy',
  'stageTitle',
  'machineName',
  'config',
  'protect',
  'settings',
  'remoteSecret',
  'builderConfig',
  'formDefaults',
  'public',
  'created',
  'modified',
  'deleted',
] as const;

const PROJECT_TYPE_VALUES = ['project', 'stage', 'tenant'] as const;

const PROJECT_FRAMEWORK_VALUES = [
  'angular',
  'angular2',
  'react',
  'vue',
  'html5',
  'simple',
  'custom',
  'aurelia',
  'javascript',
] as const;

const PROJECT_SETTINGS_KEYS = [
  'appOrigin',
  'keys',
  'cors',
  'csp',
  'secret',
  'pdfserver',
  'filetoken',
  'allowConfig',
  'allowConfigToForms',
  'custom',
  'formModule',
  'email',
  'captcha',
  'recaptcha',
  'esign',
  'google',
  'kickbox',
  'sqlconnector',
  'storage',
  'tokenParse',
  'oauth',
  'ldap',
  'saml',
] as const;

const SUBMISSION_REFERENCE_FILES = [
  'submission-definition.md',
  'submission-state.md',
  'submission-metadata.md',
  'submission-access.md',
  'submission-data.md',
] as const;

const SUBMISSION_DEFINITION_PROPERTIES = [
  '_id',
  '_fvid',
  'form',
  'project',
  'owner',
  'roles',
  'state',
  'access',
  'metadata',
  'data',
  'externalIds',
  'externalTokens',
  'permission',
  'created',
  'modified',
  'deleted',
] as const;

const SUBMISSION_METADATA_KEYS = [
  'timezone',
  'offset',
  'origin',
  'referrer',
  'browserName',
  'userAgent',
  'pathName',
  'onLine',
  'language',
  'headers',
  'ssoteam',
  'memberCount',
  'selectData',
] as const;

const SUBMISSION_ACCESS_TYPES = [
  'self',
  'create_own',
  'create_all',
  'read_own',
  'read_all',
  'update_own',
  'update_all',
  'delete_own',
  'delete_all',
  'team_read',
  'team_write',
  'team_admin',
  'team_access',
] as const;

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

describe('formio-schema references directory layout', () => {
  it('references/ contains every domain subdirectory and no top-level .md files', () => {
    expect(exists(REFERENCES_DIR)).toBe(true);
    const entries = fs.readdirSync(REFERENCES_DIR, { withFileTypes: true });
    const dirNames = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(dirNames).toEqual(['form', 'project', 'submission']);
    const topLevelMd = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));
    expect(topLevelMd).toEqual([]);
  });

  it('references/form/ contains all five form-domain references and each is non-empty', () => {
    expect(exists(FORM_REFS_DIR)).toBe(true);
    for (const file of FORM_REFERENCE_FILES) {
      const full = path.join(FORM_REFS_DIR, file);
      expect(exists(full), `${file} must exist`).toBe(true);
      const raw = fs.readFileSync(full, 'utf8');
      expect(raw.trim().length, `${file} must be non-empty`).toBeGreaterThan(0);
    }
  });
});

describe('formio-schema SKILL.md frontmatter', () => {
  it('name is formio-schema', () => {
    const fm = readFrontmatter(SCHEMA_SKILL);
    expect(fm.name).toBe('formio-schema');
  });

  it('description spans the form, submission, and project domains', () => {
    const fm = readFrontmatter(SCHEMA_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    expect(description).toContain('form');
    expect(description).toContain('submission');
    expect(description).toContain('project');
  });

  it('description has Not-for clause naming peer skills and contains no formio-form reference', () => {
    const fm = readFrontmatter(SCHEMA_SKILL);
    const description = String(fm.description ?? '');
    expect(description).toMatch(/not for:/i);
    expect(description).toContain('formio-api');
    expect(description).toContain('formio-actions');
    expect(description).toContain('formio-resource-planner');
    expect(description).toContain('formio-application');
    expect(description).not.toContain('formio-form');
  });
});

describe('formio-schema SKILL.md body indexes every domain', () => {
  it('body references all five references/form/*.md paths', () => {
    const body = readBody(SCHEMA_SKILL);
    for (const file of FORM_REFERENCE_FILES) {
      expect(body).toContain(`references/form/${file}`);
    }
  });

  it('body references every references/submission/submission-*.md path and excludes submission/README.md', () => {
    const body = readBody(SCHEMA_SKILL);
    for (const file of SUBMISSION_REFERENCE_FILES) {
      expect(body).toContain(`references/submission/${file}`);
    }
    expect(body).not.toContain('references/submission/README.md');
  });

  it('body references every references/project/project-*.md path and excludes project README + billing', () => {
    const body = readBody(SCHEMA_SKILL);
    for (const file of PROJECT_REFERENCE_FILES) {
      expect(body).toContain(`references/project/${file}`);
    }
    expect(body).not.toContain('references/project/README.md');
    expect(body).not.toContain('references/project/project-billing-and-usage.md');
  });
});

describe('formio-schema submission-domain references', () => {
  it('references/submission/ contains every authored file, none carry frontmatter, and README.md is absent', () => {
    expect(exists(SUBMISSION_REFS_DIR)).toBe(true);
    for (const file of SUBMISSION_REFERENCE_FILES) {
      const full = path.join(SUBMISSION_REFS_DIR, file);
      expect(exists(full), `${file} must exist`).toBe(true);
      const raw = fs.readFileSync(full, 'utf8');
      expect(raw.trim().length, `${file} must be non-empty`).toBeGreaterThan(0);
      expect(raw.startsWith('---'), `${file} must not start with YAML frontmatter`).toBe(false);
    }
    expect(exists(path.join(SUBMISSION_REFS_DIR, 'README.md'))).toBe(false);
  });

  it('submission-definition.md mentions every top-level Submission property name', () => {
    const raw = fs.readFileSync(path.join(SUBMISSION_REFS_DIR, 'submission-definition.md'), 'utf8');
    for (const prop of SUBMISSION_DEFINITION_PROPERTIES) {
      expect(raw, `submission-definition.md must mention ${prop}`).toContain(prop);
    }
  });

  it('submission-state.md documents both draft and submitted', () => {
    const raw = fs.readFileSync(path.join(SUBMISSION_REFS_DIR, 'submission-state.md'), 'utf8');
    expect(raw).toContain('draft');
    expect(raw).toContain('submitted');
  });

  it('submission-metadata.md mentions every documented key and notes extensibility', () => {
    const raw = fs.readFileSync(path.join(SUBMISSION_REFS_DIR, 'submission-metadata.md'), 'utf8');
    for (const key of SUBMISSION_METADATA_KEYS) {
      expect(raw, `submission-metadata.md must mention ${key}`).toContain(key);
    }
    expect(raw.toLowerCase()).toMatch(/extensible|open-ended|extension|arbitrary/);
  });

  it('submission-access.md mentions every AccessType value', () => {
    const raw = fs.readFileSync(path.join(SUBMISSION_REFS_DIR, 'submission-access.md'), 'utf8');
    for (const type of SUBMISSION_ACCESS_TYPES) {
      expect(raw, `submission-access.md must mention ${type}`).toContain(type);
    }
  });

  it('submission-data.md cross-links to the form references', () => {
    const raw = fs.readFileSync(path.join(SUBMISSION_REFS_DIR, 'submission-data.md'), 'utf8');
    expect(raw).toMatch(/references\/form\//);
  });
});

describe('formio-schema project-domain references', () => {
  it('references/project/ contains every authored file, none carry frontmatter, README + billing files absent', () => {
    expect(exists(PROJECT_REFS_DIR)).toBe(true);
    for (const file of PROJECT_REFERENCE_FILES) {
      const full = path.join(PROJECT_REFS_DIR, file);
      expect(exists(full), `${file} must exist`).toBe(true);
      const raw = fs.readFileSync(full, 'utf8');
      expect(raw.trim().length, `${file} must be non-empty`).toBeGreaterThan(0);
      expect(raw.startsWith('---'), `${file} must not start with YAML frontmatter`).toBe(false);
    }
    expect(exists(path.join(PROJECT_REFS_DIR, 'README.md'))).toBe(false);
    expect(exists(path.join(PROJECT_REFS_DIR, 'project-billing-and-usage.md'))).toBe(false);
  });

  it('project-definition.md mentions every Project property name', () => {
    const raw = fs.readFileSync(path.join(PROJECT_REFS_DIR, 'project-definition.md'), 'utf8');
    for (const prop of PROJECT_DEFINITION_PROPERTIES) {
      expect(raw, `project-definition.md must mention ${prop}`).toContain(prop);
    }
  });

  it('project-definition.md notes deployed projects use plan commercial', () => {
    const raw = fs.readFileSync(path.join(PROJECT_REFS_DIR, 'project-definition.md'), 'utf8');
    expect(raw).toContain('commercial');
  });

  it('project-type-and-framework.md enumerates every type and framework value', () => {
    const raw = fs.readFileSync(
      path.join(PROJECT_REFS_DIR, 'project-type-and-framework.md'),
      'utf8'
    );
    for (const value of PROJECT_TYPE_VALUES) {
      expect(raw, `must mention ProjectType ${value}`).toContain(value);
    }
    for (const value of PROJECT_FRAMEWORK_VALUES) {
      expect(raw, `must mention ProjectFramework ${value}`).toContain(value);
    }
  });

  it('project-type-and-framework.md documents Stage and Tenant creation patterns', () => {
    const raw = fs.readFileSync(
      path.join(PROJECT_REFS_DIR, 'project-type-and-framework.md'),
      'utf8'
    );
    expect(raw).toContain('"type": "stage"');
    expect(raw).toContain('"type": "tenant"');
    expect(raw.toLowerCase()).toMatch(/parent project|portal|primary project/);
    expect(raw.toLowerCase()).toMatch(/objectid/);
  });

  it('project-settings.md mentions every ProjectSettings key and the encryption contract', () => {
    const raw = fs.readFileSync(path.join(PROJECT_REFS_DIR, 'project-settings.md'), 'utf8');
    for (const key of PROJECT_SETTINGS_KEYS) {
      expect(raw, `must mention setting ${key}`).toContain(key);
    }
    expect(raw.toLowerCase()).toContain('encrypted');
  });

  it('project-access.md documents project-level access shapes', () => {
    const raw = fs.readFileSync(path.join(PROJECT_REFS_DIR, 'project-access.md'), 'utf8');
    expect(raw).toContain('ProjectRole');
    expect(raw).toContain('ProjectFormAccess');
    expect(raw).toContain('ProjectAccessInfo');
    expect(raw.toLowerCase()).toMatch(/project-level/);
    expect(raw.toLowerCase()).toMatch(/form-level|form definition/);
    expect(raw.toLowerCase()).toMatch(/submission-level|submission record/);
  });
});

describe('formio-form skill removal', () => {
  it('plugin/skills/formio-form/ does not exist', () => {
    expect(exists(path.join(SKILLS_DIR, 'formio-form'))).toBe(false);
  });

  it('no file under plugin/skills/ mentions formio-form', () => {
    const offenders: string[] = [];
    const stack = [SKILLS_DIR];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!/\.(md|json|ts|py|txt)$/.test(entry.name)) continue;
        const raw = fs.readFileSync(full, 'utf8');
        if (raw.includes('formio-form')) offenders.push(full);
      }
    }
    expect(offenders, `files still mention formio-form: ${offenders.join(', ')}`).toEqual([]);
  });
});
