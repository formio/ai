import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REFERENCE_PATH = resolve(
  __dirname,
  '../../../../plugin/skills/formio-api/references/project-form-revisions.md'
);

describe('project-form-revisions.md MCP Tool Preference', () => {
  const content = readFileSync(REFERENCE_PATH, 'utf8');

  it('exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it('names all six new MCP tools in the MCP Tool Preference section', () => {
    const sectionMatch = content.match(/## MCP Tool Preference\s*\n([\s\S]*?)(?:\n##\s|$)/);
    expect(sectionMatch).not.toBeNull();
    const section = sectionMatch![1];
    expect(section).toMatch(/form_revisions_list/);
    expect(section).toMatch(/form_revision_get/);
    expect(section).toMatch(/form_revisions_set/);
    expect(section).toMatch(/form_draft_create/);
    expect(section).toMatch(/form_draft_get/);
    expect(section).toMatch(/form_draft_publish/);
  });

  it('does not still claim "no MCP tool covers this operation"', () => {
    const sectionMatch = content.match(/## MCP Tool Preference\s*\n([\s\S]*?)(?:\n##\s|$)/);
    const section = sectionMatch![1];
    expect(section).not.toMatch(/no mcp tool covers this operation/i);
  });
});
