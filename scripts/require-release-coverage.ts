// A change to published content needs a changeset that publishes it.
//
// `ensure-plugin-follows-server.ts` couples the two packages in one direction:
// a pending server bump drags the plugin along. Nothing looked at the other
// direction — whether the pending changesets cover what the branch actually
// touched. A PR that edits packages/mcp-server/ and writes only an `@formio/ai`
// changeset therefore version-bumps the plugin, leaves the server where it was,
// and `pnpm -r publish` skips it: the fix looks released and is not on npm.
// Worse for a pin, since every manifest then names the version that predates the
// fix.
//
// Run as `pnpm check:releases --base=<ref>` (CI passes origin/main). The mapping is
// deliberately coarse — one owning package per published path — because the
// failure mode is a forgotten changeset, not a mis-scoped one.
//
// `--changed=<paths>` and a changeset-directory argument replace the two inputs,
// so the behaviour can be exercised on a scratch copy instead of the branch and
// the release the repository is actually staging — the same escape hatch the
// neighbouring scripts take.
//
// `--head=<branch>` names the branch under review, and exists for one case: the
// Version Packages PR, which this check would otherwise always fail. See
// RELEASE_BRANCH_PREFIX below.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pendingReleases, PLUGIN_PACKAGE, SERVER_PACKAGE } from './ensure-plugin-follows-server.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

/**
 * Paths whose content ships inside a published package, and the package that
 * publishes them. `packages/skill-tests/` is absent because it is private.
 *
 * The server's list is what its `files` field packs, not its whole tree: `dist/`
 * — built from `src/` — plus README.md, alongside the package.json every pin is
 * stamped from. Tests are excluded because they are not packed; so are the
 * Dockerfile, DOCKERHUB.md, the docs/ images and the build and inspector config,
 * which publish no different bytes to npm. Owning them made a PR that only
 * touched build config demand a byte-identical `@formio/mcp` release, which
 * `ensure-plugin-follows-server` then turns into a pointless `@formio/ai`
 * release and a repo-wide pin restamp.
 */
const SERVER_PUBLISHED = [
  'packages/mcp-server/src/',
  'packages/mcp-server/README.md',
  'packages/mcp-server/package.json',
];

export const OWNERSHIP: ReadonlyArray<{ package: string; owns: (file: string) => boolean }> = [
  {
    package: SERVER_PACKAGE,
    owns: (file) =>
      SERVER_PUBLISHED.some((published) => file.startsWith(published)) &&
      !file.includes('/__tests__/'),
  },
  {
    package: PLUGIN_PACKAGE,
    owns: (file) => file.startsWith('plugin/') && !file.endsWith('CHANGELOG.md'),
  },
];

/**
 * Branches changesets/action pushes its release PR to (`changeset-release/<base>`).
 *
 * That PR is the one PR whose only step is merging it, and the one PR this check
 * would always fail: `changeset version` has already consumed every changeset, so
 * nothing is pending, while the commit it carries rewrites exactly the published
 * content guarded here — both packages' version fields and the pins stamped from
 * them. A changeset added there would release the release. So the check does not
 * run on that branch at all.
 *
 * It usually never got the chance: changesets/action opens the PR with the default
 * GITHUB_TOKEN, and a push made with that token does not trigger workflows. That
 * is a property of the token, not of this check — a human push to the branch, a
 * reopen, or swapping in a PAT all deliver the run, and then the release PR goes
 * red for wanting a changeset it must not have.
 */
export const RELEASE_BRANCH_PREFIX = 'changeset-release/';

/** Whether a branch is the changesets release PR, which publishes rather than proposes. */
export function isReleaseBranch(head: string | undefined): boolean {
  return head !== undefined && head.startsWith(RELEASE_BRANCH_PREFIX);
}

/** Packages whose content changed but which no pending changeset would release. */
export function missingReleases(
  changedFiles: readonly string[],
  releasing: readonly string[]
): string[] {
  return OWNERSHIP.filter(
    (owner) => !releasing.includes(owner.package) && changedFiles.some(owner.owns)
  ).map((owner) => owner.package);
}

function changedSince(baseRef: string): string[] {
  const diff = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (diff.status !== 0) {
    throw new Error(`git diff against ${baseRef} failed: ${diff.stderr.trim()}`);
  }
  return diff.stdout.split('\n').filter((line) => line.length > 0);
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const valued = (flag: string): string | undefined =>
    args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
  const unknown = args.filter(
    (arg) =>
      arg.startsWith('-') &&
      !arg.startsWith('--base=') &&
      !arg.startsWith('--changed=') &&
      !arg.startsWith('--head=')
  );
  if (unknown.length > 0) {
    console.error(
      `Unknown option(s): ${unknown.join(', ')}\n` +
        'Usage: require-release-coverage [--base=<ref>] [--head=<branch>] ' +
        '[--changed=<path,path>] [changeset-dir]'
    );
    process.exit(1);
  }

  const head = valued('--head');
  if (isReleaseBranch(head)) {
    console.log(
      `✓ ${head} is the changesets release PR — it consumes changesets rather than adding one`
    );
    process.exit(0);
  }

  const explicit = valued('--changed');
  const changed =
    explicit === undefined
      ? changedSince(valued('--base') ?? 'origin/main')
      : explicit.split(',').filter((file) => file.length > 0);
  const changesetDir = args.find((arg) => !arg.startsWith('-'));
  const missing = missingReleases(changed, pendingReleases(changesetDir));

  if (missing.length > 0) {
    console.error(
      `✗ published content changed with no changeset releasing it: ${missing.join(', ')}\n` +
        '  Run `pnpm changeset` and add a bump for each, or the change version-bumps\n' +
        '  nothing and `pnpm -r publish` skips the package.'
    );
    process.exit(1);
  }

  console.log('✓ every package whose published content changed has a pending release');
}
