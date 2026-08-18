// One published server version, every place a document or manifest launches it.
//
// `npx -y @formio/mcp` resolves whatever the registry serves at launch time.
// That is the "runtime URL that controls the agent" pattern skill scanners rate
// Medium risk, and it also means a shipped skill describes a server nobody can
// name. Every launch therefore carries the exact version —
// `npx -y @formio/mcp@<version>` — with packages/mcp-server/package.json as the
// single source of truth.
//
// Run as `pnpm sync:pins`, which `pnpm changeset:version` calls alongside `pnpm sync:versions`, so the
// release PR carries the restamped pins and upgrading the plugin upgrades the
// server it launches. `--check` verifies without writing, and `pnpm build:plugin`
// runs the same verification so a hand-edited pin cannot publish; the tests that
// fail on drift are plugin-manifests.test.ts and mcp-setup-project-config.test.ts.
//
// server.json — the MCP Registry entry — is a target too, but it names the
// published package in `version` fields rather than in a launch command, so it
// gets its own rewrite below. Leaving it out made the one file that literally
// states a version the one file this script did not keep current.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const SERVER_PACKAGE_JSON = path.join(REPO_ROOT, 'packages/mcp-server/package.json');
const SKILLS_ROOT = path.join(REPO_ROOT, 'plugin/skills');

// Manifests and the documents that travel with a release. plugin/CHANGELOG.md is
// deliberately absent: it records what past releases launched, and restamping it
// would rewrite history.
const FIXED_TARGETS = [
  'plugin/mcp.json',
  'plugin/.cursor-plugin/plugin.json',
  'plugin/.claude-plugin/plugin.json',
  // No `mcpServers` block today, so nothing to stamp — listed so the day one is
  // added it is already covered rather than silently unpinned.
  'plugin/plugin.json',
  'server.json',
  'README.md',
  'plugin/README.md',
  'packages/mcp-server/README.md',
  'llms-install.md',
  'CONTRIBUTING.md',
];

