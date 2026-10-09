import path from 'path';
import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  COMMITTED_CONFIG_FILE,
  CommittedConfigUnusableError,
  findCommittedConfig,
} from './committed-config.js';
import { readProjectEntryForWrite } from './project-map.js';
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
 * resolve a project for, so it is left out rather than refused. Each path is
 * normalised before duplicates are dropped, so `/work/app/` and `/work/app` are one
 * root, as they are one key in the project map.
 */
export function rootDirectories(roots: ReadonlyArray<{ uri: string }>): string[] {
  const dirs = roots.flatMap(({ uri }) => {
    if (!uri.startsWith('file://')) {
      return [];
    }
    try {
      return [path.resolve(fileURLToPath(uri))];
    } catch {
      return [];
    }
  });
  return [...new Set(dirs)];
}

/**
 * The record a directory resolves its project from, when it has one of its own.
 *
 * `key` is the record's identity: two directories with the same key resolve the same
 * record — two roots inside one repository both walk up to its formio.json — and so
 * the same project. Records are compared rather than project URLs because a record
 * carries its own deployment too: two files naming one project URL can name different
 * Base URLs.
 */
export interface ProjectRecord {
  key: string;
  /** How a refusal names the record. */
  description: string;
}

/**
 * The record a directory's project comes from: a committed formio.json found by the
 * upward walk, else that directory's own mapping. The environment is not asked — it
 * answers for every directory alike, so it cannot tell one root from another.
 *
 * A broken record counts: a formio.json that cannot be read, or a mapping entry that
 * is malformed or holds no usable URL, is still the record the user wrote for that
 * directory, and choosing that root lets resolution fail naming it rather than
 * silently targeting another root. A project map that cannot be read at all answers
 * for no directory in particular, so it counts for none; a deployment mapped with no
 * project beside it is not a project record either.
 */
export function projectRecordOf(dir: string): ProjectRecord | undefined {
  const committedAt = (filePath: string): ProjectRecord => ({
    key: `committed:${filePath}`,
    description: filePath,
  });
  try {
    const committed = findCommittedConfig(dir);
    if (committed) {
      return committedAt(committed.filePath);
    }
  } catch (error) {
    return committedAt(
      error instanceof CommittedConfigUnusableError
        ? error.filePath
        : path.join(dir, COMMITTED_CONFIG_FILE)
    );
  }
  const mapping: ProjectRecord = {
    key: `mapping:${path.resolve(dir)}`,
    description: `the project mapping for ${dir}`,
  };
  try {
    const entry = readProjectEntryForWrite(dir);
    if (entry.status === 'unusable') {
      return mapping;
    }
    return entry.status === 'usable' && entry.entry.env.FORMIO_PROJECT_URL ? mapping : undefined;
  } catch {
    return undefined;
  }
}

export interface ChooseRootRequest {
  roots: string[];
  recordOf: (dir: string) => ProjectRecord | undefined;
}

/**
 * The root a call with no `cwd` resolves against, or undefined to try the next source.
 *
 * One root is used as is. Of several, the roots that resolve a project record decide:
 * when they all resolve the same record, the first of them in the client's order is
 * used; when none does, the roots decide nothing and the next source is tried, so a
 * launch configured only by environment resolves as it always did. Roots resolving
 * different records are refused, because no client but one documents what order its
 * roots come in, and picking one by position targets a project nobody chose.
 */
export function chooseRoot({ roots, recordOf }: ChooseRootRequest): string | undefined {
  if (roots.length <= 1) {
    return roots[0];
  }
  const recorded = roots.flatMap((root) => {
    const record = recordOf(root);
    return record ? [{ root, record }] : [];
  });
  if (recorded.length === 0) {
    return undefined;
  }
  if (new Set(recorded.map(({ record }) => record.key)).size === 1) {
    return recorded[0].root;
  }
  throw new ToolError({
    code: 'INVALID_ARGUMENT',
    message: `The client reports ${roots.length} workspace roots that resolve different Form.io project records: ${recorded.map(({ root, record }) => `${root} (${record.description})`).join(', ')}. Pass cwd set to the directory to use.`,
  });
}

/**
 * Whether a directory was NAMED for this call — by the caller's cwd or the client's
 * workspace root. CLAUDE_PROJECT_DIR is a launch default and the server's own
 * directory a spawn accident: both are guesses about where the user is, so an answer
 * about either says so and asks for cwd.
 */
export function isNamedDirectory({ source }: WorkingDirectory): boolean {
  return source === 'argument' || source === 'client-root';
}

/** How an answer names the server's own working directory. */
export const SERVER_DIRECTORY = "the MCP server's own working directory";

/** How an answer names a directory that was guessed rather than named. */
export function guessedDirectory({ source }: WorkingDirectory): string {
  return source === 'claude-project-dir'
    ? 'the directory CLAUDE_PROJECT_DIR names'
    : SERVER_DIRECTORY;
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
  recordOf?: (dir: string) => ProjectRecord | undefined;
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
 * request that fails or outlives the timeout does not discard what an earlier read
 * returned: the last good list keeps serving, and only a client that has never
 * answered counts as having no roots. That outcome is kept until the next
 * `list_changed` too — asking again on every call would add the timeout to every
 * call of a client that never answers.
 */
export function createWorkspaceDirectory(
  server: Server,
  options: WorkspaceDirectoryOptions = {}
): WorkspaceDirectory {
  const timeout = options.rootsTimeoutMs ?? ROOTS_TIMEOUT_MS;
  const readClaudeProjectDir = options.claudeProjectDir ?? (() => process.env.CLAUDE_PROJECT_DIR);
  const recordOf = options.recordOf ?? projectRecordOf;
  const cache: { read?: Promise<string[]>; lastGood?: string[] } = {};

  server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
    delete cache.read;
  });

  const readRoots = async (): Promise<string[]> => {
    try {
      const { roots } = await server.request({ method: 'roots/list' }, RootsAnswer, { timeout });
      cache.lastGood = rootDirectories(roots);
      return cache.lastGood;
    } catch {
      return cache.lastGood ?? [];
    }
  };

  const clientRoots = (): Promise<string[]> => {
    if (!server.getClientCapabilities()?.roots) {
      return Promise.resolve([]);
    }
    cache.read ??= readRoots();
    return cache.read;
  };

  return {
    async resolve({ cwd, serverCwd = () => process.cwd() }) {
      if (cwd !== undefined) {
        return { dir: cwd, source: 'argument' };
      }
      const root = chooseRoot({ roots: await clientRoots(), recordOf });
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
