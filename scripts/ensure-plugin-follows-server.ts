// A server release drags the plugin with it.
//
// `pnpm sync:pins` writes the server's published version into files that ship
// inside the plugin package — the three client manifests and every skill that
// prints the launch command. A release that bumps `@formio/mcp` alone therefore
// changes plugin content that never gets republished: the `@formio/ai` tarball
// on npm keeps launching the previous server, and the fix appears to have
// shipped when it has not.
//
// Requiring a second, hand-written changeset on every server fix is the step
// people forget, so `pnpm changeset:version` adds it here instead — before
// `changeset version` consumes the directory, so the Version Packages PR
// carries the plugin bump, the restamped pins, and the server bump together.
//
// Only in that direction. A plugin-only release changes nothing the server
// publishes, and `fixed`/`linked` in .changeset/config.json would couple them
// both ways — republishing an unchanged server every time a skill's wording
// changes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

export const SERVER_PACKAGE = '@formio/mcp';
export const PLUGIN_PACKAGE = '@formio/ai';
export const CHANGESET_DIR = path.join(REPO_ROOT, '.changeset');

// Named so a reader of the release PR knows nobody wrote it by hand, and so a
// second run finds it instead of adding another.
const GENERATED_CHANGESET = 'plugin-follows-server.md';

// The directory's own files are not changesets.
const NOT_A_CHANGESET = new Set(['README.md']);

function changesetFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.md') && !NOT_A_CHANGESET.has(entry))
    .map((entry) => path.join(dir, entry));
}

// A changeset's frontmatter is one `<package>: <bump>` line per released
// package, with the name quoted, single-quoted, or bare.
function releasesIn(markdown: string): string[] {
  const frontmatter = markdown.split('---')[1] ?? '';
  return frontmatter
    .split('\n')
    .map((line) => line.match(/^\s*["']?(@?[\w./-]+)["']?\s*:\s*(major|minor|patch)\s*$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1]);
}

/** Every package the pending changesets would release, deduplicated. */
export function pendingReleases(dir: string = CHANGESET_DIR): string[] {
  return [
    ...new Set(changesetFiles(dir).flatMap((file) => releasesIn(fs.readFileSync(file, 'utf8')))),
  ];
}

/**
 * Adds a patch changeset for the plugin when the pending release bumps the
 * server without it, and returns the path written. Returns undefined — writing
 * nothing — in every other case, so repeated runs cannot stack bumps.
 */
export function ensurePluginBump(dir: string = CHANGESET_DIR): string | undefined {
  const releasing = pendingReleases(dir);
  if (!releasing.includes(SERVER_PACKAGE) || releasing.includes(PLUGIN_PACKAGE)) {
    return undefined;
  }

  const target = path.join(dir, GENERATED_CHANGESET);
  fs.writeFileSync(
    target,
    `---\n'${PLUGIN_PACKAGE}': patch\n---\n\n` +
      `Track the ${SERVER_PACKAGE} release: the plugin manifests and skills pin the exact server version they launch, so a server release republishes the plugin carrying the new pin.\n`,
    'utf8'
  );
  return target;
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  // An explicit directory overrides .changeset/, so the behaviour can be
  // exercised against a scratch copy instead of the release the repository is
  // actually staging.
  const dir = process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? CHANGESET_DIR;
  const written = ensurePluginBump(dir);
  console.log(
    written === undefined
      ? `✓ no plugin bump needed (${pendingReleases(dir).join(', ') || 'nothing pending'})`
      : `✓ added ${path.relative(REPO_ROOT, written)} so ${PLUGIN_PACKAGE} follows the ${SERVER_PACKAGE} release`
  );
}
