import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CANONICAL_AUTH_PARAGRAPH,
  MCP_PREFERENCE_FALLBACK_SENTENCE,
  MCP_PREFERENCE_HEADING,
  REFERENCES_DIRNAME,
  REQUIRED_REFERENCE_GROUPS,
  REQUIRED_REFERENCE_HEADINGS,
  ROUTER_DIR,
  SKILL_FILENAME,
  type ReferenceGroup,
  GROUP_SCOPE,
  validateLibrary,
  validateNoRandomIdSuffixes,
  validateReferenceContent,
  validateRequiredFiles,
  validateRouterLinks,
  validateRouterSkillContent,
} from '../skills-validator.js';

function makeReferenceBody(
  group: ReferenceGroup,
  overrides: { omit?: string[]; extra?: string; rootUrlBlock?: string } = {}
) {
  const omit = new Set(overrides.omit ?? []);
  const scope = GROUP_SCOPE[group];
  const rootUrl = scope === 'platform' ? '${FORMIO_BASE_URL}' : '${FORMIO_PROJECT_URL}';
  const sections: string[] = [];
  if (!omit.has('Overview')) sections.push('## Overview\n\nExample overview.');
  if (!omit.has('Root URL'))
    sections.push(
      overrides.rootUrlBlock ?? `## Root URL\n\nAll endpoints rooted at \`${rootUrl}\`.`
    );
  if (!omit.has('Authentication')) {
    // server-status skips canonical auth paragraph
    if (group === 'server-status') {
      sections.push('## Authentication\n\nNo auth required — public health endpoints.');
    } else {
      sections.push(`## Authentication\n\n${CANONICAL_AUTH_PARAGRAPH}`);
    }
  }
  if (!omit.has('MCP Tool Preference')) {
    sections.push(`${MCP_PREFERENCE_HEADING}\n\n${MCP_PREFERENCE_FALLBACK_SENTENCE}`);
  }
  if (!omit.has('Endpoints')) {
    const path = scope === 'pdf' ? `${rootUrl}/pdf-proxy/file` : `${rootUrl}/form`;
    sections.push(`## Endpoints\n\n### GET ${path}\n\nList.`);
  }
  return sections.join('\n\n') + (overrides.extra ? `\n\n${overrides.extra}` : '') + '\n';
}

function makeRouterSource(
  overrides: {
    linksToAllGroups?: boolean;
    extraHeadings?: string;
    descriptionOverride?: string;
  } = {}
) {
  const description =
    overrides.descriptionOverride ??
    'Comprehensive Form.io API reference. Use when the user asks about any Form.io REST endpoint. Not for: building an app (see formio-application).';
  const links =
    (overrides.linksToAllGroups ?? true)
      ? REQUIRED_REFERENCE_GROUPS.map((g) => `- [${g}](./${REFERENCES_DIRNAME}/${g}.md)`).join('\n')
      : '';
  return `---
name: formio-api
description: "${description.replace(/"/g, '\\"')}"
---

# Form.io API

${links}

${overrides.extraHeadings ?? ''}
`;
}

function writeLibrary(root: string) {
  fs.mkdirSync(path.join(root, ROUTER_DIR, REFERENCES_DIRNAME), { recursive: true });
  fs.writeFileSync(path.join(root, ROUTER_DIR, SKILL_FILENAME), makeRouterSource());
  for (const group of REQUIRED_REFERENCE_GROUPS) {
    fs.writeFileSync(
      path.join(root, ROUTER_DIR, REFERENCES_DIRNAME, `${group}.md`),
      makeReferenceBody(group)
    );
  }
}

