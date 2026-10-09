import path from 'path';
import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { findCommittedConfig } from './committed-config.js';
import { readProjectEntry } from './project-map.js';
import { ToolError } from './tool-errors.js';

/**
 * Which source supplied the directory a call resolves against, in the order they are
 * tried: the caller's `cwd` argument, the client's workspace roots, the
 * CLAUDE_PROJECT_DIR environment variable, and last the server process's own working
 * directory — fixed wherever the client spawned it, which is often not where the user
 * is working.
 */
export const CWD_SOURCES = ['argument', 'client-root', 'claude-project-dir', 'server'] as const;
export type CwdSource = (typeof CWD_SOURCES)[number];

export interface WorkingDirectory {
  dir: string;
  source: CwdSource;
}

/** How long a `roots/list` request may take before it counts as no roots. */
export const ROOTS_TIMEOUT_MS = 2_000;

// Read leniently, root by root. The SDK's own result schema (`listRoots`) requires
// every uri to start with file://, so a single root of another scheme would discard
// the whole answer — the file:// roots beside it included — where it is that one root
// that names no directory.
const RootsAnswer = z.looseObject({
  roots: z.array(z.looseObject({ uri: z.string() })),
});

/**
 * The directories behind a client's roots. Only a `file://` URI names a directory; any
 * other root, or one `fileURLToPath` cannot convert, is not one this server can
 * resolve a project for, so it is left out rather than refused.
 */
export function rootDirectories(roots: ReadonlyArray<{ uri: string }>): string[] {
  const dirs = roots.flatMap(({ uri }) => {
    if (!uri.startsWith('file://')) {
      return [];
    }
    try {
      return [fileURLToPath(uri)];
    } catch {
      return [];
    }
  });
  return [...new Set(dirs)];
}

/**
 * Whether a directory resolves a project record of its own: a committed formio.json
 * naming a project found by the upward walk, or a directory mapping naming one. The
 * environment is not asked — it answers for every directory alike, so it cannot tell
 * one root from another.
 *
 * A committed file that cannot be read counts: it is a record the user wrote for
 * that directory, and choosing that root lets the call fail naming the file rather
 * than refusing for an ambiguity that is not there. An unreadable project map answers
 * for no directory in particular, so it counts for none.
 */
export function hasProjectRecord(dir: string): boolean {
  try {
    if (findCommittedConfig(dir)?.projectUrl) {
      return true;
    }
  } catch {
    return true;
  }
  try {
    return Boolean(readProjectEntry(dir)?.env.FORMIO_PROJECT_URL);
  } catch {
    return false;
  }
}

export interface ChooseRootRequest {
  roots: string[];
  hasProjectRecord: (dir: string) => boolean;
}

/**
 * The root a call with no `cwd` resolves against. One root is used as is. Of several,
 * the one that resolves a project record is used; none or more than one is refused,
 * because no client but one documents what order its roots come in, and picking one
 * by position targets a project nobody chose.
 */
export function chooseRoot({ roots, hasProjectRecord }: ChooseRootRequest): string | undefined {
  if (roots.length <= 1) {
    return roots[0];
  }
  const recorded = roots.filter(hasProjectRecord);
  if (recorded.length === 1) {
    return recorded[0];
  }
  throw new ToolError({
    code: 'INVALID_ARGUMENT',
    message: `The client reports ${roots.length} workspace roots and ${recorded.length === 0 ? 'none' : 'more than one'} of them resolves a Form.io project record: ${roots.join(', ')}. Pass cwd set to the directory to use.`,
  });
}

/** CLAUDE_PROJECT_DIR when it names an absolute path; anything else names no directory. */
export function claudeProjectDir(value: string | undefined): string | undefined {
  return value && path.isAbsolute(value) ? value : undefined;
}

export interface WorkspaceDirectoryOptions {
  /** How long `roots/list` may take; {@link ROOTS_TIMEOUT_MS} by default. */
  rootsTimeoutMs?: number;
  /** Reads CLAUDE_PROJECT_DIR; the process environment, at call time, by default. */
  claudeProjectDir?: () => string | undefined;
  hasProjectRecord?: (dir: string) => boolean;
}

export interface ResolveDirectoryRequest {
  /** The `cwd` argument, when the caller passed one. */
  cwd?: string;
  /** The server process's own directory; `process.cwd()` by default. */
  serverCwd?: () => string;
}

export interface WorkspaceDirectory {
  resolve(request: ResolveDirectoryRequest): Promise<WorkingDirectory>;
}

/**
 * The directory source for one server connection.
 *
 * Roots are asked of the client only when it declared the `roots` capability, and
 * the answer is kept until the client sends `notifications/roots/list_changed`. A
 * request that fails or outlives the timeout counts as no roots and is kept the same
 * way: asking again on every call would add the timeout to every call of a client
 * that never answers.
 */
export function createWorkspaceDirectory(
  server: Server,
  options: WorkspaceDirectoryOptions = {}
): WorkspaceDirectory {
  const timeout = options.rootsTimeoutMs ?? ROOTS_TIMEOUT_MS;
  const readClaudeProjectDir = options.claudeProjectDir ?? (() => process.env.CLAUDE_PROJECT_DIR);
  const recorded = options.hasProjectRecord ?? hasProjectRecord;
  const cache: { roots?: Promise<string[]> } = {};

  server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
    delete cache.roots;
  });

  const listRoots = async (): Promise<string[]> => {
    try {
      const { roots } = await server.request({ method: 'roots/list' }, RootsAnswer, { timeout });
      return rootDirectories(roots);
    } catch {
      return [];
    }
  };

  const clientRoots = (): Promise<string[]> => {
    if (!server.getClientCapabilities()?.roots) {
      return Promise.resolve([]);
    }
    cache.roots ??= listRoots();
    return cache.roots;
  };

  return {
    async resolve({ cwd, serverCwd = () => process.cwd() }) {
      if (cwd !== undefined) {
        return { dir: cwd, source: 'argument' };
      }
      const root = chooseRoot({ roots: await clientRoots(), hasProjectRecord: recorded });
      if (root !== undefined) {
        return { dir: root, source: 'client-root' };
      }
      const projectDir = claudeProjectDir(readClaudeProjectDir());
      if (projectDir !== undefined) {
        return { dir: projectDir, source: 'claude-project-dir' };
      }
      return { dir: serverCwd(), source: 'server' };
    },
  };
}

const directories = new WeakMap<McpServer, WorkspaceDirectory>();

/**
 * The one directory source for an McpServer, created on first use so every tool on
 * that server shares its roots cache and its `list_changed` handler. Creating it
 * lazily loses nothing: until a call has read the roots there is nothing cached for
 * a `list_changed` to invalidate. Options take effect on the call that creates it, so
 * a caller that needs them calls this before the first tool call.
 */
export function workspaceDirectory(
  server: McpServer,
  options: WorkspaceDirectoryOptions = {}
): WorkspaceDirectory {
  const existing = directories.get(server);
  if (existing) {
    return existing;
  }
  const created = createWorkspaceDirectory(server.server, options);
  directories.set(server, created);
  return created;
}
