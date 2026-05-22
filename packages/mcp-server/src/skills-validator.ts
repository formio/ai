import path from 'node:path';
import fs from 'node:fs';
import matter from 'gray-matter';

export const LIBRARY_RELATIVE_ROOT = 'plugin/skills';
export const ROUTER_DIR = 'formio-api';
export const REFERENCES_DIRNAME = 'references';
export const SKILL_FILENAME = 'SKILL.md';

export const REQUIRED_REFERENCE_GROUPS = [
  'platform-auth',
  'platform-projects',
  'platform-teams',
  'platform-staging',
  'platform-tenants',
  'project-auth',
  'project-roles',
  'project-forms',
  'project-form-revisions',
  'project-actions',
  'runtime-auth',
  'runtime-custom-users',
  'runtime-access-control',
  'runtime-reports',
  'runtime-submissions',
  'pdf-api',
  'server-status',
] as const;

export type ReferenceGroup = (typeof REQUIRED_REFERENCE_GROUPS)[number];

export const ALLOWED_SCOPES = ['platform', 'project', 'runtime', 'pdf'] as const;
export type Scope = (typeof ALLOWED_SCOPES)[number];

export const GROUP_SCOPE: Record<ReferenceGroup, Scope> = {
  'platform-auth': 'platform',
  'platform-projects': 'platform',
  'platform-teams': 'platform',
  'platform-staging': 'platform',
  'platform-tenants': 'platform',
  'server-status': 'platform',
  'project-auth': 'project',
  'project-roles': 'project',
  'project-forms': 'project',
  'project-form-revisions': 'project',
  'project-actions': 'project',
  'runtime-auth': 'runtime',
  'runtime-custom-users': 'runtime',
  'runtime-access-control': 'runtime',
  'runtime-reports': 'runtime',
  'runtime-submissions': 'runtime',
  'pdf-api': 'pdf',
};

export const ROUTER_FRONTMATTER_KEYS = ['name', 'description'] as const;

export const REQUIRED_REFERENCE_HEADINGS = [
  '## Overview',
  '## Root URL',
  '## Authentication',
  '## MCP Tool Preference',
  '## Endpoints',
] as const;

export const CANONICAL_AUTH_PARAGRAPH =
  "Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.";

export const MCP_PREFERENCE_HEADING = '## MCP Tool Preference';
export const MCP_PREFERENCE_FALLBACK_SENTENCE =
  'No MCP tool covers this operation — use the HTTP endpoint directly.';

export const SERVER_STATUS_GROUP: ReferenceGroup = 'server-status';

export const FORBIDDEN_TOKENS = ['x-token', 'FORMIO_API_KEY'] as const;
export const FORBIDDEN_CASE_INSENSITIVE = ['api key'] as const;

export interface ValidationIssue {
  file: string;
  rule: string;
  message: string;
}

function stripCodeFences(body: string): string {
  return body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSkillFile(source: string): { data: unknown; body: string } {
  const parsed = matter(source);
  return { data: parsed.data, body: parsed.content };
}

export function routerSkillPath(libraryDir: string): string {
  return path.join(libraryDir, ROUTER_DIR, SKILL_FILENAME);
}

export function referencePath(libraryDir: string, group: ReferenceGroup): string {
  return path.join(libraryDir, ROUTER_DIR, REFERENCES_DIRNAME, `${group}.md`);
}

export function validateRouterFrontmatter(file: string, data: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(data)) {
    issues.push({
      file,
      rule: 'frontmatter',
      message: `${file}: missing or malformed YAML frontmatter`,
    });
    return issues;
  }
  const requiredKeys = [...ROUTER_FRONTMATTER_KEYS].sort();
  const keys = Object.keys(data).sort();
  if (keys.length !== requiredKeys.length || keys.some((k, i) => k !== requiredKeys[i])) {
    issues.push({
      file,
      rule: 'frontmatter.keys',
      message: `${file}: router frontmatter keys must be exactly [${requiredKeys.join(', ')}], found [${keys.join(', ')}]`,
    });
  }
  for (const key of requiredKeys) {
    if (!(key in data) || typeof data[key] !== 'string' || data[key] === '') {
      issues.push({
        file,
        rule: `frontmatter.${key}`,
        message: `${file}: frontmatter.${key} must be a non-empty string`,
      });
    }
  }
  if (typeof data.name === 'string' && data.name !== ROUTER_DIR) {
    issues.push({
      file,
      rule: 'frontmatter.name',
      message: `${file}: router frontmatter.name must equal "${ROUTER_DIR}", got "${data.name}"`,
    });
  }
  return issues;
}

