// The library validator `api-skills-validation` has always specified and nothing
// has run since it was deleted in April 2026 ("Delete superfluous failing tests").
// Every rule in that capability was unchecked prose for four months, which is how
// 24 substitution slots and 24 handoff values kept environment-variable names
// through a rework whose whole subject was that spelling.
//
// Rebuilt here rather than in `packages/mcp-server`: a validator for the skills
// library belongs to the package that exists to test the skills library, and
// living in the server package is what let it be deleted as "superfluous" to the
// server.
//
// Issues are `<category>.<rule>` with a path and, where it is knowable, a line.
// Every rule is a pure function over already-read text so it can be exercised on
// synthetic input.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  TerminologyDocument,
  urlTerminologyIssues,
} from '../skill-descriptions/url-terminology.js';

export interface LibraryIssue {
  path: string;
  rule: string;
  message: string;
  line?: number;
}

export const REQUIRED_REFERENCE_HEADINGS = [
  '## Overview',
  '## Root URL',
  '## Authentication',
  '## MCP Tool Preference',
  '## Endpoints',
] as const;

export const CANONICAL_AUTH_PARAGRAPH =
  "Every request to these endpoints MUST include an `x-jwt-token` header holding the user JWT issued by the MCP server's browser-based portal-login flow. The MCP server attaches this header automatically via `formioFetch`; external clients must obtain the JWT through the same portal-login flow. Do not use any other authentication mechanism with these endpoints.";

// Unauthenticated by design: `health` and `status` reject a token rather than
// requiring one, so the canonical paragraph would be a false statement there.
const UNAUTHENTICATED_REFERENCES = ['server-status.md'];

// Portal-login JWT is the only mechanism these endpoints document. An API key is a
// real server feature, but a reference that mentions one invites an agent to reach
// for auth the tools do not use.
const FORBIDDEN_AUTH_TOKENS = ['x-token', 'FORMIO_API_KEY'];

const ENDPOINT_HEADING = /^### (?:GET|POST|PUT|PATCH|DELETE) (.+)$/;

// Values in example JSON that a test-collision suffix would spoil. A canonical
// example reads as something a person wrote.
const SUFFIXED_EXAMPLE_KEYS = ['title', 'name', 'path', 'key', 'machineName'];

function lineOf(body: string, needle: string): number {
  const index = body.split('\n').findIndex((line) => line.includes(needle));
  return index === -1 ? 1 : index + 1;
}

export function validateReferenceLayout(path: string, body: string): LibraryIssue[] {
  const issues: LibraryIssue[] = [];
  const positions = REQUIRED_REFERENCE_HEADINGS.map((heading) => ({
    heading,
    at: body.indexOf(`${heading}\n`),
  }));

  for (const { heading, at } of positions) {
    if (at === -1) {
      issues.push({
        path,
        rule: 'headings.missing',
        message: `missing required heading ${heading}`,
      });
    }
  }

  const present = positions.filter(({ at }) => at !== -1);
  const ordered = [...present].sort((a, b) => a.at - b.at);
  if (present.map((entry) => entry.heading).join('|') !== ordered.map((e) => e.heading).join('|')) {
    issues.push({
      path,
      rule: 'headings.order',
      message: `required headings are out of order: found ${ordered.map((e) => e.heading).join(', ')}`,
    });
  }

  return issues;
}

export function validateAuthParagraph(path: string, body: string): LibraryIssue[] {
  if (UNAUTHENTICATED_REFERENCES.some((name) => path.endsWith(name))) {
    return [];
  }
  return body.includes(CANONICAL_AUTH_PARAGRAPH)
    ? []
    : [
        {
          path,
          rule: 'auth.canonical_paragraph',
          message: 'does not carry the canonical portal-login auth paragraph verbatim',
          line: body.indexOf('## Authentication') === -1 ? 1 : lineOf(body, '## Authentication'),
        },
      ];
}

