import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILLS_DIR = path.join(REPO_ROOT, 'plugin/skills');

const APP_SKILL = path.join(SKILLS_DIR, 'formio-application/SKILL.md');
const APP_INTENT = path.join(SKILLS_DIR, 'formio-application/INTENT.md');
const APP_DEPLOYMENT = path.join(SKILLS_DIR, 'formio-application/DEPLOYMENT.md');
const APP_MCP_CONFIG = path.join(SKILLS_DIR, 'formio-application/MCP_CONFIG.md');
const APP_IMPORT = path.join(SKILLS_DIR, 'formio-application/IMPORT.md');
const APP_FRAMEWORK = path.join(SKILLS_DIR, 'formio-application/FRAMEWORK.md');

const ANGULAR_SKILL = path.join(SKILLS_DIR, 'formio-angular/SKILL.md');
const ANGULAR_SUB_SKILL = path.join(SKILLS_DIR, 'formio-angular/resources/SKILL.md');
const PLANNER_SKILL = path.join(SKILLS_DIR, 'formio-resource-planner/SKILL.md');

// Plain-language build-new triggers formio-application MUST claim.
const APP_BUILD_NEW_TRIGGERS = ['build me an app', 'create a crm', 'i need a tool to track'];
// Plain-language extend triggers formio-application MUST claim.
const APP_EXTEND_TRIGGERS = ['also track', 'add a way to see'];

// Generic phrases formio-angular MUST NOT contain (they now belong to formio-application).
const ANGULAR_FORBIDDEN_GENERIC = [
  'build me an app',
  'build me a tool',
  'spin up an app',
  'i need a tool to track',
  'task manager',
  'help desk',
  'crm',
  'booking system',
];

// Angular-explicit triggers formio-angular MUST claim.
const ANGULAR_REQUIRED_EXPLICIT = ['build it in angular', 'angular front-end', 'use angular'];

// Generic extend phrases formio-angular-resources MUST NOT contain.
const ANGULAR_SUB_FORBIDDEN_GENERIC = [
  'also track',
  'also let',
  'add a way to see',
  'each x should have a list of y',
];

// Angular-explicit extend triggers formio-angular-resources MUST claim.
const ANGULAR_SUB_REQUIRED_EXPLICIT = [
  'add an angular module',
  'regenerate the angular',
  'in my angular app',
];

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

function sliceStepSection(body: string, stepNumber: number): string {
  const startRe = new RegExp(`^#+\\s+Step ${stepNumber}\\b`, 'm');
  const startMatch = startRe.exec(body);
  if (!startMatch) return '';
  const start = startMatch.index;
  const afterStart = body.slice(start + startMatch[0].length);
  const endRe = new RegExp(`^#+\\s+Step ${stepNumber + 1}\\b`, 'm');
  const endMatch = endRe.exec(afterStart);
  const end = endMatch ? start + startMatch[0].length + endMatch.index : body.length;
  return body.slice(start, end);
}

describe('formio-application skill layout', () => {
  it('parent SKILL.md and sibling docs exist', () => {
    expect(exists(APP_SKILL)).toBe(true);
    expect(exists(APP_INTENT)).toBe(true);
    expect(exists(APP_DEPLOYMENT)).toBe(true);
    expect(exists(APP_IMPORT)).toBe(true);
    expect(exists(APP_FRAMEWORK)).toBe(true);
  });

  it('sibling docs have no YAML frontmatter', () => {
    for (const f of [APP_INTENT, APP_DEPLOYMENT, APP_IMPORT, APP_FRAMEWORK]) {
      const raw = fs.readFileSync(f, 'utf8');
      expect(raw.startsWith('---'), `${f} must not have frontmatter`).toBe(false);
    }
  });
});