export function validateRouterDescriptionTriggers(file: string, data: unknown): ValidationIssue[] {
  if (!isRecord(data) || typeof data.description !== 'string') return [];
  const issues: ValidationIssue[] = [];
  if (!/use when/i.test(data.description)) {
    issues.push({
      file,
      rule: 'description.trigger_phrase',
      message: `${file}: router description must contain a trigger phrase ("Use when the user asks to …")`,
    });
  }
  if (!/not for:/i.test(data.description)) {
    issues.push({
      file,
      rule: 'description.negative_trigger',
      message: `${file}: router description must contain a "Not for: …" clause naming sibling orchestrator/plan skills`,
    });
  }
  return issues;
}

export function validateReferenceHasNoFrontmatter(file: string, data: unknown): ValidationIssue[] {
  if (isRecord(data) && Object.keys(data).length > 0) {
    return [
      {
        file,
        rule: 'reference.no_frontmatter',
        message: `${file}: reference files under formio-api/references/ must not have YAML frontmatter`,
      },
    ];
  }
  return [];
}

export function validateRequiredHeadings(file: string, body: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = body.split('\n');
  const positions = REQUIRED_REFERENCE_HEADINGS.map((h) =>
    lines.findIndex((l) => l.trimStart() === h)
  );
  for (let i = 0; i < REQUIRED_REFERENCE_HEADINGS.length; i++) {
    if (positions[i] === -1) {
      issues.push({
        file,
        rule: 'headings.missing',
        message: `${file}: missing required heading "${REQUIRED_REFERENCE_HEADINGS[i]}"`,
      });
    }
  }
  for (let i = 1; i < REQUIRED_REFERENCE_HEADINGS.length; i++) {
    const prev = positions[i - 1];
    const cur = positions[i];
    if (prev !== -1 && cur !== -1 && cur < prev) {
      issues.push({
        file,
        rule: 'headings.order',
        message: `${file}: required headings are out of order — "${REQUIRED_REFERENCE_HEADINGS[i]}" appears before "${REQUIRED_REFERENCE_HEADINGS[i - 1]}"`,
      });
    }
  }
  return issues;
}

export function validateCanonicalAuthParagraph(
  file: string,
  body: string,
  group: ReferenceGroup
): ValidationIssue[] {
  if (group === SERVER_STATUS_GROUP) return [];
  if (!body.includes(CANONICAL_AUTH_PARAGRAPH)) {
    return [
      {
        file,
        rule: 'auth.canonical_paragraph',
        message: `${file}: ## Authentication section must contain the canonical authentication paragraph verbatim`,
      },
    ];
  }
  return [];
}

export function validateForbiddenTokens(file: string, body: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const token of FORBIDDEN_TOKENS) {
    if (body.includes(token)) {
      issues.push({
        file,
        rule: 'forbidden.legacy_auth',
        message: `${file}: forbidden legacy-auth reference "${token}" — references must use portal-login JWT only`,
      });
    }
  }
  const lower = body.toLowerCase();
  for (const phrase of FORBIDDEN_CASE_INSENSITIVE) {
    if (lower.includes(phrase)) {
      issues.push({
        file,
        rule: 'forbidden.legacy_auth',
        message: `${file}: forbidden legacy-auth phrase "${phrase}" (case-insensitive) — references must use portal-login JWT only`,
      });
    }
  }
  return issues;
}

