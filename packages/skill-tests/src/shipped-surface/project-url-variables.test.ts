// There is ONE project variable. `FORMIO_DEFAULT_PROJECT_URL` existed because
// `FORMIO_PROJECT_URL` pinned the server and `project_set` could not redirect it,
// so an install-time prompt wired to it silently defeated every later mapping. The
// scope reorder made the environment the weakest source — a committed formio.json
// wins, then the mapping, then the environment — so a project set there already
// suggests without pinning, and the second variable is gone.

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

describe('the environment tables describe one project variable', () => {
  it.each(ENV_TABLES)('%s names no offering variable', (doc) => {
    expect(read(doc)).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
  });

  it.each(ENV_TABLES)('%s presents the project variable as the weakest source', (doc) => {
    const row = envTableRow(doc, 'FORMIO_PROJECT_URL');

    expect(row).toMatch(/weakest|overrid|committed|mapping/i);
    expect(row).not.toMatch(/takes precedence over any per-directory mapping/i);
  });

  it.each(ENV_TABLES)('%s presents the base URL as normally derived', (doc) => {
    const row = envTableRow(doc, 'FORMIO_BASE_URL');

    expect(row).toMatch(/deriv/i);
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
// Neither URL belongs in an install-time prompt. A Form.io project is
// one-to-one with the application built against it, so a project answer typed
// once is right for one directory and wrong for every later one. A deployment
// answer is no better placed: the base URL is derived per project from the
// project URL's shape when it can be, and the environment is the weakest
// resolution source, so a global cannot override a committed formio.json or a
// working-directory mapping. Both are captured per directory instead.
describe('the CLI plugin manifests prompt for nothing', () => {
  const CLI_MANIFESTS = ['plugin/.cursor-plugin/plugin.json', 'plugin/.claude-plugin/plugin.json'];

  it('declares no install-time variables or user config', () => {
    for (const file of CLI_MANIFESTS) {
      const manifest = JSON.parse(read(file)) as Record<string, unknown>;

      expect(manifest.variables, file).toBeUndefined();
      expect(manifest.userConfig, file).toBeUndefined();
    }
  });

  it('passes no environment block to the server', () => {
    for (const file of CLI_MANIFESTS) {
      const manifest = JSON.parse(read(file)) as {
        mcpServers: Record<string, { env?: Record<string, string> }>;
      };

      expect(manifest.mcpServers['formio-mcp'].env, file).toBeUndefined();
    }
  });

  it('references no placeholder at all', () => {
    for (const file of CLI_MANIFESTS) {
      const placeholders = [...read(file).matchAll(/\$\{([A-Z_a-z.]+)\}/g)].map((m) => m[1]);

      expect(placeholders, file).toEqual([]);
    }
  });

  it('names neither URL variable anywhere in the manifest', () => {
    for (const file of CLI_MANIFESTS) {
      const raw = read(file);

      for (const name of ['FORMIO_PROJECT_URL', 'FORMIO_BASE_URL']) {
        expect(raw, `${file} must not mention ${name}`).not.toContain(name);
      }
    }
  });

  // The desktop bundle is the one install route that still asks for a project: a
  // desktop host has no working directory to map and no repository to commit a
  // formio.json into. Its answer now reaches FORMIO_PROJECT_URL directly, which is
  // safe because the environment is the weakest source — a committed file or a
  // project_set mapping overrides it, which is exactly the guarantee the separate
  // offering variable used to provide.
  it('the desktop bundle sets the project variable, which no longer pins', () => {
    const source = read('scripts/build-mcpb.ts');

    expect(source).toContain("FORMIO_PROJECT_URL: '${user_config.formio_project_url}'");
    expect(source).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
    expect(source, 'the bundle must say the value is overridable per folder').toMatch(
      /overrid|per.folder|project_set/i
    );
  });
});

// FORMIO_PROJECT_URL is no longer authoritative — it is the weakest of the three
// sources. What must still hold is that the tool explains the ordering in terms of
// that variable, and never confuses it with the suggestion-only default.
describe('project_set states the precedence without confusing the two variables', () => {
  it('names FORMIO_PROJECT_URL and not the default', () => {
    const source = read('packages/mcp-server/src/tools/project_set.ts');
    const precedence =
      source
        .split('\n')
        .filter((line) => line.includes('precedence'))
        .join(' ') ?? '';

    expect(precedence).toContain('FORMIO_PROJECT_URL');
    expect(precedence).not.toContain('FORMIO_DEFAULT_PROJECT_URL');
    expect(precedence).toMatch(/weakest|narrowest/i);
  });
});

// The setup skill used to tell readers that the shipped plugin manifests supply
// FORMIO_BASE_URL from an install-time prompt. Only the desktop bundle does now,
// and a skill that says otherwise sends an agent looking for a value nothing set.
describe('no document claims the CLI manifests set the base URL', () => {
  const DOCS = ['plugin/skills/formio-mcp-setup/SKILL.md', 'plugin/README.md', 'README.md'];

  it('never says the plugin manifests set it from an install-time prompt', () => {
    for (const file of DOCS) {
      const text = read(file);

      expect(text, file).not.toMatch(/plugin manifests set it from the install-time prompt/i);
      expect(text, file).not.toMatch(/Claude Code and Cursor ask for `?FORMIO_BASE_URL/i);
    }
  });

  it('still records that the desktop bundle prompts', () => {
    expect(read('scripts/build-mcpb.ts')).toContain('formio_base_url');
  });
});