describe('skills-validator — required files', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-lib-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when router SKILL.md and all 17 reference files exist', () => {
    writeLibrary(tmpDir);
    expect(validateRequiredFiles(tmpDir)).toEqual([]);
  });

  it('fails when router SKILL.md is missing', () => {
    writeLibrary(tmpDir);
    fs.rmSync(path.join(tmpDir, ROUTER_DIR, SKILL_FILENAME));
    const issues = validateRequiredFiles(tmpDir);
    expect(
      issues.some((i) => i.rule === 'library.required_file' && i.message.includes('router'))
    ).toBe(true);
  });

  it('fails when a required reference file is missing', () => {
    writeLibrary(tmpDir);
    fs.rmSync(path.join(tmpDir, ROUTER_DIR, REFERENCES_DIRNAME, 'project-forms.md'));
    const issues = validateRequiredFiles(tmpDir);
    expect(issues.some((i) => i.message.includes('project-forms.md'))).toBe(true);
  });

  it('fails when a required reference file is empty', () => {
    writeLibrary(tmpDir);
    fs.writeFileSync(path.join(tmpDir, ROUTER_DIR, REFERENCES_DIRNAME, 'pdf-api.md'), '');
    const issues = validateRequiredFiles(tmpDir);
    expect(issues.some((i) => i.message.includes('pdf-api.md') && /empty/.test(i.message))).toBe(
      true
    );
  });
});

describe('skills-validator — router links', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'router-links-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when router links to every reference group', () => {
    writeLibrary(tmpDir);
    expect(validateRouterLinks(tmpDir)).toEqual([]);
  });

  it('fails when a required group link is absent from router', () => {
    writeLibrary(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, ROUTER_DIR, SKILL_FILENAME),
      makeRouterSource({ linksToAllGroups: false })
    );
    const issues = validateRouterLinks(tmpDir);
    expect(issues.some((i) => i.rule === 'index.missing_link')).toBe(true);
  });

  it('fails when router contains endpoint headings', () => {
    writeLibrary(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, ROUTER_DIR, SKILL_FILENAME),
      makeRouterSource({ extraHeadings: '### GET ${FORMIO_PROJECT_URL}/form\n\nNo.' })
    );
    const issues = validateRouterLinks(tmpDir);
    expect(issues.some((i) => i.rule === 'index.no_endpoint_docs')).toBe(true);
  });

  it('fails when router links to a non-existent reference file', () => {
    writeLibrary(tmpDir);
    const routerPath = path.join(tmpDir, ROUTER_DIR, SKILL_FILENAME);
    const orig = fs.readFileSync(routerPath, 'utf8');
    fs.writeFileSync(
      routerPath,
      `${orig}\n- [missing](./${REFERENCES_DIRNAME}/missing-group.md)\n`
    );
    const issues = validateRouterLinks(tmpDir);
    expect(issues.some((i) => i.rule === 'index.broken_link')).toBe(true);
  });
});

describe('skills-validator — router skill content', () => {
  it('passes with valid router frontmatter + trigger clauses', () => {
    const source = makeRouterSource();
    expect(validateRouterSkillContent('formio-api/SKILL.md', source)).toEqual([]);
  });

  it('fails when router description lacks "use when" trigger', () => {
    const source = makeRouterSource({
      descriptionOverride: 'Reference. Not for: building an app (see formio-application).',
    });
    const issues = validateRouterSkillContent('formio-api/SKILL.md', source);
    expect(issues.some((i) => i.rule === 'description.trigger_phrase')).toBe(true);
  });

  it('fails when router description lacks "not for:" clause', () => {
    const source = makeRouterSource({
      descriptionOverride: 'Reference. Use when the user asks about any Form.io endpoint.',
    });
    const issues = validateRouterSkillContent('formio-api/SKILL.md', source);
    expect(issues.some((i) => i.rule === 'description.negative_trigger')).toBe(true);
  });

  it('fails when router frontmatter.name is wrong', () => {
    const source = `---
name: formio-wrong
description: "Use when testing. Not for: production."
---
body`;
    const issues = validateRouterSkillContent('formio-api/SKILL.md', source);
    expect(issues.some((i) => i.rule === 'frontmatter.name')).toBe(true);
  });

  it('fails when router has extra frontmatter keys', () => {
    const source = `---
name: formio-api
description: "Use when asking about Form.io. Not for: plan."
scope: project
---
body`;
    const issues = validateRouterSkillContent('formio-api/SKILL.md', source);
    expect(issues.some((i) => i.rule === 'frontmatter.keys')).toBe(true);
  });
});