export function validatePlaceholderSubstitution(
  file: string,
  body: string,
  scope: Scope
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stripped = stripCodeFences(body);
  if (scope === 'project' || scope === 'runtime' || scope === 'pdf') {
    if (stripped.includes('{{baseUrl}}/{{projectName}}')) {
      issues.push({
        file,
        rule: 'placeholder.project',
        message: `${file}: Postman placeholder "{{baseUrl}}/{{projectName}}" must be resolved to \${FORMIO_PROJECT_URL}`,
      });
    }
  }
  if (scope === 'platform') {
    const bareBaseUrl = /\{\{baseUrl\}\}\/(?!\{\{projectName\}\})/;
    if (bareBaseUrl.test(stripped)) {
      issues.push({
        file,
        rule: 'placeholder.platform',
        message: `${file}: bare "{{baseUrl}}/" Postman placeholder must be resolved to \${FORMIO_BASE_URL}`,
      });
    }
  }
  return issues;
}

export function validatePdfProxyPath(file: string, body: string, scope: Scope): ValidationIssue[] {
  if (scope !== 'pdf') return [];
  const issues: ValidationIssue[] = [];
  const headingRegex = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(body)) !== null) {
    const pathPart = match[2];
    if (!pathPart.startsWith('${FORMIO_PROJECT_URL}/pdf-proxy')) {
      issues.push({
        file,
        rule: 'pdf.proxy_path',
        message: `${file}: pdf-scope endpoint "${match[0].trim()}" must begin with \${FORMIO_PROJECT_URL}/pdf-proxy — "PDF server direct API" is out of scope`,
      });
    }
  }
  return issues;
}

export function validateTerminology(file: string, body: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stripped = stripCodeFences(body);
  const projectMisuseRegex =
    /\b(baseUrl|base_url)\b[^.\n]*\b(project endpoint|project URL|project-scoped)\b/i;
  const platformMisuseRegex =
    /\b(projectUrl|project_url)\b[^.\n]*\b(platform endpoint|platform deployment|base URL|platform-scoped)\b/i;
  if (projectMisuseRegex.test(stripped)) {
    issues.push({
      file,
      rule: 'terminology.baseUrl_for_project',
      message: `${file}: "baseUrl"/"base_url" is reserved for the platform deployment endpoint. Use "projectUrl" or \${FORMIO_PROJECT_URL} to refer to the project endpoint.`,
    });
  }
  if (platformMisuseRegex.test(stripped)) {
    issues.push({
      file,
      rule: 'terminology.projectUrl_for_platform',
      message: `${file}: "projectUrl"/"project_url" is reserved for the project endpoint. Use "baseUrl" or \${FORMIO_BASE_URL} to refer to the platform deployment endpoint.`,
    });
  }
  return issues;
}

const RANDOM_ID_TITLE_REGEX = /"title"\s*:\s*"[^"\n]*[A-Za-z]\s\d{2,}"/g;
const RANDOM_ID_SLUG_REGEX =
  /"(name|path|key|machineName)"\s*:\s*"[^"\n]*?[A-Za-z][A-Za-z0-9]*-\d{2,}(?=["/:])/g;

export function validateNoRandomIdSuffixes(file: string, body: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const report = (match: RegExpExecArray) => {
    const snippet = match[0];
    if (seen.has(snippet)) return;
    seen.add(snippet);
    issues.push({
      file,
      rule: 'content.random_id_suffix',
      message: `${file}: example value contains a collision-avoidance integer suffix (${snippet}); strip the "-<digits>" or " <digits>" suffix for clean canonical examples`,
    });
  };
  let m: RegExpExecArray | null;
  RANDOM_ID_TITLE_REGEX.lastIndex = 0;
  while ((m = RANDOM_ID_TITLE_REGEX.exec(body)) !== null) report(m);
  RANDOM_ID_SLUG_REGEX.lastIndex = 0;
  while ((m = RANDOM_ID_SLUG_REGEX.exec(body)) !== null) report(m);
  return issues;
}

export function validateReferenceContent(
  filename: string,
  source: string,
  group: ReferenceGroup
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data, body } = parseSkillFile(source);
  issues.push(...validateReferenceHasNoFrontmatter(filename, data));
  issues.push(...validateRequiredHeadings(filename, body));
  issues.push(...validateCanonicalAuthParagraph(filename, body, group));
  issues.push(...validateForbiddenTokens(filename, body));
  const scope = GROUP_SCOPE[group];
  issues.push(...validatePlaceholderSubstitution(filename, body, scope));
  issues.push(...validatePdfProxyPath(filename, body, scope));
  issues.push(...validateTerminology(filename, body));
  issues.push(...validateNoRandomIdSuffixes(filename, body));
  return issues;
}

export function validateRouterSkillContent(filename: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data, body } = parseSkillFile(source);
  issues.push(...validateRouterFrontmatter(filename, data));
  issues.push(...validateRouterDescriptionTriggers(filename, data));
  issues.push(...validateForbiddenTokens(filename, body));
  issues.push(...validateTerminology(filename, body));
  return issues;
}

