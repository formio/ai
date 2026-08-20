// `api-skills-validation` requires a suite that invokes `validateLibrary` over the
// shipped library and fails the run on any issue. It had none: the implementation
// was deleted in April 2026 and the capability kept specifying it, so every rule in
// it — layout, the canonical auth paragraph, resolved placeholders, PDF scope, URL
// terminology — was prose nothing checked.

import { describe, expect, it } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_AUTH_PARAGRAPH,
  validateFormioSdkSkill,
  validateAuthParagraph,
  validateForbiddenTokens,
  validateLibrary,
  validateNoRandomIdSuffixes,
  validatePdfProxyPath,
  validateReferenceLayout,
} from './validate-library.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');

const REFERENCE = [
  '## Overview',
  'text',
  '## Root URL',
  'rooted at `{projectUrl}`',
  '## Authentication',
  CANONICAL_AUTH_PARAGRAPH,
  '## MCP Tool Preference',
  'prefer the tools',
  '## Endpoints',
  '### GET {projectUrl}/form',
].join('\n\n');

describe('reference layout', () => {
  it('accepts the required headings in order', () => {
    expect(validateReferenceLayout('r.md', REFERENCE)).toEqual([]);
  });

  it('names a missing heading', () => {
    const issues = validateReferenceLayout(
      'r.md',
      REFERENCE.replace('## MCP Tool Preference\n', '')
    );

    expect(issues[0].rule).toBe('headings.missing');
    expect(issues[0].message).toContain('## MCP Tool Preference');
  });

  // `indexOf('## Endpoints\n')` matches inside `### Endpoints\n`, so a demoted
  // heading passed as present — a layout rule that accepts the layout it exists to
  // reject.
  it('does not accept a required heading demoted to level 3', () => {
    const issues = validateReferenceLayout(
      'r.md',
      REFERENCE.replace('## MCP Tool Preference', '### MCP Tool Preference')
    );

    expect(issues.map((issue) => issue.rule)).toContain('headings.missing');
  });

  it('accepts a required heading on the last line, with nothing after it', () => {
    const endsOnAHeading = REFERENCE.replace('\n\n### GET {projectUrl}/form', '');

    expect(validateReferenceLayout('r.md', endsOnAHeading)).toEqual([]);
  });

  it('reports headings that appear out of order', () => {
    const swapped = [
      '## Overview',
      '## Root URL',
      '## Endpoints',
      '## Authentication',
      '## MCP Tool Preference',
    ].join('\n\n');

    expect(validateReferenceLayout('r.md', swapped).map((issue) => issue.rule)).toContain(
      'headings.order'
    );
  });
});

describe('the canonical auth paragraph', () => {
  it('is required verbatim', () => {
    expect(validateAuthParagraph('r.md', REFERENCE)).toEqual([]);
    expect(
      validateAuthParagraph('r.md', REFERENCE.replace(CANONICAL_AUTH_PARAGRAPH, 'send a token'))[0]
        .rule
    ).toBe('auth.canonical_paragraph');
  });

  // health and status reject a token rather than requiring one, so the paragraph
  // would be a false statement there.
  it('exempts server-status, whose endpoints are unauthenticated', () => {
    expect(validateAuthParagraph('formio-api/references/server-status.md', '## Overview')).toEqual(
      []
    );
  });
});

describe('legacy auth mechanisms', () => {
  it.each(['x-token', 'FORMIO_API_KEY'])('rejects %s', (token) => {
    const issues = validateForbiddenTokens('r.md', `pass ${token} in the header`);

    expect(issues[0].rule).toBe('forbidden.legacy_auth');
  });

  it('accepts the portal-login header', () => {
    expect(validateForbiddenTokens('r.md', 'pass `x-jwt-token`')).toEqual([]);
  });
});

describe('PDF scope', () => {
  it('requires every pdf-api endpoint under the proxy', () => {
    const issues = validatePdfProxyPath(
      'formio-api/references/pdf-api.md',
      '### GET {projectUrl}/file'
    );

    expect(issues[0].rule).toBe('pdf.proxy_path');
  });

  it('accepts a proxy-rooted endpoint, and ignores other references', () => {
    expect(
      validatePdfProxyPath(
        'formio-api/references/pdf-api.md',
        '### GET {projectUrl}/pdf-proxy/file'
      )
    ).toEqual([]);
    expect(
      validatePdfProxyPath('formio-api/references/project-forms.md', '### GET {projectUrl}/file')
    ).toEqual([]);
  });
});

describe('example values', () => {
  it('rejects a collision-avoidance suffix', () => {
    const issues = validateNoRandomIdSuffixes('r.md', '{ "title": "My Form 42" }');

    expect(issues[0].rule).toBe('content.random_id_suffix');
  });

  it('leaves ids, uuids, overlay keys and single digits alone', () => {
    const body = [
      '{ "name": "507f1f77bcf86cd799439011" }',
      '{ "key": "f1010" }',
      '{ "key": "email2" }',
      '{ "path": "user-registration" }',
    ].join('\n');

    expect(validateNoRandomIdSuffixes('r.md', body)).toEqual([]);
  });
});

describe('formio-sdk imports', () => {
  const sdkDir = join(skillsRoot);

  it('allows the documented core-only helpers', () => {
    expect(
      validateFormioSdkSkill(sdkDir).filter((issue) =>
        issue.message.includes('sanctioned core-only')
      )
    ).toEqual([]);
  });

  it('no-ops when the skill is absent', () => {
    expect(validateFormioSdkSkill(join(repoRoot, 'packages'))).toEqual([]);
  });
});

// The requirement that had no implementation at all: run it over what ships.
describe('the shipped library validates clean', () => {
  it('reports no issues', () => {
    const issues = validateLibrary(skillsRoot);

    expect(
      issues.map((issue) => `${issue.path}:${issue.line ?? '?'} [${issue.rule}] ${issue.message}`)
    ).toEqual([]);
  });
});
