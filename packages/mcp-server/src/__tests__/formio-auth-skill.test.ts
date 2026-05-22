import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import { CANONICAL_AUTH_PARAGRAPH } from '../skills-validator.js';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILLS_DIR = path.join(REPO_ROOT, 'plugin/skills');

const AUTH_SKILL_DIR = path.join(SKILLS_DIR, 'formio-auth');
const AUTH_SKILL_MD = path.join(AUTH_SKILL_DIR, 'SKILL.md');
const AUTH_REFS_DIR = path.join(AUTH_SKILL_DIR, 'references');

const PLANNER_SKILL_MD = path.join(SKILLS_DIR, 'formio-resource-planner/SKILL.md');
const PLANNER_TEMPLATE_MD = path.join(
  SKILLS_DIR,
  'formio-resource-planner/references/template-md.md'
);

const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');

const REQUIRED_REFERENCES = [
  'resource-auth.md',
  'login-forms.md',
  'roles-and-permissions.md',
  'group-permissions.md',
  'sso-oidc.md',
  'sso-saml.md',
  'sso-ldap.md',
  'token-swap.md',
  'custom-jwt.md',
  'email-auth.md',
  'jwt-and-sessions.md',
] as const;

const REQUIRED_REFERENCE_SECTIONS = [
  'Overview',
  'When to use this',
  'Configuration',
  'MCP Tool Preference',
  'See also',
] as const;

const APPROVED_MCP_TOOLS = [
  'authenticate',
  'role_create',
  'role_list',
  'role_update',
  'form_create',
  'form_get',
  'form_list',
  'form_update',
  'action_create',
  'action_list',
  'action_get',
  'action_update',
  'action_delete',
  'action_type_get',
  'action_types_list',
  'project_export',
  'project_import',
] as const;

const PORTAL_PHRASE = 'Form.io project portal';

const RESOURCE_DEPENDENT_DOCS = [
  'resource-auth.md',
  'login-forms.md',
  'roles-and-permissions.md',
  'group-permissions.md',
] as const;

const NEIGHBOR_LINK_DOCS = [
  'sso-oidc.md',
  'sso-saml.md',
  'sso-ldap.md',
  'token-swap.md',
  'custom-jwt.md',
  'email-auth.md',
] as const;

const TOPIC_KEYWORDS: Record<(typeof REQUIRED_REFERENCES)[number], readonly string[]> = {
  'resource-auth.md': ['resource'],
  'login-forms.md': ['login', 'form'],
  'roles-and-permissions.md': ['role', 'permission'],
  'group-permissions.md': ['group'],
  'sso-oidc.md': ['oidc', 'oauth'],
  'sso-saml.md': ['saml'],
  'sso-ldap.md': ['ldap'],
  'token-swap.md': ['token swap'],
  'custom-jwt.md': ['custom jwt'],
  'email-auth.md': ['email'],
  'jwt-and-sessions.md': ['jwt', 'session'],
};

const PLANNER_AUTH_KEYWORDS = [
  'SSO',
  'OIDC',
  'SAML',
  'LDAP',
  'Token Swap',
  'Custom JWT',
  'email token',
  'JWT',
  '2FA',
] as const;

