// One version, four files. `plugin/package.json` is the source of truth (it is
// what changesets bumps); the three client manifests carry a copy because
// `.claude-plugin/marketplace.json` installs the plugin from `./plugin` — the
// repository tree, where the build's dist/ output never exists. A manifest with
// no version there is what a client displays and keys updates on.
//
// Written by `pnpm changeset:version` alone, so the release PR carries the
// synced manifests. The plugin build only *verifies* — a build is a read of the
// source tree, and `prepublishOnly` runs it, so a build that stamped versions
// would mutate committed manifests during a release and after any hand-edit of
// plugin/package.json. `pnpm sync:versions --check` is that verification on its
// own. plugin-manifests.test.ts fails when the four disagree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PLUGIN_SRC = path.join(REPO_ROOT, 'plugin');
const PACKAGE_JSON = path.join(PLUGIN_SRC, 'package.json');

export const SOURCE_MANIFESTS = [
  path.join(PLUGIN_SRC, '.claude-plugin/plugin.json'),
  path.join(PLUGIN_SRC, '.cursor-plugin/plugin.json'),
  path.join(PLUGIN_SRC, 'plugin.json'),
];

function pluginVersion(): string {
  return (JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as { version: string }).version;
}

/**
 * Returns the manifests whose version disagrees with plugin/package.json,
 * without touching a byte. This is what the build calls: a build reports drift,
 * it does not repair it in committed source.
 */
export function findStaleManifestVersions(
  manifestPaths: readonly string[] = SOURCE_MANIFESTS
): string[] {
  const version = pluginVersion();
  return manifestPaths.filter((manifestPath) => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version?: unknown };
    return manifest.version !== version;
  });
}

/**
 * Throws when any manifest's version disagrees with plugin/package.json, naming
 * the one command allowed to fix it. Called by the build in place of the write.
 */
export function assertSourceManifestVersionsAgree(
  manifestPaths: readonly string[] = SOURCE_MANIFESTS
): void {
  const stale = findStaleManifestVersions(manifestPaths);
  if (stale.length > 0) {
    throw new Error(
      `Manifest version drift against plugin/package.json (${pluginVersion()}): ` +
        `${stale.map((file) => path.relative(REPO_ROOT, file)).join(', ')}\n` +
        'Run `pnpm sync:versions` to write it — the build does not modify committed source.'
    );
  }
}

/**
 * Writes plugin/package.json's version into every manifest that does not already
 * carry it, and returns the paths it changed. Idempotent, so a repeat run cannot
 * dirty a clean tree.
 */
export async function syncSourceManifestVersions(
  manifestPaths: readonly string[] = SOURCE_MANIFESTS
): Promise<string[]> {
  const version = pluginVersion();

  const results = await Promise.all(
    manifestPaths.map(async (manifestPath) => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      if (manifest.version === version) {
        return undefined;
      }
      // Rewritten as a whole so key order stays as authored — `version` lands
      // wherever it already sits, or last for a manifest that never had one.
      //
      // Through Prettier, not JSON.stringify alone: none of these manifests is
      // in .prettierignore, and `changeset:version` runs this sync — so a raw
      // rewrite (which expands arrays like `keywords` one element per line)
      // lands unformatted in the release PR and turns `format:check` red on
      // every release. The local build calls this too, where the same rewrite
      // dirties committed source. Prettier is fed indented JSON rather than one
      // long line, because it keeps an object expanded only when the source had
      // a line break after its brace — compact input reflows objects that were
      // authored multi-line.
      const options = await resolveConfig(manifestPath);
      fs.writeFileSync(
        manifestPath,
        await format(JSON.stringify({ ...manifest, version }, null, 2), {
          ...options,
          filepath: manifestPath,
        }),
        'utf8'
      );
      return manifestPath;
    })
  );

  return results.filter((changed): changed is string => changed !== undefined);
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  // Explicit paths override the source manifests, so the rewrite can be
  // exercised against a scratch copy instead of the committed tree. `--check` is
  // the only recognized flag; any other is a usage error rather than a file name
  // that fails with an ENOENT explaining nothing.
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const targets = args.filter((arg) => !arg.startsWith('-'));
  const unknown = args.filter((arg) => arg.startsWith('-') && arg !== '--check');
  if (unknown.length > 0) {
    console.error(
      `Unknown option(s): ${unknown.join(', ')}\nUsage: sync-manifest-versions [--check] [manifest.json ...]`
    );
    process.exit(1);
  }
  const manifests = targets.length > 0 ? targets : SOURCE_MANIFESTS;

  // Verification writes nothing, which is what makes it safe for the build and
  // for CI: the answer is the exit code.
  if (check) {
    const stale = findStaleManifestVersions(manifests);
    if (stale.length > 0) {
      const described = stale.map((file) => {
        const { version } = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: unknown };
        return `${path.relative(REPO_ROOT, file)}=${JSON.stringify(version)}`;
      });
      console.error(
        `✗ manifest versions disagree with plugin/package.json (${pluginVersion()}): ${described.join(', ')}\n` +
          '  Run `pnpm sync:versions` to write them.'
      );
      process.exit(1);
    }
    console.log('✓ manifest versions match plugin/package.json');
    process.exit(0);
  }

  const changed = await syncSourceManifestVersions(manifests);
  console.log(
    changed.length === 0
      ? '✓ manifest versions already match plugin/package.json'
      : `✓ synced manifest versions: ${changed.map((file) => path.relative(REPO_ROOT, file)).join(', ')}`
  );
}
