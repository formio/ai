import { readFileSync } from 'fs';
import { createRequire } from 'module';

// Read from package.json rather than repeating the version here: clients show
// this in their server list, and a hand-maintained literal drifts silently —
// it had been reporting 0.1.0 since the first release.
function readPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = JSON.parse(readFileSync(require.resolve('../package.json'), 'utf-8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    // Version reporting must never stop the server from starting.
    return '0.0.0';
  }
}

export const SERVER_VERSION = readPackageVersion();

export const SERVER_PACKAGE = '@formio/mcp';

// How every message that names a shell command spells the CLI.
//
// `formio-mcp` is this package's bin, and nothing on the documented install route
// puts it on PATH: the plugin launches the server through npx, the skills invoke
// it as `npx -y @formio/mcp@<version> project get`, and no step installs a global.
// A message naming the bare bin therefore printed a command that answers
// `command not found` — for a reader whose only instruction was to run it.
//
// Pinned to this build's own version for the same reason `sync:pins` pins every
// documented launch: an unpinned `npx @formio/mcp` resolves whatever the registry
// serves at that moment, which is not necessarily the server that printed the
// message.
export const PROJECT_CLI = `npx -y ${SERVER_PACKAGE}@${SERVER_VERSION} project`;

// The runnable form of a `project` subcommand, e.g.
// `npx -y @formio/mcp@0.10.0 project set --project-url <url> --cwd /w/app`.
export function projectCommand(argv: string): string {
  return `${PROJECT_CLI} ${argv}`;
}