export function validateRequiredFiles(libraryDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const routerFull = routerSkillPath(libraryDir);
  const routerRel = path.relative(libraryDir, routerFull);
  if (!fs.existsSync(routerFull)) {
    issues.push({
      file: routerRel,
      rule: 'library.required_file',
      message: `${routerFull}: required router skill file is missing`,
    });
  } else if (fs.statSync(routerFull).size === 0) {
    issues.push({
      file: routerRel,
      rule: 'library.required_file',
      message: `${routerFull}: router skill file is empty`,
    });
  }

  for (const group of REQUIRED_REFERENCE_GROUPS) {
    const full = referencePath(libraryDir, group);
    const rel = path.relative(libraryDir, full);
    if (!fs.existsSync(full)) {
      issues.push({
        file: rel,
        rule: 'library.required_file',
        message: `${full}: required reference file is missing`,
      });
      continue;
    }
    if (fs.statSync(full).size === 0) {
      issues.push({
        file: rel,
        rule: 'library.required_file',
        message: `${full}: reference file is empty`,
      });
    }
  }
  return issues;
}

export function validateRouterLinks(libraryDir: string): ValidationIssue[] {
  const routerFull = routerSkillPath(libraryDir);
  const routerRel = path.relative(libraryDir, routerFull);
  const issues: ValidationIssue[] = [];
  if (!fs.existsSync(routerFull)) return issues;
  const body = fs.readFileSync(routerFull, 'utf8');

  for (const group of REQUIRED_REFERENCE_GROUPS) {
    const linkPattern = new RegExp(`\\]\\(\\.?/?${REFERENCES_DIRNAME}/${group}\\.md\\)`);
    if (!linkPattern.test(body)) {
      issues.push({
        file: routerRel,
        rule: 'index.missing_link',
        message: `${routerFull}: router must link to "./${REFERENCES_DIRNAME}/${group}.md"`,
      });
    }
  }

  const linkRegex = new RegExp(`\\]\\((\\.?/?${REFERENCES_DIRNAME}/[\\w.-]+\\.md)\\)`, 'g');
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(body)) !== null) {
    const target = linkMatch[1].replace(/^\.\//, '');
    const targetPath = path.join(libraryDir, ROUTER_DIR, target);
    if (!fs.existsSync(targetPath)) {
      issues.push({
        file: routerRel,
        rule: 'index.broken_link',
        message: `${routerFull}: link target "${target}" does not exist`,
      });
    }
  }

  const endpointHeadingRegex = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+\S+/m;
  if (endpointHeadingRegex.test(body)) {
    issues.push({
      file: routerRel,
      rule: 'index.no_endpoint_docs',
      message: `${routerFull}: router must not contain endpoint method/path headings — those belong in reference docs`,
    });
  }

  return issues;
}