describe('formio-application frontmatter', () => {
  it('name is formio-application', () => {
    const fm = readFrontmatter(APP_SKILL);
    expect(fm.name).toBe('formio-application');
  });

  it('description claims plain-language build-new triggers', () => {
    const fm = readFrontmatter(APP_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    for (const phrase of APP_BUILD_NEW_TRIGGERS) {
      expect(description, `must contain "${phrase}"`).toContain(phrase);
    }
  });

  it('description claims plain-language extend triggers', () => {
    const fm = readFrontmatter(APP_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    for (const phrase of APP_EXTEND_TRIGGERS) {
      expect(description, `must contain "${phrase}"`).toContain(phrase);
    }
  });

  it('description contains Not-for clauses naming sibling skills', () => {
    const fm = readFrontmatter(APP_SKILL);
    const description = String(fm.description ?? '');
    expect(description).toMatch(/not for:/i);
    expect(description).toContain('formio-angular');
    expect(description).toContain('formio-angular-resources');
    expect(description).toContain('formio-resource-planner');
    expect(description).toContain('formio-api');
  });
});

describe('formio-application body', () => {
  it('names the six steps in order via section headers', () => {
    const body = readBody(APP_SKILL);
    const intentIdx = body.search(/^#+\s+Step 1[^\n]*Intent/im);
    const planIdx = body.search(/^#+\s+Step 2[^\n]*Plan/im);
    const deploymentIdx = body.search(/^#+\s+Step 3[^\n]*Deployment/im);
    const mcpConfigIdx = body.search(/^#+\s+Step 4[^\n]*MCP Config/im);
    const importIdx = body.search(/^#+\s+Step 5[^\n]*Import/im);
    const frameworkIdx = body.search(/^#+\s+Step 6[^\n]*Framework/im);
    for (const [name, idx] of [
      ['Step 1 — Intent', intentIdx],
      ['Step 2 — Plan', planIdx],
      ['Step 3 — Deployment', deploymentIdx],
      ['Step 4 — MCP Config', mcpConfigIdx],
      ['Step 5 — Import', importIdx],
      ['Step 6 — Framework', frameworkIdx],
    ] as const) {
      expect(idx, `body must have "${name}" section header`).toBeGreaterThan(-1);
    }
    expect(intentIdx).toBeLessThan(planIdx);
    expect(planIdx).toBeLessThan(deploymentIdx);
    expect(deploymentIdx).toBeLessThan(mcpConfigIdx);
    expect(mcpConfigIdx).toBeLessThan(importIdx);
    expect(importIdx).toBeLessThan(frameworkIdx);
  });

  it('references the five sibling docs by relative link', () => {
    const body = readBody(APP_SKILL);
    expect(body).toContain('INTENT.md');
    expect(body).toContain('DEPLOYMENT.md');
    expect(body).toContain('MCP_CONFIG.md');
    expect(body).toContain('IMPORT.md');
    expect(body).toContain('FRAMEWORK.md');
  });

  it('description mentions .mcp.json and the restart pause', () => {
    const fm = readFrontmatter(APP_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    expect(description).toContain('.mcp.json');
    expect(description).toMatch(/(restart|reconnect)/);
  });

  it('Step 2 (Plan) invokes formio-resource-planner in both modes', () => {
    const body = readBody(APP_SKILL);
    const step2 = sliceStepSection(body, 2).toLowerCase();
    expect(step2.length, 'Step 2 section must exist').toBeGreaterThan(0);
    expect(step2).toContain('formio-resource-planner');
    expect(step2).toMatch(/delta/);
    expect(step2).toMatch(/(additive|merge)/);
  });

  it('Step 5 (Import) runs on both branches with implicit auth', () => {
    const body = readBody(APP_SKILL);
    const step5 = sliceStepSection(body, 5).toLowerCase();
    expect(step5.length, 'Step 5 section must exist').toBeGreaterThan(0);
    expect(step5).toContain('project_import');
    expect(step5).toMatch(/additive/);
    expect(step5).toMatch(/(implicit|first authenticated|portal.login)/);
  });

  it('Step 4 section documents halt + restart + modify-existing skip', () => {
    const body = readBody(APP_SKILL);
    const step4 = sliceStepSection(body, 4).toLowerCase();
    expect(step4.length, 'Step 4 section must exist').toBeGreaterThan(0);
    expect(step4).toContain('mcp_config.md');
    expect(step4).toMatch(/(halt|stop|pause)/);
    expect(step4).toMatch(/(restart|reconnect)/);
    expect(step4).toMatch(/(modify-existing|skipped)/);
  });
});

describe('INTENT.md content', () => {
  it('names AskUserQuestion and covers both branches', () => {
    const raw = fs.readFileSync(APP_INTENT, 'utf8');
    expect(raw).toContain('AskUserQuestion');
    expect(raw.toLowerCase()).toMatch(/build/);
    expect(raw.toLowerCase()).toMatch(/(modify|extend)/);
  });

  it('documents modify-existing skips only Deployment + MCP Config (still runs planner + import)', () => {
    const raw = fs.readFileSync(APP_INTENT, 'utf8').toLowerCase();
    expect(raw).toMatch(/skip/);
    expect(raw).toMatch(/(deployment|step 3)/);
    expect(raw).toMatch(/(mcp config|mcp_config|mcp-config|step 4)/);
    // Modify-existing MUST still mention planner + import
    expect(raw).toContain('formio-resource-planner');
    expect(raw).toContain('project_import');
    expect(raw).toMatch(/delta/);
    expect(raw).toMatch(/additive/);
  });
});

describe('DEPLOYMENT.md content', () => {
  it('batches the URL interview and names env-var terms', () => {
    const raw = fs.readFileSync(APP_DEPLOYMENT, 'utf8');
    expect(raw).toContain('AskUserQuestion');
    expect(raw.toLowerCase()).toMatch(/(batched|single|one)/);
    expect(raw).toContain('FORMIO_PROJECT_URL');
    expect(raw).toContain('FORMIO_BASE_URL');
  });

  it('contains plain-language URL descriptions with examples', () => {
    const raw = fs.readFileSync(APP_DEPLOYMENT, 'utf8');
    expect(raw).toMatch(/Project URL/);
    expect(raw).toMatch(/Base URL/);
    expect(raw).toMatch(/https:\/\/[\w.-]*form\.io/);
  });

  it('names the next consumer of captured URLs (Step 4 / MCP_CONFIG.md)', () => {
    const raw = fs.readFileSync(APP_DEPLOYMENT, 'utf8');
    expect(raw).toMatch(/(Step 4|MCP Config|MCP_CONFIG\.md)/);
  });
});

describe('IMPORT.md content', () => {
  it('covers import flow and error branches', () => {
    const raw = fs.readFileSync(APP_IMPORT, 'utf8');
    expect(raw).toContain('project_import');
    expect(raw.toLowerCase()).toMatch(/merge/);
    expect(raw.toLowerCase()).toMatch(/(auth|401|403)/);
    expect(raw.toLowerCase()).toMatch(/(not found|404)/);
    expect(raw.toLowerCase()).toMatch(/(validation|400)/);
  });

  it('describes browser login and headless fallback', () => {
    const raw = fs.readFileSync(APP_IMPORT, 'utf8');
    expect(raw.toLowerCase()).toMatch(/browser/);
    expect(raw.toLowerCase()).toMatch(/(headless|portal.login|print)/);
  });

  it('Step 5 describes implicit portal-login on first authenticated call', () => {
    const raw = fs.readFileSync(APP_IMPORT, 'utf8').toLowerCase();
    expect(raw).toMatch(/(implicit|first authenticated|portal.login|browser)/);
  });
});

describe('MCP_CONFIG.md content', () => {
  it('exists and has no frontmatter', () => {
    expect(exists(APP_MCP_CONFIG)).toBe(true);
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8');
    expect(raw.startsWith('---')).toBe(false);
  });

  it('names both env-var keys', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8');
    expect(raw).toContain('FORMIO_PROJECT_URL');
    expect(raw).toContain('FORMIO_BASE_URL');
  });

  it('documents the FORMIO_BASE_URL ↔ FORMIO_BASE_URL mapping', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8');
    expect(raw).toContain('FORMIO_BASE_URL');
    expect(raw).toContain('FORMIO_BASE_URL');
    expect(raw.toLowerCase()).toMatch(/(map|same concept|two names)/);
  });

  it('documents collision handling (preserve command/args, preserve other env, preserve other servers)', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8').toLowerCase();
    expect(raw).toMatch(/preserve/);
    expect(raw).toMatch(/command/);
    expect(raw).toMatch(/args/);
    expect(raw).toMatch(/(unrelated|other) (mcp|server)/);
  });

  it('documents npm-based default command and placeholder warning', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8');
    expect(raw).toContain('npx');
    expect(raw.toLowerCase()).toMatch(/@formio\/mcp/);
    expect(raw.toLowerCase()).toMatch(/(placeholder|aspirational|not.*published|until.*publish)/);
  });

  it('documents the approval gate (preview, approval, write, then restart)', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8').toLowerCase();
    expect(raw).toMatch(/preview/);
    expect(raw).toMatch(/approv/);
    expect(raw).toMatch(/(restart|reconnect)/);
  });

  it('documents the skip rule for matching existing entries', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8').toLowerCase();
    expect(raw).toMatch(/skip/);
    expect(raw).toMatch(/match/);
  });

  it('mentions both "restart Claude Code" and "/mcp" reconnect paths', () => {
    const raw = fs.readFileSync(APP_MCP_CONFIG, 'utf8');
    expect(raw.toLowerCase()).toMatch(/restart claude code/);
    expect(raw).toContain('/mcp');
  });
});

describe('FRAMEWORK.md content', () => {
  it('contains a registry table with Angular row', () => {
    const raw = fs.readFileSync(APP_FRAMEWORK, 'utf8');
    expect(raw).toMatch(/\| Framework \|/);
    expect(raw).toContain('formio-angular');
    expect(raw).toContain('formio-angular-resources');
    expect(raw.toLowerCase()).toMatch(/angular\.json/);
  });

  it('documents single-row silent routing and multi-row picker', () => {
    const raw = fs.readFileSync(APP_FRAMEWORK, 'utf8').toLowerCase();
    expect(raw).toMatch(/(silent|directly|without asking)/);
    expect(raw).toMatch(/(askuserquestion|picker|ask the user)/);
  });

  it('documents how to add a new framework row', () => {
    const raw = fs.readFileSync(APP_FRAMEWORK, 'utf8').toLowerCase();
    expect(raw).toMatch(/add/);
    expect(raw).toMatch(/(row|entry|new framework)/);
  });
});

describe('formio-angular demotion', () => {
  it('description drops generic build-an-app phrases', () => {
    const fm = readFrontmatter(ANGULAR_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    for (const phrase of ANGULAR_FORBIDDEN_GENERIC) {
      expect(description, `must not contain "${phrase}"`).not.toContain(phrase);
    }
  });

  it('description claims Angular-explicit triggers', () => {
    const fm = readFrontmatter(ANGULAR_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    for (const phrase of ANGULAR_REQUIRED_EXPLICIT) {
      expect(description, `must contain "${phrase}"`).toContain(phrase);
    }
  });

  it('description points at formio-application in Not-for clause', () => {
    const fm = readFrontmatter(ANGULAR_SKILL);
    const description = String(fm.description ?? '');
    expect(description).toContain('formio-application');
    expect(description).toMatch(/not for:/i);
  });
});

describe('formio-angular body post-demotion', () => {
  it('body does not describe an Inference phase', () => {
    const body = readBody(ANGULAR_SKILL);
    expect(body).not.toMatch(/Phase 0 — Inference/);
    expect(body).not.toMatch(/## Phase 0 — Inference/);
  });

  it('body documents SETUP handoff from formio-application', () => {
    const body = readBody(ANGULAR_SKILL);
    expect(body).toContain('formio-application');
    expect(body.toLowerCase()).toMatch(/handoff|handed/);
  });

  it("body states Import is not this skill's responsibility", () => {
    const body = readBody(ANGULAR_SKILL).toLowerCase();
    expect(body).toContain('project_import');
    expect(body).toMatch(/(not this skill|lives in formio-application|is formio-application)/);
  });
});

describe('formio-angular-resources demotion', () => {
  it('description drops generic extend phrases', () => {
    const fm = readFrontmatter(ANGULAR_SUB_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    for (const phrase of ANGULAR_SUB_FORBIDDEN_GENERIC) {
      expect(description, `must not contain "${phrase}"`).not.toContain(phrase);
    }
  });

  it('description claims Angular-explicit extend triggers', () => {
    const fm = readFrontmatter(ANGULAR_SUB_SKILL);
    const description = String(fm.description ?? '').toLowerCase();
    for (const phrase of ANGULAR_SUB_REQUIRED_EXPLICIT) {
      expect(description, `must contain "${phrase}"`).toContain(phrase);
    }
  });

  it('description points at formio-application in Not-for clause', () => {
    const fm = readFrontmatter(ANGULAR_SUB_SKILL);
    const description = String(fm.description ?? '');
    expect(description).toContain('formio-application');
    expect(description).toMatch(/not for:/i);
  });
});

describe('formio-resource-planner disk-write documentation', () => {
  it('Phase B section documents writing template.json to cwd', () => {
    const body = readBody(PLANNER_SKILL).toLowerCase();
    expect(body).toMatch(/template\.json/);
    expect(body).toMatch(/(write tool|cwd|working directory)/);
    expect(body).toMatch(/template-.*timestamp/);
  });

  it('Phase B guidance mentions both standalone and orchestrator invocation', () => {
    const body = readBody(PLANNER_SKILL).toLowerCase();
    expect(body).toMatch(/(standalone|directly)/);
    expect(body).toMatch(/formio-application/);
  });
});

describe('CLAUDE.md updates', () => {
  it('names formio-application as build-an-app entry point', () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    expect(raw).toContain('formio-application');
    expect(raw).toMatch(/skills\/formio-application/);
  });
});

describe('YAML frontmatter regression guard', () => {
  it('all SKILL.md files under formio-application and formio-angular parse cleanly', () => {
    const files = [APP_SKILL, ANGULAR_SKILL, ANGULAR_SUB_SKILL];
    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = matter(raw);
      expect(parsed.data, `${file} must have frontmatter`).toBeDefined();
      expect(typeof parsed.data.name).toBe('string');
      expect(typeof parsed.data.description).toBe('string');
      expect(parsed.content.length).toBeGreaterThan(0);
    }
  });
});

describe('trigger-surface non-overlap', () => {
  it('formio-application claims generic phrases that formio-angular does not', () => {
    const appDesc = String(readFrontmatter(APP_SKILL).description ?? '').toLowerCase();
    const angularDesc = String(readFrontmatter(ANGULAR_SKILL).description ?? '').toLowerCase();
    for (const phrase of APP_BUILD_NEW_TRIGGERS) {
      expect(appDesc).toContain(phrase);
      expect(angularDesc, `formio-angular must not claim "${phrase}"`).not.toContain(phrase);
    }
  });

  it('formio-angular claims framework-explicit phrases that formio-application does not', () => {
    const appDesc = String(readFrontmatter(APP_SKILL).description ?? '').toLowerCase();
    const angularDesc = String(readFrontmatter(ANGULAR_SKILL).description ?? '').toLowerCase();
    for (const phrase of ANGULAR_REQUIRED_EXPLICIT) {
      expect(angularDesc).toContain(phrase);
    }
    // formio-application should not claim the specific "build it in Angular" phrasing.
    expect(appDesc).not.toContain('build it in angular');
  });
});