describe('skills-validator — reference content', () => {
  it('passes with a well-formed reference doc (no frontmatter)', () => {
    const source = makeReferenceBody('project-forms');
    expect(validateReferenceContent('ref.md', source, 'project-forms')).toEqual([]);
  });

  it('fails when reference doc has frontmatter', () => {
    const source = `---\nname: something\n---\n\n${makeReferenceBody('project-forms')}`;
    const issues = validateReferenceContent('ref.md', source, 'project-forms');
    expect(issues.some((i) => i.rule === 'reference.no_frontmatter')).toBe(true);
  });

  it('fails when a required heading is missing', () => {
    const source = makeReferenceBody('project-forms', { omit: ['Overview'] });
    const issues = validateReferenceContent('ref.md', source, 'project-forms');
    expect(issues.some((i) => i.rule === 'headings.missing')).toBe(true);
  });

  it('fails when required headings are out of order', () => {
    const body = `## MCP Tool Preference\n\n${MCP_PREFERENCE_FALLBACK_SENTENCE}\n\n## Overview\n\ntext\n\n## Root URL\n\n\`\${FORMIO_PROJECT_URL}\`\n\n## Authentication\n\n${CANONICAL_AUTH_PARAGRAPH}\n\n## Endpoints\n\n### GET \${FORMIO_PROJECT_URL}/x\n\n.`;
    const issues = validateReferenceContent('ref.md', body, 'project-forms');
    expect(issues.some((i) => i.rule === 'headings.order')).toBe(true);
  });

  it('requires canonical auth paragraph (except server-status)', () => {
    const source = `## Overview\n\nx\n\n## Root URL\n\nx\n\n## Authentication\n\nnope\n\n## MCP Tool Preference\n\n${MCP_PREFERENCE_FALLBACK_SENTENCE}\n\n## Endpoints\n\n### GET x\n\n.`;
    const issues = validateReferenceContent('ref.md', source, 'project-forms');
    expect(issues.some((i) => i.rule === 'auth.canonical_paragraph')).toBe(true);
  });

  it('allows server-status without canonical auth paragraph', () => {
    const source = makeReferenceBody('server-status');
    const issues = validateReferenceContent('ref.md', source, 'server-status');
    expect(issues.every((i) => i.rule !== 'auth.canonical_paragraph')).toBe(true);
  });

  it('flags forbidden legacy-auth tokens', () => {
    const source = makeReferenceBody('project-forms', { extra: 'Include x-token header.' });
    const issues = validateReferenceContent('ref.md', source, 'project-forms');
    expect(issues.some((i) => i.rule === 'forbidden.legacy_auth')).toBe(true);
  });

  it('flags unresolved Postman project placeholder for project-scope refs', () => {
    const source = makeReferenceBody('project-forms', {
      extra: 'Path: {{baseUrl}}/{{projectName}}/form (needs substitution).',
    });
    const issues = validateReferenceContent('ref.md', source, 'project-forms');
    expect(issues.some((i) => i.rule === 'placeholder.project')).toBe(true);
  });

  it('flags bare {{baseUrl}}/ placeholder for platform-scope refs', () => {
    const source = makeReferenceBody('platform-auth', {
      extra: 'Path: {{baseUrl}}/user (needs substitution).',
    });
    const issues = validateReferenceContent('ref.md', source, 'platform-auth');
    expect(issues.some((i) => i.rule === 'placeholder.platform')).toBe(true);
  });

  it('flags pdf endpoints that do not begin with ${FORMIO_PROJECT_URL}/pdf-proxy', () => {
    const body = makeReferenceBody('pdf-api', {
      omit: ['Endpoints'],
      extra: '## Endpoints\n\n### GET ${FORMIO_PROJECT_URL}/file\n\nWrong path.',
    });
    // Re-inject endpoints after omit
    const source = body.replace('## Endpoints\n\n', '## Endpoints\n\n');
    const issues = validateReferenceContent('ref.md', source, 'pdf-api');
    expect(issues.some((i) => i.rule === 'pdf.proxy_path')).toBe(true);
  });

  it('flags terminology misuse of baseUrl for project endpoint', () => {
    const source = makeReferenceBody('project-forms', {
      extra: 'The baseUrl is the project endpoint here.',
    });
    const issues = validateReferenceContent('ref.md', source, 'project-forms');
    expect(issues.some((i) => i.rule === 'terminology.baseUrl_for_project')).toBe(true);
  });

  it('flags terminology misuse of projectUrl for platform endpoint', () => {
    const source = makeReferenceBody('platform-auth', {
      extra: 'The projectUrl is the platform deployment URL.',
    });
    const issues = validateReferenceContent('ref.md', source, 'platform-auth');
    expect(issues.some((i) => i.rule === 'terminology.projectUrl_for_platform')).toBe(true);
  });
});

