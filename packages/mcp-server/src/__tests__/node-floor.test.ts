// One Node floor, stated once and obeyed everywhere.
//
// The root `engines.node` is the source. Every other place that names a Node
// version — each workspace's `engines`, the `.mcpb` manifest's runtime range, the
// esbuild targets the two bundles are compiled for, and the Node CI tests on —
// is held to it here. They drifted apart before: CI kept testing on a Node the
// dev toolchain no longer supported, so the suite ran on a runtime no user of the
// newer toolchain had, and a bundle built for an older target than the declared
// floor silently gives up syntax the floor allows.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const read = (relative: string): string => fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
const enginesOf = (relative: string): string | undefined =>
  (JSON.parse(read(relative)) as { engines?: { node?: string } }).engines?.node;

const floor = enginesOf('package.json') ?? '';
const floorMatch = /^>=(\d+)\.(\d+)$/.exec(floor);
const floorMajor = Number(floorMatch?.[1]);

describe('the Node floor', () => {
  it('is declared at the root as >=MAJOR.MINOR on a maintained major', () => {
    expect(floorMatch, `root engines.node is "${floor}"`).not.toBeNull();
    // Node 20 reached end-of-life in April 2026.
    expect(floorMajor).toBeGreaterThanOrEqual(22);
  });

  it('is the same in every workspace package', () => {
    for (const manifest of [
      'plugin/package.json',
      'packages/mcp-server/package.json',
      'packages/skill-tests/package.json',
    ]) {
      expect(enginesOf(manifest), manifest).toBe(floor);
    }
  });

  it('is the .mcpb manifest runtime range', () => {
    expect(read('scripts/build-mcpb.ts')).toContain(`runtimes: { node: '${floor}.0' }`);
  });

  it('is the esbuild target of both bundles', () => {
    for (const script of ['scripts/build-mcpb.ts', 'scripts/build-plugin.ts']) {
      const targets = [...read(script).matchAll(/target: 'node(\d+)'/g)].map((m) => Number(m[1]));
      expect(targets.length, script).toBeGreaterThan(0);
      expect(
        targets.every((major) => major === floorMajor),
        script
      ).toBe(true);
    }
  });

  it('is the lowest Node CI tests on', () => {
    const versions = [...read('.github/workflows/ci.yml').matchAll(/node-version: (\d+)/g)].map(
      (m) => Number(m[1])
    );
    expect(versions.length).toBeGreaterThan(0);
    expect(Math.min(...versions)).toBe(floorMajor);
  });

  it('is what @types/node describes, so no API newer than the floor type-checks', () => {
    for (const manifest of [
      'packages/mcp-server/package.json',
      'packages/skill-tests/package.json',
    ]) {
      const range = (JSON.parse(read(manifest)) as { devDependencies: Record<string, string> })
        .devDependencies['@types/node'];
      expect(range, manifest).toMatch(new RegExp(`^\\^${floorMajor}\\.`));
    }
  });
});
