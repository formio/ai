// `pnpm build:plugin:local` — a copy of the built plugin for local testing.
//
// The published bundle's manifests launch `npx -y @formio/mcp@<version>`, the
// server already on npm. Loading that bundle with `claude --plugin-dir` would test
// this commit's skills against the last released server. This writes
// `dist/plugin-local`, whose `formio-mcp` entries launch the bundle's own
// `server/stdio.mjs` instead — the server built from this commit — and leaves
// `dist/plugin` byte-for-byte what `pnpm test:plugin` verifies.
//
// Flags (for tests): --skip-build uses an existing source instead of running
// build:plugin first; --source / --out override the directories.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const SERVER_NAME = 'formio-mcp';
const MANIFESTS = ['.claude-plugin/plugin.json', '.cursor-plugin/plugin.json', 'mcp.json'];
const SYSTEM_CA_FLAG = '--use-system-ca';

interface Options {
  source: string;
  out: string;
  skipBuild: boolean;
}

function parseArgs(argv: string[]): Options {
  const valueOf = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : path.resolve(argv[index + 1]);
  };
  return {
    source: valueOf('--source', path.join(REPO_ROOT, 'dist/plugin')),
    out: valueOf('--out', path.join(REPO_ROOT, 'dist/plugin-local')),
    skipBuild: argv.includes('--skip-build'),
  };
}

/**
 * The launch every local `formio-mcp` entry gets: the bundled server by absolute
 * path, with `--use-system-ca` when this Node accepts it so a deployment whose
 * certificate the operating system trusts works with verification on.
 */
export function localLaunch({
  serverPath,
  allowedFlags,
}: {
  serverPath: string;
  allowedFlags: ReadonlySet<string>;
}): { command: string; args: string[] } {
  return {
    command: 'node',
    args: [...(allowedFlags.has(SYSTEM_CA_FLAG) ? [SYSTEM_CA_FLAG] : []), serverPath],
  };
}

/** A manifest with its `formio-mcp` entry relaunched; every other field kept. */
export function withLocalServer(
  manifest: Record<string, unknown>,
  launch: { command: string; args: string[] }
): Record<string, unknown> {
  const servers = manifest.mcpServers;
  if (typeof servers !== 'object' || servers === null || !(SERVER_NAME in servers)) {
    return manifest;
  }
  const entry = (servers as Record<string, Record<string, unknown>>)[SERVER_NAME];
  return {
    ...manifest,
    mcpServers: {
      ...servers,
      [SERVER_NAME]: { ...('type' in entry ? { type: entry.type } : {}), ...launch },
    },
  };
}

function buildPluginLocal({ source, out, skipBuild }: Options): void {
  if (!skipBuild) {
    const built = spawnSync('pnpm', ['build:plugin'], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (built.status !== 0) {
      throw new Error('pnpm build:plugin failed');
    }
  }
  if (!fs.existsSync(path.join(source, 'server/stdio.mjs'))) {
    throw new Error(`${source} has no server/stdio.mjs to launch; run pnpm build:plugin first`);
  }
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(source, out, { recursive: true });

  const launch = localLaunch({
    serverPath: path.join(out, 'server/stdio.mjs'),
    allowedFlags: process.allowedNodeEnvironmentFlags,
  });
  MANIFESTS.map((rel) => path.join(out, rel))
    .filter((file) => fs.existsSync(file))
    .forEach((file) => {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      fs.writeFileSync(file, `${JSON.stringify(withLocalServer(manifest, launch), null, 2)}\n`);
    });
  console.log(`Local plugin written to ${out}\nLoad it with: claude --plugin-dir ${out}`);
}

if (process.argv[1] && __filename === path.resolve(process.argv[1])) {
  try {
    buildPluginLocal(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