export function validateLibrary(libraryDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...validateRequiredFiles(libraryDir));
  issues.push(...validateRouterLinks(libraryDir));
  if (!fs.existsSync(libraryDir)) return issues;

  const routerFull = routerSkillPath(libraryDir);
  if (fs.existsSync(routerFull)) {
    const source = fs.readFileSync(routerFull, 'utf8');
    const rel = path.relative(libraryDir, routerFull);
    issues.push(...validateRouterSkillContent(rel, source));
  }

  for (const group of REQUIRED_REFERENCE_GROUPS) {
    const full = referencePath(libraryDir, group);
    if (!fs.existsSync(full)) continue;
    const source = fs.readFileSync(full, 'utf8');
    const rel = path.relative(libraryDir, full);
    issues.push(...validateReferenceContent(rel, source, group));
  }

  issues.push(...validateFormioSdkSkill(libraryDir));
  return issues;
}

// =============================================================================
// formio-sdk skill validation
// =============================================================================

export const SDK_SKILL_DIR = 'formio-sdk';

export const SDK_REQUIRED_REFERENCES = [
  'setup.md',
  'auth.md',
  'forms.md',
  'submissions.md',
  'projects.md',
  'roles.md',
  'files.md',
  'plugins.md',
  'rendering.md',
  'utils-evaluator.md',
  'utils-form-traversal.md',
  'utils-conditions.md',
  'utils-logic.md',
  'utils-jsonlogic.md',
  'utils-mask-sanitize.md',
  'utils-misc.md',
] as const;

export type SdkReference = (typeof SDK_REQUIRED_REFERENCES)[number];

export const SDK_SIBLING_SKILLS = [
  'formio-api',
  'formio-application',
  'formio-resource-planner',
  'formio-angular',
] as const;

export const SDK_REQUIRED_HEADINGS = [
  '## Overview',
  '## Imports',
  '## API',
  '## Examples',
] as const;

export const SDK_CANONICAL_SDK_IMPORT = "import { Formio } from '@formio/js'";
export const SDK_CANONICAL_UTILS_IMPORT = "import { Utils } from '@formio/js/utils'";

export const SDK_HOSTED_BASE_URL_LITERAL = "setBaseUrl('https://forms.mysite.com')";
export const SDK_HOSTED_PROJECT_URL_LITERAL = "setProjectUrl('https://forms.mysite.com/myproject')";
export const SDK_SAAS_BASE_URL_LITERAL = "setBaseUrl('https://api.form.io')";
export const SDK_SAAS_PROJECT_URL_LITERAL = "setProjectUrl('https://myproject.form.io')";

function isUtilsReference(name: string): boolean {
  return name.startsWith('utils-');
}

interface CodeBlock {
  lang: string;
  body: string;
}

function extractFencedBlocks(source: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    blocks.push({ lang: match[1] || '', body: match[2] });
  }
  return blocks;
}

export function validateFormioSdkFrontmatter(file: string, data: unknown): ValidationIssue[] {
  if (!isRecord(data) || Object.keys(data).length === 0) {
    return [
      {
        file,
        rule: 'formio_sdk.frontmatter_missing',
        message: `${file}: formio-sdk SKILL.md must declare YAML frontmatter (name + description)`,
      },
    ];
  }
  const issues: ValidationIssue[] = [];
  if (typeof data.name !== 'string' || data.name !== SDK_SKILL_DIR) {
    issues.push({
      file,
      rule: 'formio_sdk.frontmatter_missing',
      message: `${file}: formio-sdk frontmatter.name must equal "${SDK_SKILL_DIR}"`,
    });
  }
  if (typeof data.description !== 'string' || data.description === '') {
    issues.push({
      file,
      rule: 'formio_sdk.frontmatter_missing',
      message: `${file}: formio-sdk frontmatter.description must be a non-empty string`,
    });
  }
  return issues;
}