function exists(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readRaw(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function readFrontmatter(file: string): Record<string, unknown> {
  return matter(readRaw(file)).data as Record<string, unknown>;
}

function firstHeading(body: string): string {
  const m = /^#{1,6}\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : '';
}

function topHeadings(body: string): string[] {
  return Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => m[1].trim());
}

function sliceSection(body: string, heading: string): string {
  const start = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(body);
  if (!start) return '';
  const after = body.slice(start.index + start[0].length);
  const next = /^##\s+/m.exec(after);
  return next ? after.slice(0, next.index) : after;
}

function stripCode(body: string): string {
  return body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

describe('formio-auth skill scaffold', () => {
  it('SKILL.md exists and is non-empty', () => {
    expect(exists(AUTH_SKILL_MD), `${AUTH_SKILL_MD} must exist`).toBe(true);
    expect(fs.readFileSync(AUTH_SKILL_MD, 'utf8').trim().length).toBeGreaterThan(0);
  });

  it('SKILL.md frontmatter has name and non-empty description', () => {
    const fm = readFrontmatter(AUTH_SKILL_MD);
    expect(fm.name).toBe('formio-auth');
    expect(typeof fm.description).toBe('string');
    expect((fm.description as string).trim().length).toBeGreaterThan(0);
  });

  it('references directory exists', () => {
    expect(isDirectory(AUTH_REFS_DIR), `${AUTH_REFS_DIR} must be a directory`).toBe(true);
  });
});

describe('formio-auth activation description', () => {
  it('description contains "Use when" trigger clause', () => {
    const fm = readFrontmatter(AUTH_SKILL_MD);
    const desc = (fm.description as string) ?? '';
    expect(desc.toLowerCase()).toContain('use when');
  });

  it('description contains "Not for" negative-trigger clause naming planner + neighbor', () => {
    const fm = readFrontmatter(AUTH_SKILL_MD);
    const desc = (fm.description as string) ?? '';
    expect(desc.toLowerCase()).toContain('not for');
    expect(desc).toContain('formio-resource-planner');
    const neighbors = ['formio-application', 'formio-api', 'formio-angular'];
    expect(neighbors.some((n) => desc.includes(n))).toBe(true);
  });
});

describe('formio-auth reference docs — existence, headings, frontmatter', () => {
  for (const ref of REQUIRED_REFERENCES) {
    const full = path.join(AUTH_REFS_DIR, ref);

    it(`${ref} exists and is non-empty`, () => {
      expect(exists(full), `${full} must exist`).toBe(true);
      expect(readRaw(full).trim().length).toBeGreaterThan(0);
    });

    it(`${ref} has no YAML frontmatter`, () => {
      const raw = readRaw(full);
      expect(raw.startsWith('---'), `${ref} must not have frontmatter`).toBe(false);
    });

    it(`${ref} first heading names its topic`, () => {
      const heading = firstHeading(readRaw(full)).toLowerCase();
      const keywords = TOPIC_KEYWORDS[ref];
      const matched = keywords.some((k) => heading.includes(k));
      expect(
        matched,
        `${ref} first heading "${heading}" must contain one of ${keywords.join(', ')}`
      ).toBe(true);
    });
  }
});

describe('formio-auth reference doc section layout', () => {
  for (const ref of REQUIRED_REFERENCES) {
    const full = path.join(AUTH_REFS_DIR, ref);

    it(`${ref} contains all required sections in order`, () => {
      const headings = topHeadings(readRaw(full));
      const positions = REQUIRED_REFERENCE_SECTIONS.map((h) => headings.indexOf(h));
      for (let i = 0; i < REQUIRED_REFERENCE_SECTIONS.length; i++) {
        expect(
          positions[i],
          `${ref} missing section "${REQUIRED_REFERENCE_SECTIONS[i]}"`
        ).toBeGreaterThanOrEqual(0);
      }
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i], `${ref} sections out of order`).toBeGreaterThan(positions[i - 1]);
      }
    });
  }
});

describe('formio-auth MCP Tool Preference content', () => {
  for (const ref of REQUIRED_REFERENCES) {
    const full = path.join(AUTH_REFS_DIR, ref);

    it(`${ref} MCP Tool Preference names a tool or portal`, () => {
      const section = sliceSection(readRaw(full), 'MCP Tool Preference').trim();
      expect(section.length, `${ref} MCP Tool Preference must be non-empty`).toBeGreaterThan(0);
      const namesTool = APPROVED_MCP_TOOLS.some((t) => new RegExp(`\\b${t}\\b`).test(section));
      const namesPortal = section.includes(PORTAL_PHRASE);
      expect(
        namesTool || namesPortal,
        `${ref} MCP Tool Preference must name an approved tool or "${PORTAL_PHRASE}"`
      ).toBe(true);
    });
  }
});

