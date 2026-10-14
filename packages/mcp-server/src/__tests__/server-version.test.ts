import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SERVER_VERSION } from '../server.js';

const PACKAGE_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PACKAGE_DIR, '../..');
const read = (relative: string) => fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');

describe('SERVER_VERSION', () => {
  // Clients display this in their server list, so a stale literal misreports
  // which build is running.
  it('matches the version in package.json', () => {
    const pkg = JSON.parse(read('packages/mcp-server/package.json')) as { version: string };

    expect(SERVER_VERSION).toBe(pkg.version);
  });

  it('is not the historical placeholder', () => {
    expect(SERVER_VERSION).not.toBe('0.1.0');
  });

  // The server ships as the npm package, the .mcpb bundle, and a copy inside the
  // plugin. A run-time package.json read finds none in the bundle and @formio/ai's
  // in the plugin, so the version is a stamped module every form carries.
  it('comes from the module sync:pins stamps, not a package.json read', () => {
    const pkg = JSON.parse(read('packages/mcp-server/package.json')) as { version: string };

    expect(read('packages/mcp-server/src/version.ts')).toContain(
      `export const SERVER_VERSION = '${pkg.version}';`
    );
    const launch = read('packages/mcp-server/src/cli-launch.ts');
    expect(launch).not.toMatch(/createRequire|package\.json'\)|__FORMIO_MCP_VERSION__/);
  });

  it('needs no bundler define in any build', () => {
    expect(read('scripts/build-mcpb.ts')).not.toContain('__FORMIO_MCP_VERSION__');
    expect(read('scripts/build-plugin.ts')).not.toContain('__FORMIO_MCP_VERSION__');
  });
});
