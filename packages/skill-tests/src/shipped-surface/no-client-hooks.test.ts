// The hook was a Claude-Code-only gate on Form.io tool calls. It shipped to
// every consumer, fired in exactly one client, and by the time it was removed
// nothing referenced it: the skills' plugin-mode branch was gone and the server
// had taken over stating the project requirement itself.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const pluginRoot = join(repoRoot, 'plugin');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

describe('the shipped tree carries no hook', () => {
  it('plugin/hooks/ does not exist', () => {
    expect(existsSync(join(pluginRoot, 'hooks'))).toBe(false);
  });

  it('nothing under plugin/ references the hook', () => {
    const offenders = filesUnder(pluginRoot)
      .filter((file) => /\.(md|json|mjs|js|ts)$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes('verify-project-url'))
      .map((file) => file.replace(`${repoRoot}/`, ''));

    expect(offenders).toEqual([]);
  });

  // Client-specific placeholders are legitimate inside a client's own manifest —
  // holding client-specific configuration is what `.claude-plugin/` is FOR. What
  // must stay clean is everything shared: the skills, the vendor-neutral
  // manifest, and the READMEs every consumer reads.
  it('no shared file expands a client-only plugin variable', () => {
    const perClientManifests = ['.claude-plugin', '.cursor-plugin'];
    const offenders = filesUnder(pluginRoot)
      .filter((file) => /\.(md|json|mjs|js|ts)$/.test(file))
      .filter((file) => !perClientManifests.some((dir) => file.includes(`/${dir}/`)))
      .filter((file) => {
        const body = readFileSync(file, 'utf8');
        return body.includes('CLAUDE_PLUGIN_ROOT') || body.includes('user_config.');
      })
      .map((file) => file.replace(`${repoRoot}/`, ''));

    expect(offenders).toEqual([]);
  });
});

describe('no manifest declares a hooks component', () => {
  const MANIFESTS = [
    'plugin/plugin.json',
    'plugin/.claude-plugin/plugin.json',
    'plugin/.cursor-plugin/plugin.json',
  ];

  it.each(MANIFESTS)('%s declares no hooks', (relative) => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, relative), 'utf8')) as Record<
      string,
      unknown
    >;

    expect(manifest).not.toHaveProperty('hooks');
  });
});

describe('the published file list matches the tree', () => {
  const packageJson = () =>
    JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8')) as {
      files: string[];
    };

  it('does not publish hooks', () => {
    expect(packageJson().files).not.toContain('hooks');
  });

  it('publishes nothing that is absent from the source tree', () => {
    // `server` is produced by the build rather than committed, so it is the one
    // entry legitimately absent from plugin/ before a build runs.
    const missing = packageJson()
      .files.filter((entry) => entry !== 'server')
      .filter((entry) => !existsSync(join(pluginRoot, entry)));

    expect(missing).toEqual([]);
  });
});
