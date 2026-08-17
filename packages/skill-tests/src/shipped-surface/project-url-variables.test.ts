// FORMIO_PROJECT_URL pins the server; FORMIO_DEFAULT_PROJECT_URL only suggests.
// Conflating them is what let a Cursor install-time prompt silently defeat
// project_set, so the distinction is asserted in the wiring AND in the prose —
// the prompt's description promising project_set would work was as much of the
// bug as the env line that made it false.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8');

const ENV_TABLES = ['README.md', 'packages/mcp-server/README.md', 'plugin/README.md'] as const;

// The requirement is about the environment *table*, and prose elsewhere in these
// documents names the variable too — plugin/README.md lists it among the
// install-time prompts. Match the table row rather than the first mention.
function envTableRow(doc: string, variable: string): string {
  return (
    read(doc)
      .split('\n')
      .find((line) => line.trimStart().startsWith('|') && line.includes(`\`${variable}\``)) ?? ''
  );
}

describe('the environment tables distinguish the two variables', () => {
  it.each(ENV_TABLES)('%s documents the offering variable', (doc) => {
    const body = read(doc);

    expect(body).toContain('FORMIO_DEFAULT_PROJECT_URL');
  });

  it.each(ENV_TABLES)('%s says the offering variable does not apply on its own', (doc) => {
    const row = envTableRow(doc, 'FORMIO_DEFAULT_PROJECT_URL');

    expect(row).toMatch(/offer|suggest/i);
    expect(row).toContain('project_set');
  });

  it.each(ENV_TABLES)('%s says the pinning variable cannot be redirected', (doc) => {
    const row = envTableRow(doc, 'FORMIO_DEFAULT_PROJECT_URL');

    expect(row).toMatch(/pins|precedence|cannot be redirected/i);
  });

  it.each(ENV_TABLES)('%s introduces no default base URL variable', (doc) => {
    expect(read(doc)).not.toContain('FORMIO_DEFAULT_BASE_URL');
  });
});

// A deployment is shared across a developer's projects; a Form.io project is
// one-to-one with the application built against it. An install-time project
// answer is therefore right for the one directory it was typed in and wrong for
// every later one, so the plugin manifests ask for the deployment alone and the
// project is captured per directory by project_set.
describe('the plugin install prompt asks for a deployment, never a project', () => {
  const manifest = () =>
    JSON.parse(read('plugin/.cursor-plugin/plugin.json')) as {
      mcpServers: Record<string, { env: Record<string, string> }>;
      variables: { properties: Record<string, { description: string }>; required?: string[] };
    };

  it('wires the deployment and nothing else', () => {
    const env = manifest().mcpServers['formio-mcp'].env;

    expect(Object.keys(env)).toEqual(['FORMIO_BASE_URL']);
  });

  it('declares no project variable to prompt for', () => {
    expect(Object.keys(manifest().variables.properties)).toEqual(['FORMIO_BASE_URL']);
  });

  it('keeps placeholders and declared variables exactly equal', () => {
    const parsed = manifest();
    const placeholders = new Set(
      [...read('plugin/.cursor-plugin/plugin.json').matchAll(/\$\{([A-Z_]+)\}/g)].map((m) => m[1])
    );

    expect([...placeholders].sort()).toEqual(Object.keys(parsed.variables.properties).sort());
  });

  it('requires nothing at install time', () => {
    expect(manifest().variables.required).toBeUndefined();
  });

  // The desktop bundle is the one install route that still asks for a project:
  // a desktop host has no working directory to interview in. Its answer must
  // reach the offering variable, never the pinning one.
  it('the desktop bundle offers a project rather than pinning one', () => {
    const source = read('scripts/build-mcpb.ts');

    expect(source).toContain(
      "FORMIO_DEFAULT_PROJECT_URL: '${user_config.formio_default_project_url}'"
    );
    expect(source, 'an install-time answer must never reach the pinning variable').not.toContain(
      "FORMIO_PROJECT_URL: '${user_config."
    );
    expect(source).toMatch(/suggest|offer/i);
  });
});

describe('project_set names only the pinning variable as authoritative', () => {
  it('warns about FORMIO_PROJECT_URL and not about the default', () => {
    const source = read('packages/mcp-server/src/tools/project_set.ts');
    const precedence =
      source
        .split('\n')
        .filter((line) => line.includes('precedence'))
        .join(' ') ?? '';

    expect(precedence).toContain('FORMIO_PROJECT_URL');
    expect(precedence).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
  });
});