export function validateFormioSdkDescription(file: string, data: unknown): ValidationIssue[] {
  if (!isRecord(data) || typeof data.description !== 'string') return [];
  const description = data.description;
  const issues: ValidationIssue[] = [];

  const mentionsSdk = description.includes('@formio/js');
  const mentionsUtils = description.includes('@formio/js/utils');
  if (!mentionsSdk || !mentionsUtils) {
    issues.push({
      file,
      rule: 'formio_sdk.description_clause',
      message: `${file}: clause: "capability" — description must name both @formio/js and @formio/js/utils`,
    });
  }

  if (!description.includes('Use when the user asks to')) {
    issues.push({
      file,
      rule: 'formio_sdk.description_clause',
      message: `${file}: clause: "trigger" — description must contain "Use when the user asks to …"`,
    });
  }

  if (!description.includes('Not for:')) {
    issues.push({
      file,
      rule: 'formio_sdk.description_clause',
      message: `${file}: clause: "negative" — description must contain a "Not for: …" clause naming sibling skills`,
    });
  } else {
    const missingSiblings = SDK_SIBLING_SKILLS.filter((s) => !description.includes(s));
    if (missingSiblings.length > 0) {
      issues.push({
        file,
        rule: 'formio_sdk.description_clause',
        message: `${file}: clause: "negative" — "Not for:" clause must name sibling skills [${missingSiblings.join(', ')}]`,
      });
    }
  }

  return issues;
}

export function validateFormioSdkCanonicalImports(file: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!source.includes(SDK_CANONICAL_SDK_IMPORT)) {
    issues.push({
      file,
      rule: 'formio_sdk.canonical_import_missing',
      message: `${file}: which: "sdk" — must contain canonical import \`${SDK_CANONICAL_SDK_IMPORT}\``,
    });
  }
  if (!source.includes(SDK_CANONICAL_UTILS_IMPORT)) {
    issues.push({
      file,
      rule: 'formio_sdk.canonical_import_missing',
      message: `${file}: which: "utils" — must contain canonical import \`${SDK_CANONICAL_UTILS_IMPORT}\``,
    });
  }
  return issues;
}

const FORBIDDEN_IMPORT_PATTERNS: { regex: RegExp; pathFn: (m: RegExpMatchArray) => string }[] = [
  { regex: /from\s+['"](@formio\/core)['"]/g, pathFn: () => '@formio/core' },
  { regex: /from\s+['"](@formio\/js\/lib\/[^'"]+)['"]/g, pathFn: (m) => m[1] },
  { regex: /require\(\s*['"](@formio\/js(?:\/utils)?)['"]\s*\)/g, pathFn: (m) => m[1] },
];

export function validateFormioSdkForbiddenImports(file: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blocks = extractFencedBlocks(source);
  for (const block of blocks) {
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.regex.exec(block.body)) !== null) {
        const importPath = pattern.pathFn(m);
        issues.push({
          file,
          rule: 'formio_sdk.forbidden_import',
          message: `${file}: import_path: "${importPath}" — forbidden import; use canonical \`${SDK_CANONICAL_SDK_IMPORT}\` or \`${SDK_CANONICAL_UTILS_IMPORT}\` only`,
        });
      }
    }
  }
  return issues;
}

export function validateFormioSdkScriptTags(file: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blocks = extractFencedBlocks(source);
  for (const block of blocks) {
    if (/<script\b[^>]*\bsrc\s*=/i.test(block.body)) {
      issues.push({
        file,
        rule: 'formio_sdk.forbidden_script_tag',
        message: `${file}: rendering examples must use ESM \`import\`, not <script src="..."> tags`,
      });
    }
  }
  return issues;
}

export function validateFormioSdkUrlConfigSkill(file: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hostedOk =
    source.includes(SDK_HOSTED_BASE_URL_LITERAL) && source.includes(SDK_HOSTED_PROJECT_URL_LITERAL);
  if (!hostedOk) {
    issues.push({
      file,
      rule: 'formio_sdk.url_config_missing',
      message: `${file}: environment: "hosted" — SKILL.md must show Hosted block calling \`${SDK_HOSTED_BASE_URL_LITERAL}\` and \`${SDK_HOSTED_PROJECT_URL_LITERAL}\``,
    });
  }
  const saasOk =
    source.includes(SDK_SAAS_BASE_URL_LITERAL) && source.includes(SDK_SAAS_PROJECT_URL_LITERAL);
  if (!saasOk) {
    issues.push({
      file,
      rule: 'formio_sdk.url_config_missing',
      message: `${file}: environment: "saas" — SKILL.md must show SaaS block calling \`${SDK_SAAS_BASE_URL_LITERAL}\` and \`${SDK_SAAS_PROJECT_URL_LITERAL}\``,
    });
  }
  return issues;
}

function extractSection(body: string, heading: string): string | null {
  const lines = body.split('\n');
  const startIdx = lines.findIndex((l) => l.trimStart() === heading);
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i].trimStart())) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