export function validateForbiddenTokens(path: string, body: string): LibraryIssue[] {
  return FORBIDDEN_AUTH_TOKENS.filter((token) => body.includes(token)).map((token) => ({
    path,
    rule: 'forbidden.legacy_auth',
    message: `names ${token}; portal-login JWT is the only documented mechanism`,
    line: lineOf(body, token),
  }));
}

// Only the proxy surface is in scope. The PDF server's own direct API is a separate
// deployment an agent has no route to from a project URL.
export function validatePdfProxyPath(path: string, body: string): LibraryIssue[] {
  if (!path.endsWith('pdf-api.md')) {
    return [];
  }
  return body
    .split('\n')
    .map((line, index) => ({ match: line.match(ENDPOINT_HEADING), index }))
    .filter(({ match }) => match && !match[1].startsWith('{projectUrl}/pdf-proxy'))
    .map(({ match, index }) => ({
      path,
      rule: 'pdf.proxy_path',
      message: `endpoint ${match?.[1]} is not under {projectUrl}/pdf-proxy`,
      line: index + 1,
    }));
}

// A trailing integer on an example value is almost always collision avoidance
// leaking out of a test run. The exclusions are the cases where digits carry
// meaning: hex ids, UUIDs, PDF overlay field keys, and a single-digit token that is
// part of the name (`email2`).
export function validateNoRandomIdSuffixes(path: string, body: string): LibraryIssue[] {
  const issues: LibraryIssue[] = [];
  const pattern = new RegExp(`"(${SUFFIXED_EXAMPLE_KEYS.join('|')})"\\s*:\\s*"([^"]*)"`, 'g');

  body.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(pattern)) {
      const value = match[2];
      const suffix = value.match(/(?:-| )(\d{2,})$/);
      if (!suffix) continue;
      if (/^[0-9a-f]{24}$/.test(value)) continue;
      if (/^[0-9a-f-]{36}$/.test(value)) continue;
      if (/^f\d/.test(value)) continue;
      issues.push({
        path,
        rule: 'content.random_id_suffix',
        message: `example ${match[1]} "${value}" ends in a collision-avoidance suffix`,
        line: index + 1,
      });
    }
  });

  return issues;
}

function fencedBlocks(body: string): string[] {
  return [...body.matchAll(/```[\s\S]*?```/g)].map((match) => match[0]);
}

