/**
 * The package's interface is its `formio-mcp` binary. Nothing under `dist/` is a
 * supported import, so the package publishes no library entry: `exports` exposes
 * `package.json` alone, which closes every deep import.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE_JSON = path.join(PACKAGE_DIR, 'package.json');

interface PackageManifest {
  name: string;
  main?: string;
  exports?: unknown;
  bin?: Record<string, string>;
}

function manifest(): PackageManifest {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as PackageManifest;
}

// Resolved as the package resolves its own name, which applies its `exports` map.
const selfRequire = createRequire(PACKAGE_JSON);

function resolutionError(specifier: string): string | undefined {
  try {
    selfRequire.resolve(specifier);
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe('@formio/mcp package entry points', () => {
  it('exports package.json and nothing else', () => {
    expect(manifest().exports).toEqual({ './package.json': './package.json' });
  });

  it('declares no library entry', () => {
    expect(manifest()).not.toHaveProperty('main');
  });

  it('still declares the formio-mcp binary', () => {
    expect(manifest().bin).toEqual({ 'formio-mcp': './dist/stdio.js' });
  });

  it('resolves its package.json by name', () => {
    expect(selfRequire.resolve(`${manifest().name}/package.json`)).toBe(PACKAGE_JSON);
  });

  it('refuses a deep import into dist', () => {
    expect(resolutionError(`${manifest().name}/dist/server.js`)).toBe(
      'ERR_PACKAGE_PATH_NOT_EXPORTED'
    );
  });
});
