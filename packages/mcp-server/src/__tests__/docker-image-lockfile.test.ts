// The Docker image installs its dependencies from the repository's lockfile.
//
// Built from packages/mcp-server alone, the image had no lockfile to read, so its
// install resolved every caret range at build time: two images built from the same
// commit could carry different dependency versions, neither of them the set the
// repository tested. The build context is therefore the repository root, where
// pnpm-lock.yaml lives, and the install is frozen to it.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DOCKERFILE = path.join(REPO_ROOT, 'packages/mcp-server/Dockerfile');
const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/release.yml');

const dockerfile = () => fs.readFileSync(DOCKERFILE, 'utf8');
// Instructions only: the comments above them describe the image, and a comment
// naming a command must not satisfy an assertion about running it.
const instructions = () =>
  dockerfile()
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

// The `with:` block of the step that builds the image.
function buildStep(): string {
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');
  const start = workflow.indexOf('uses: docker/build-push-action@');
  expect(start, 'release.yml must build the image with docker/build-push-action').toBeGreaterThan(
    -1
  );
  const rest = workflow.slice(start);
  const end = rest.search(/\n {6}- /);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the Docker image', () => {
  it('installs with a frozen pnpm lockfile', () => {
    expect(instructions()).toMatch(/\bpnpm install\b[^\n]*--frozen-lockfile/);
  });

  it('never resolves dependencies with npm install', () => {
    expect(instructions()).not.toMatch(/\bnpm (install|i|ci)\b/);
  });

  it('copies the repository lockfile into the build', () => {
    expect(instructions()).toMatch(/^COPY [^\n]*\bpnpm-lock\.yaml\b/m);
  });

  it('deploys the production dependencies of @formio/mcp alone', () => {
    expect(instructions()).toMatch(
      /\bpnpm [^\n]*deploy\b[^\n]*--filter[= ]@formio\/mcp\b[^\n]*--prod/
    );
  });

  it('keeps the stdio entrypoint', () => {
    expect(instructions()).toMatch(/^ENTRYPOINT \["node", "dist\/stdio\.js"\]$/m);
  });
});

describe('the release workflow image build', () => {
  it('uses the repository root as the build context', () => {
    expect(buildStep()).toMatch(/^\s+context: \.\s*$/m);
  });

  it('names the server package Dockerfile', () => {
    expect(buildStep()).toMatch(/^\s+file: packages\/mcp-server\/Dockerfile\s*$/m);
  });
});

describe('the repository-root .dockerignore', () => {
  const file = path.join(REPO_ROOT, '.dockerignore');
  const ignored = () =>
    (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

  it('keeps installed modules and VCS state out of the context', () => {
    expect(ignored()).toEqual(expect.arrayContaining(['**/node_modules', '.git']));
  });

  it('does not exclude the lockfile or the workspace manifest', () => {
    for (const pattern of ignored()) {
      expect(pattern).not.toMatch(/pnpm-lock\.yaml|pnpm-workspace\.yaml/);
    }
  });
});