// Deep imports and CommonJS reach past the package's public surface, which the
// skill exists to document. Checked inside fenced code only: the prose is allowed
// to discuss `@formio/core`, because explaining where the renderer's SDK comes from
// is part of the skill's job.
const FORBIDDEN_SDK_IMPORTS: { pattern: RegExp; importPath: string }[] = [
  { pattern: /from\s+['"]@formio\/js\/lib\//, importPath: '@formio/js/lib/' },
  { pattern: /require\(\s*['"]@formio\/js['"]\s*\)/, importPath: '@formio/js' },
  { pattern: /require\(\s*['"]@formio\/js\/utils['"]\s*\)/, importPath: '@formio/js/utils' },
];

// `@formio/core` is not banned outright, and a rule that banned it would contradict
// the skill it validates: the SDK skill documents a short, named list of helpers
// that `@formio/js` does not re-export, and importing those from core is the
// sanctioned fallback it teaches. What stays forbidden is reaching into core for a
// surface `@formio/js` DOES expose — a default or namespace import, or a named
// import outside that list — because that is how a reader ends up depending on an
// internal package the renderer merely happens to be built on.
export const SANCTIONED_CORE_IMPORTS = [
  'jsonLogic',
  'dom',
  'I18n',
  'override',
  'unwind',
  'sanitize',
  'logicProcessSync',
  'logicProcessInfo',
  'DefaultEvaluator',
] as const;

const CORE_IMPORT = /import\s+([^;]+?)\s+from\s+['"]@formio\/core(?:\/[\w-]+)?['"]/g;

function coreImportIssues(path: string, block: string): LibraryIssue[] {
  return [...block.matchAll(CORE_IMPORT)].flatMap((match) => {
    const clause = match[1].trim();
    const named = clause.match(/^\{([^}]*)\}$/);
    if (!named) {
      return [
        {
          path,
          rule: 'formio_sdk.forbidden_import',
          message: `fenced code takes a default or namespace import from @formio/core (${clause})`,
        },
      ];
    }
    const sanctioned = new Set<string>(SANCTIONED_CORE_IMPORTS);
    return named[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/)[0])
      .filter((name) => name && !sanctioned.has(name))
      .map((name) => ({
        path,
        rule: 'formio_sdk.forbidden_import',
        message: `fenced code imports ${name} from @formio/core, which is not one of the sanctioned core-only helpers`,
      }));
  });
}

export function validateFormioSdkSkill(libraryDir: string): LibraryIssue[] {
  const skillDir = join(libraryDir, 'formio-sdk');
  if (!existsSync(skillDir)) {
    return [];
  }

  const issues: LibraryIssue[] = [];
  const skillMdPath = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    return [
      { path: 'formio-sdk/SKILL.md', rule: 'formio_sdk.skill_missing', message: 'SKILL.md absent' },
    ];
  }

  const skillMd = readFileSync(skillMdPath, 'utf8');
  if (!/^---\n[\s\S]*?\n---/.test(skillMd)) {
    issues.push({
      path: 'formio-sdk/SKILL.md',
      rule: 'formio_sdk.frontmatter_missing',
      message: 'no YAML frontmatter block',
    });
  }

  // The canonical imports the skill mandates. Anything else — a default import, a
  // deep path, a require — is what the forbidden list below catches.
  for (const [which, needle] of [
    ['sdk', "import { Formio } from '@formio/js'"],
    ['utils', "import { Utils } from '@formio/js/utils'"],
  ] as const) {
    if (!skillMd.includes(needle)) {
      issues.push({
        path: 'formio-sdk/SKILL.md',
        rule: 'formio_sdk.canonical_import_missing',
        message: `SKILL.md does not show the canonical ${which} import (${needle})`,
      });
    }
  }

  for (const file of readdirSync(skillDir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.md')) continue;
    const path = `formio-sdk/${file.split(/[/\\]/).join('/')}`;
    const body = readFileSync(join(skillDir, file), 'utf8');
    for (const block of fencedBlocks(body)) {
      for (const { pattern, importPath } of FORBIDDEN_SDK_IMPORTS) {
        if (pattern.test(block)) {
          issues.push({
            path,
            rule: 'formio_sdk.forbidden_import',
            message: `fenced code imports ${importPath}`,
          });
        }
      }
      issues.push(...coreImportIssues(path, block));
    }
  }

  return issues;
}

function referencePaths(referencesDir: string): string[] {
  if (!existsSync(referencesDir)) {
    return [];
  }
  return readdirSync(referencesDir).filter((name) => name.endsWith('.md'));
}

function markdownUnder(dir: string): TerminologyDocument[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownUnder(full);
    if (!entry.isFile() || !entry.name.endsWith('.md')) return [];
    return [{ path: full, body: readFileSync(full, 'utf8') }];
  });
}

// `libraryDir` is a skills root — `plugin/skills` in this repository, or a
// consumer's own copy of it.
export function validateLibrary(libraryDir: string): LibraryIssue[] {
  const issues: LibraryIssue[] = [];
  const referencesDir = join(libraryDir, 'formio-api', 'references');

  for (const name of referencePaths(referencesDir)) {
    const path = `formio-api/references/${name}`;
    const body = readFileSync(join(referencesDir, name), 'utf8');
    issues.push(
      ...validateReferenceLayout(path, body),
      ...validateAuthParagraph(path, body),
      ...validateForbiddenTokens(path, body),
      ...validatePdfProxyPath(path, body),
      ...validateNoRandomIdSuffixes(path, body)
    );
  }

  issues.push(
    ...urlTerminologyIssues(markdownUnder(libraryDir)).map((issue) => ({
      path: issue.path,
      rule: issue.rule,
      message: issue.message,
      line: issue.line,
    }))
  );

  issues.push(...validateFormioSdkSkill(libraryDir));

  return issues;
}