export function validateFormioSdkUrlConfigReference(
  file: string,
  source: string,
  name: SdkReference
): ValidationIssue[] {
  if (isUtilsReference(name)) return [];
  const section = extractSection(source, '## URL Configuration');
  if (section === null) {
    return [
      {
        file,
        rule: 'formio_sdk.url_config_missing',
        message: `${file}: environment: "hosted+saas" — SDK reference must include a \`## URL Configuration\` section`,
      },
    ];
  }
  const issues: ValidationIssue[] = [];
  const hostedOk =
    section.includes(SDK_HOSTED_BASE_URL_LITERAL) &&
    section.includes(SDK_HOSTED_PROJECT_URL_LITERAL);
  if (!hostedOk) {
    issues.push({
      file,
      rule: 'formio_sdk.url_config_missing',
      message: `${file}: environment: "hosted" — \`## URL Configuration\` must include the Hosted example`,
    });
  }
  const saasOk =
    section.includes(SDK_SAAS_BASE_URL_LITERAL) && section.includes(SDK_SAAS_PROJECT_URL_LITERAL);
  if (!saasOk) {
    issues.push({
      file,
      rule: 'formio_sdk.url_config_missing',
      message: `${file}: environment: "saas" — \`## URL Configuration\` must include the SaaS example`,
    });
  }
  return issues;
}

export function validateFormioSdkReferenceLayout(
  file: string,
  body: string,
  name: SdkReference
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required: string[] = ['## Overview', '## Imports'];
  if (!isUtilsReference(name)) required.push('## URL Configuration');
  required.push('## API', '## Examples');

  const lines = body.split('\n');
  const positions = required.map((h) => lines.findIndex((l) => l.trimStart() === h));
  for (let i = 0; i < required.length; i++) {
    if (positions[i] === -1) {
      issues.push({
        file,
        rule: 'formio_sdk.reference_layout',
        message: `${file}: rule: "missing" — missing required heading \`${required[i]}\``,
      });
    }
  }
  for (let i = 1; i < required.length; i++) {
    const prev = positions[i - 1];
    const cur = positions[i];
    if (prev !== -1 && cur !== -1 && cur < prev) {
      issues.push({
        file,
        rule: 'formio_sdk.reference_layout',
        message: `${file}: rule: "order" — \`${required[i]}\` appears before \`${required[i - 1]}\``,
      });
    }
  }

  const overview = extractSection(body, '## Overview');
  if (overview !== null && !/Sourced from\s+`packages\//.test(overview)) {
    issues.push({
      file,
      rule: 'formio_sdk.reference_layout',
      message: `${file}: rule: "missing_source_attribution" — \`## Overview\` must include \`Sourced from \\\`packages/...\\\`\` attribution`,
    });
  }

  return issues;
}

