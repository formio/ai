// Structural test for the `formio-api` pdf-api reference: the upload
// endpoint's MCP Tool Preference must name the first-party `pdf_upload`
// tool (per the `pdf-upload` capability spec).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const pdfApiPath = join(repoRoot, 'plugin/skills/formio-api/references/pdf-api.md');

describe('pdf-api.md MCP Tool Preference', () => {
  it('names pdf_upload for the upload endpoint', () => {
    const pdfApi = readFileSync(pdfApiPath, 'utf8');
    const section = pdfApi.slice(pdfApi.indexOf('## MCP Tool Preference'));
    expect(section).toContain('pdf_upload');
  });
});
