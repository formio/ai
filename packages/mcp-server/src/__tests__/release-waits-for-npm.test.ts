// The release job's wait for npm to surface the version it just published.
//
// Every downstream publish — the MCP Registry, the .mcpb bundle, the GitHub
// release, Smithery, and the Docker image — is gated on this step finding the
// version on npm. npm now accepts a publish and reports "Your package is being
// processed and may take a few minutes to become available": 0.14.0 was accepted
// at 20:45:06 and listed at 20:47:25, while the step gave up after 60 seconds.
// Worse, giving up only printed a line and exited 0, so the job went green with
// everything downstream skipped and nothing said a release had been dropped.
//
// On a push that publishes nothing, `package.json` still names a version npm
// already has, so the first lookup succeeds. The version is missing only when a
// publish is still processing or never landed — and then the run must fail.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8');

// A step runs from its `- name:` / `- uses:` line to the next step, or to the
// comment block that introduces it.
function stepStartingWith(marker: string): string {
  const start = workflow.indexOf(marker);
  expect(start, `release.yml must contain ${marker}`).toBeGreaterThanOrEqual(0);
  const rest = workflow.slice(start + marker.length);
  const end = rest.search(/\n(\s*\n)* {6}(- (name|uses):|#)/);
  return marker + (end === -1 ? rest : rest.slice(0, end));
}

describe('the npm version lookup', () => {
  const step = () => stepStartingWith('- name: Resolve the released @formio/mcp version');

  it('waits long enough for npm to finish processing a publish', () => {
    const deadline = Number(/DEADLINE_SECONDS=(\d+)/.exec(step())?.[1]);
    // Observed: ~140s from accepted to listed. Allow several times that.
    expect(deadline).toBeGreaterThanOrEqual(600);
  });

  it('fails the job when the version never appears, rather than skipping downstream publishes', () => {
    const body = step();
    expect(body).toMatch(/::error::/);
    expect(body).toMatch(/exit 1\s*$/);
  });
});

describe('the changesets step', () => {
  // `pnpm release` runs `pnpm -r publish`, not `changeset publish`, so the action
  // has no publish output to build releases or tags from and warns on every
  // release. The workflow's own "Create the GitHub release" step makes both.
  it('leaves GitHub releases and tags to the workflow step that creates them', () => {
    const body = stepStartingWith('- uses: changesets/action@');
    expect(body).toContain('create-github-releases: false');
    expect(body).toContain('push-git-tags: false');
  });
});