export function validateFormioSdkNavigationTable(file: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = source.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('|') && l.includes('Intent') && l.includes('Reference')) {
      const next = lines[i + 1];
      if (next && /\|\s*[-:]+\s*\|/.test(next)) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx === -1) {
    issues.push({
      file,
      rule: 'formio_sdk.navigation_table_missing',
      message: `${file}: SKILL.md must include a Markdown table with \`Intent\` and \`Reference\` columns linking to each required reference`,
    });
    return issues;
  }
  const tableBody = lines.slice(headerIdx).join('\n');
  for (const ref of SDK_REQUIRED_REFERENCES) {
    const linkPattern = new RegExp(`\\]\\(\\.?/?references/${ref.replace('.', '\\.')}\\)`);
    if (!linkPattern.test(tableBody)) {
      issues.push({
        file,
        rule: 'formio_sdk.navigation_table_missing',
        message: `${file}: navigation table must link to \`references/${ref}\``,
      });
    }
  }
  return issues;
}

export function validateFormioSdkRenderingReference(
  file: string,
  source: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const blocks = extractFencedBlocks(source);
  const hasCreateForm = blocks.some((b) => b.body.includes('Formio.createForm('));
  if (!hasCreateForm) {
    issues.push({
      file,
      rule: 'formio_sdk.rendering_entry_missing',
      message: `${file}: rendering.md must include a fenced code block calling \`Formio.createForm(\``,
    });
  }
  return issues;
}

export function validateFormioSdkReferences(libraryDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refsDir = path.join(libraryDir, SDK_SKILL_DIR, REFERENCES_DIRNAME);
  for (const ref of SDK_REQUIRED_REFERENCES) {
    const full = path.join(refsDir, ref);
    const rel = path.join(SDK_SKILL_DIR, REFERENCES_DIRNAME, ref);
    if (!fs.existsSync(full)) {
      issues.push({
        file: rel,
        rule: 'formio_sdk.reference_missing',
        message: `${rel}: required formio-sdk reference is missing`,
      });
      continue;
    }
    if (fs.statSync(full).size === 0) {
      issues.push({
        file: rel,
        rule: 'formio_sdk.reference_missing',
        message: `${rel}: required formio-sdk reference is empty`,
      });
      continue;
    }
    const source = fs.readFileSync(full, 'utf8');
    issues.push(...validateFormioSdkReferenceLayout(rel, source, ref));
    issues.push(...validateFormioSdkUrlConfigReference(rel, source, ref));
    issues.push(...validateFormioSdkForbiddenImports(rel, source));
    issues.push(...validateFormioSdkScriptTags(rel, source));
    if (ref === 'rendering.md') {
      issues.push(...validateFormioSdkRenderingReference(rel, source));
    }
  }
  return issues;
}

export function validateFormioSdkSkillContent(file: string, source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { data, body: _body } = parseSkillFile(source);
  void _body;
  issues.push(...validateFormioSdkFrontmatter(file, data));
  issues.push(...validateFormioSdkDescription(file, data));
  issues.push(...validateFormioSdkCanonicalImports(file, source));
  issues.push(...validateFormioSdkForbiddenImports(file, source));
  issues.push(...validateFormioSdkScriptTags(file, source));
  issues.push(...validateFormioSdkUrlConfigSkill(file, source));
  issues.push(...validateFormioSdkNavigationTable(file, source));
  return issues;
}

export function validateFormioSdkSkill(libraryDir: string): ValidationIssue[] {
  const skillDir = path.join(libraryDir, SDK_SKILL_DIR);
  if (!fs.existsSync(skillDir)) return [];

  const issues: ValidationIssue[] = [];
  const skillFile = path.join(skillDir, SKILL_FILENAME);
  const skillRel = path.join(SDK_SKILL_DIR, SKILL_FILENAME);

  if (!fs.existsSync(skillFile)) {
    issues.push({
      file: skillRel,
      rule: 'formio_sdk.skill_missing',
      message: `${skillRel}: formio-sdk SKILL.md is missing`,
    });
  } else {
    const source = fs.readFileSync(skillFile, 'utf8');
    issues.push(...validateFormioSdkSkillContent(skillRel, source));
  }

  issues.push(...validateFormioSdkReferences(libraryDir));
  return issues;
}