describe('formio-auth canonical portal-login JWT paragraph', () => {
  for (const ref of ['jwt-and-sessions.md', 'resource-auth.md']) {
    it(`${ref} contains CANONICAL_AUTH_PARAGRAPH verbatim`, () => {
      const body = readRaw(path.join(AUTH_REFS_DIR, ref));
      expect(body).toContain(CANONICAL_AUTH_PARAGRAPH);
    });
  }
});

describe('formio-auth terminology — baseUrl vs projectUrl', () => {
  for (const ref of REQUIRED_REFERENCES) {
    const full = path.join(AUTH_REFS_DIR, ref);

    it(`${ref} does not misuse baseUrl / projectUrl in prose`, () => {
      const prose = stripCode(readRaw(full)).toLowerCase();
      expect(prose).not.toMatch(/baseurl\s+is\s+the\s+project/);
      expect(prose).not.toMatch(/base_url\s+is\s+the\s+project/);
      expect(prose).not.toMatch(/projecturl\s+is\s+the\s+platform/);
      expect(prose).not.toMatch(/project_url\s+is\s+the\s+platform/);
    });
  }
});

describe('formio-auth See also cross-skill handoff', () => {
  for (const ref of RESOURCE_DEPENDENT_DOCS) {
    it(`${ref} See also references formio-resource-planner`, () => {
      const section = sliceSection(readRaw(path.join(AUTH_REFS_DIR, ref)), 'See also');
      expect(section).toContain('formio-resource-planner');
    });
  }

  for (const ref of NEIGHBOR_LINK_DOCS) {
    it(`${ref} See also links to at least one neighbor reference`, () => {
      const section = sliceSection(readRaw(path.join(AUTH_REFS_DIR, ref)), 'See also');
      const neighbors = REQUIRED_REFERENCES.filter((r) => r !== ref);
      const linked = neighbors.some((n) => section.includes(n));
      expect(linked, `${ref} See also must link to one of ${neighbors.join(', ')}`).toBe(true);
    });
  }
});

describe('formio-resource-planner update — auth handoff', () => {
  it('planner description contains Not for + formio-auth + 3+ auth keywords', () => {
    const fm = readFrontmatter(PLANNER_SKILL_MD);
    const desc = (fm.description as string) ?? '';
    expect(desc.toLowerCase()).toContain('not for');
    expect(desc).toContain('formio-auth');
    const matched = PLANNER_AUTH_KEYWORDS.filter((k) =>
      desc.toLowerCase().includes(k.toLowerCase())
    );
    expect(
      matched.length,
      `planner description must name 3+ of ${PLANNER_AUTH_KEYWORDS.join(', ')}`
    ).toBeGreaterThanOrEqual(3);
  });

  it('planner Users & Auth template emits SSO and Custom JWT fields', () => {
    const sources = [readRaw(PLANNER_SKILL_MD), readRaw(PLANNER_TEMPLATE_MD)].join('\n\n');
    expect(sources).toMatch(/SSO:\s*<?\s*none\s*\|\s*OIDC\s*\|\s*SAML\s*\|\s*LDAP/i);
    expect(sources).toMatch(/Custom JWT:\s*<?\s*yes\s*\|\s*no/i);
  });
});

describe('CLAUDE.md lists formio-auth', () => {
  it('CLAUDE.md names formio-auth and describes planner ↔ auth handoff', () => {
    const body = readRaw(CLAUDE_MD);
    expect(body).toContain('formio-auth');
    const lines = body.split('\n');
    const plannerLines = lines
      .map((l, i) => (l.includes('formio-resource-planner') ? i : -1))
      .filter((i) => i >= 0);
    const authLines = lines
      .map((l, i) => (l.includes('formio-auth') ? i : -1))
      .filter((i) => i >= 0);
    const close = plannerLines.some((p) => authLines.some((a) => Math.abs(a - p) <= 10));
    expect(
      close,
      'CLAUDE.md must mention formio-resource-planner and formio-auth within ~10 lines'
    ).toBe(true);
  });
});