// The MCP Registry entry, which describes the npm package instead of launching
// it: `version` and `packages[].version` are the published server's version, and
// `identifier` is the bare package name — a description of the package, not a
// launch, so it carries no version spec and the launch patterns below do not
// reach it.
const REGISTRY_ENTRY = path.join(REPO_ROOT, 'server.json');
const REGISTRY_VERSION_FIELD = /("version":\s*")[^"]*(")/g;

// A launch is a command that resolves the package at run time, or the package
// string inside a manifest's args array. A prose mention of the package name —
// "the `@formio/mcp` server" — is not a launch and keeps no version.
// `@formio/mcp@<version>` is a placeholder in prose about the pin itself, and
// stamping a number over it would turn an explanation into a stale example.
//
// Every pattern captures exactly two groups — the prefix to keep and the version
// spec to replace — so anything grouped inside them is non-capturing.
const PLACEHOLDER = /^<[^>]*>/;
const LAUNCH_PATTERNS: readonly RegExp[] = [
  // Every runner spelling that resolves the registry's current release: `npx`
  // (with or without a yes flag), its `npm exec` / `npm x` equivalents, and the
  // other package managers' one-off runners. Missing one ships exactly the
  // floating launch this pin exists to remove, with both this script and its
  // tests silent about it.
  //
  // The trailing `(?![\w-])` is a package-name boundary. `@formio/mcp` is a
  // prefix of every `@formio/mcp-*` sibling, so without it a launch of
  // `@formio/mcp-utils` is rewritten to `@formio/mcp@<version>-utils` and a
  // second run truncates that to `@formio/mcp@<version>` — the script that
  // exists to fix pins corrupting a document instead, inside the release PR.
  /((?:npx|npm\s+exec|npm\s+x|pnpm\s+dlx|yarn\s+dlx|bunx)\s+(?:(?:-y|--yes)\s+)?(?:--\s+)?)@formio\/mcp(@\S*)?(?![\w-])/g,
  // The offline path in formio-mcp-setup installs the server globally instead of
  // launching it through npx. That resolves the registry's current release just
  // as `npx` does, so it carries the same pin — otherwise the one documented
  // route a locked-down host can use is the one route that is unpinned.
  /((?:npm\s+(?:install|i)|pnpm\s+add|yarn\s+global\s+add)\s+(?:(?:-g|--global)\s+)?)@formio\/mcp(@\S*)?(?![\w-])/g,
  // The manifest form, anchored to the args array that launches it. An
  // unanchored quoted package name matches far more than a launch — a
  // `"dependencies"` entry, a quoted `pnpm --filter` argument, the registry's
  // `"identifier"` — and stamping a version into any of those writes an invalid
  // key or an unmatchable filter, which `assertServerPinsAgree` then holds the
  // plugin build hostage to until the corruption is committed. Either quote style
  // counts: TOML literal strings are single-quoted, and a config written that way
  // launches the same package. The opening quote is captured into the prefix, so
  // the rewrite reproduces whichever one it found.
  /((?:["']-{1,2}y(?:es)?["'],\s*)["'])@formio\/mcp(@[^"']*)?(?=["'])/g,
  // The same array with no yes flag, in JSON (`"args": [`) or TOML (`args = [`).
  /((?:"args"|'args'|args)\s*[:=]\s*\[\s*["'])@formio\/mcp(@[^"']*)?(?=["'])/g,
];

export function publishedServerVersion(): string {
  return (JSON.parse(fs.readFileSync(SERVER_PACKAGE_JSON, 'utf8')) as { version: string }).version;
}

function markdownUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownUnder(full);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

export function pinTargets(): string[] {
  return [
    ...FIXED_TARGETS.map((relative) => path.join(REPO_ROOT, relative)),
    ...markdownUnder(SKILLS_ROOT),
  ];
}

function registryPinned(text: string, version: string): string {
  return text.replace(REGISTRY_VERSION_FIELD, `$1${version}$2`);
}

function launchPinned(text: string, version: string): string {
  return LAUNCH_PATTERNS.reduce(
    (current, pattern) =>
      current.replace(pattern, (match, prefix: string, spec: string | undefined) =>
        spec && PLACEHOLDER.test(spec.slice(1))
          ? match
          : `${prefix}@formio/mcp@${version}${spec ? spec.slice(1).replace(/^[\w.^~>=-]*/, '') : ''}`
      ),
    text
  );
}

/** How one target names the server: a launch command, or the registry's version fields. */
function pinned(file: string, text: string, version: string): string {
  return file === REGISTRY_ENTRY ? registryPinned(text, version) : launchPinned(text, version);
}

/** Files whose launches name a version other than the published one. */
export function findStalePins(targets: readonly string[] = pinTargets()): string[] {
  const version = publishedServerVersion();
  return targets.filter((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return pinned(file, text, version) !== text;
  });
}

/**
 * Throws when any target names a server version other than the published one,
 * naming the command allowed to fix it. Verify, never write: `prepublishOnly`
 * runs the plugin build, and a build that restamped pins would mutate committed
 * files during a release — the same rule the manifest-version sync follows.
 */
export function assertServerPinsAgree(targets: readonly string[] = pinTargets()): void {
  const stale = findStalePins(targets);
  if (stale.length > 0) {
    throw new Error(
      `Server pin drift against packages/mcp-server/package.json (${publishedServerVersion()}): ` +
        `${stale.map((file) => path.relative(REPO_ROOT, file)).join(', ')}\n` +
        'Run `pnpm sync:pins` to write it — the build does not modify committed source.'
    );
  }
}

/** Rewrites every launch to the published version. Idempotent. */
export function syncServerPins(targets: readonly string[] = pinTargets()): string[] {
  const version = publishedServerVersion();
  return targets.filter((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const next = pinned(file, text, version);
    if (next === text) {
      return false;
    }
    fs.writeFileSync(file, next, 'utf8');
    return true;
  });
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const KNOWN = ['--check', '--list'];
  const unknown = args.filter((arg) => arg.startsWith('-') && !KNOWN.includes(arg));
  if (unknown.length > 0) {
    console.error(
      `Unknown option(s): ${unknown.join(', ')}\n` +
        'Usage: sync-server-pin [--check | --list] [file...]'
    );
    process.exit(1);
  }

  const version = publishedServerVersion();

  // File arguments replace the repository's own target list, so what counts as a
  // launch can be exercised on a scratch copy instead of on the documents a
  // release depends on — the same escape hatch the changeset scripts take with a
  // directory argument.
  const explicit = args
    .filter((arg) => !arg.startsWith('-'))
    .map((arg) => path.resolve(process.cwd(), arg));
  const targets = explicit.length > 0 ? explicit : pinTargets();

  // Names the files this script may rewrite, so a test can assert `--check` left
  // every one of them byte-identical without hard-coding the list — and without
  // watching the whole working tree, which a parallel test run dirties on its own.
  if (args.includes('--list')) {
    console.log(targets.map((file) => path.relative(REPO_ROOT, file)).join('\n'));
    process.exit(0);
  }

  if (args.includes('--check')) {
    const stale = findStalePins(targets);
    if (stale.length > 0) {
      console.error(
        `✗ server pins disagree with packages/mcp-server/package.json (${version}): ` +
          `${stale.map((file) => path.relative(REPO_ROOT, file)).join(', ')}\n` +
          '  Run `pnpm sync:pins` to write them.'
      );
      process.exit(1);
    }
    console.log(`✓ every documented launch pins @formio/mcp@${version}`);
    process.exit(0);
  }

  const changed = syncServerPins(targets);
  console.log(
    changed.length === 0
      ? `✓ every documented launch already pins @formio/mcp@${version}`
      : `✓ pinned @formio/mcp@${version} in: ${changed
          .map((file) => path.relative(REPO_ROOT, file))
          .join(', ')}`
  );
}
