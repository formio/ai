// The release workflow's changesets/action must match the Changesets CLI major.
//
// changesets/action v2 refuses a project on CLI v2, and v1 predates CLI v3, so
// bumping one without the other breaks the release job — which only runs on a
// push to main, long after the PR that caused it went green. v2 also renamed its
// inputs to kebab-case (`version` → `version-script`, `publish` →
// `publish-script`) and stopped reading a token from the GITHUB_TOKEN
// environment variable, so an old-style step would silently run neither script.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8');
const rootManifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  devDependencies: Record<string, string>;
};

// CLI major → the changesets/action major that supports it. Extend on the next bump.
const ACTION_FOR_CLI: Readonly<Record<number, number>> = { 2: 1, 3: 2 };

const cliMajor = Number(/^\^?(\d+)/.exec(rootManifest.devDependencies['@changesets/cli'])?.[1]);
const step = /- uses: changesets\/action@v(\d+)[\s\S]*?(?=\n\s*\n|\n\s*- )/.exec(workflow);

describe('the changesets release step', () => {
  it('uses the action major that supports the installed CLI major', () => {
    expect(step, 'release.yml must run changesets/action').not.toBeNull();
    const actionMajor = Number(step?.[1]);
    expect(ACTION_FOR_CLI[cliMajor], `no known action major for CLI v${cliMajor}`).toBeDefined();
    expect(actionMajor).toBe(ACTION_FOR_CLI[cliMajor]);
  });

  it('passes the version and publish scripts under the v2 input names', () => {
    const body = step?.[0] ?? '';
    expect(body).toContain('version-script: pnpm changeset:version');
    expect(body).toContain('publish-script: pnpm release');
    expect(body).not.toMatch(/^\s+version:/m);
    expect(body).not.toMatch(/^\s+publish:/m);
    expect(body).not.toContain('GITHUB_TOKEN');
  });
});