describe('skills-validator — validateNoRandomIdSuffixes', () => {
  it('flags random-id integer suffix in example titles', () => {
    const body = '```json\n{"title": "My Form 42"}\n```';
    // code fences are stripped before scanning; regex runs against original body
    const issues = validateNoRandomIdSuffixes('ref.md', body);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags random-id suffix in slug-style fields', () => {
    const body = '```json\n{"name": "myform-99"}\n```';
    const issues = validateNoRandomIdSuffixes('ref.md', body);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('skills-validator — validateLibrary integration', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-integration-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes on a well-formed library', () => {
    writeLibrary(tmpDir);
    expect(validateLibrary(tmpDir)).toEqual([]);
  });

  it('collects issues across required-files + router + every reference', () => {
    writeLibrary(tmpDir);
    // Break: delete a reference + corrupt router + corrupt one reference
    fs.rmSync(path.join(tmpDir, ROUTER_DIR, REFERENCES_DIRNAME, 'runtime-reports.md'));
    fs.writeFileSync(
      path.join(tmpDir, ROUTER_DIR, SKILL_FILENAME),
      makeRouterSource({ descriptionOverride: 'missing triggers' })
    );
    fs.writeFileSync(
      path.join(tmpDir, ROUTER_DIR, REFERENCES_DIRNAME, 'project-forms.md'),
      '## Overview\n\nmissing auth\n'
    );
    const issues = validateLibrary(tmpDir);
    const rules = new Set(issues.map((i) => i.rule));
    expect(rules.has('library.required_file')).toBe(true);
    expect(rules.has('description.trigger_phrase')).toBe(true);
    expect(rules.has('headings.missing')).toBe(true);
  });
});

describe('skills-validator — REQUIRED_REFERENCE_GROUPS invariants', () => {
  it('has 17 groups', () => {
    expect(REQUIRED_REFERENCE_GROUPS.length).toBe(17);
  });

  it('every group has a scope mapping', () => {
    for (const group of REQUIRED_REFERENCE_GROUPS) {
      expect(GROUP_SCOPE[group]).toBeDefined();
    }
  });

  it('REQUIRED_REFERENCE_HEADINGS includes MCP Tool Preference after Authentication', () => {
    const authIdx = REQUIRED_REFERENCE_HEADINGS.indexOf('## Authentication');
    const mcpIdx = REQUIRED_REFERENCE_HEADINGS.indexOf(MCP_PREFERENCE_HEADING);
    const endpointsIdx = REQUIRED_REFERENCE_HEADINGS.indexOf('## Endpoints');
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(mcpIdx).toBe(authIdx + 1);
    expect(endpointsIdx).toBe(mcpIdx + 1);
  });
});

describe('skills-validator — real library on disk', () => {
  const REPO_ROOT = path.resolve(__dirname, '../../../..');
  const LIBRARY_DIR = path.join(REPO_ROOT, 'plugin/skills');

  it('real plugin/skills library validates cleanly', () => {
    const issues = validateLibrary(LIBRARY_DIR);
    // Print any issues for debugging
    if (issues.length > 0) {
      console.error('Library validation issues:', JSON.stringify(issues, null, 2));
    }
    expect(issues).toEqual([]);
  });
});
