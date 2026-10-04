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
// A push with pending changesets publishes nothing: changesets/action opens or
// updates the Version Packages PR instead, and to do so it checks out
// `changeset-release/main` and bumps every version in the working tree — leaving
// the tree there when the step ends. Read from that tree, `package.json` names
// the NEXT version, which npm will not have until the PR merges, so a push whose
// changesets bump `@formio/mcp` polled for ten minutes and failed the job. The
// lookup is therefore skipped when the action reports changesets, and reads the
// version from the pushed commit rather than from whatever the tree holds. On a
// push that does publish, the version is missing only when the publish is still
// processing or never landed — and then the run must fail.

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

  it('is skipped when changesets/action opened the Version Packages PR instead of publishing', () => {
    // v2 of the action names this output in kebab-case.
    expect(step()).toMatch(/^\s*if: steps\.changesets\.outputs\['has-changesets'\] != 'true'$/m);
  });

  it('reads the version from the pushed commit, not the working tree the action left behind', () => {
    const body = step();
    expect(body).toContain('git show "${GITHUB_SHA}:packages/mcp-server/package.json"');
    expect(body).not.toMatch(/jq -r \S+ packages\/mcp-server\/package\.json/);
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
