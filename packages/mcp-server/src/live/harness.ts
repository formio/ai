/**
 * Drives the built server the way a client does — over stdio — so a live run proves
 * what a client actually receives, and carries the authenticated REST calls clean-up
 * needs (no MCP tool deletes a form, a role, or a tag).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readToken } from '../token-cache.js';
import { systemCaArgs } from './guards.js';
import { getConfig, readBooleanEnv } from '../config.js';
import { resolveProjectConfig } from '../project-resolver.js';
import { selectDispatcher } from '../formio-client.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The package root, whichever of `src/live` or `dist/live` this file runs from. */
export const PACKAGE_ROOT = path.resolve(here, '..', '..');
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
export const SERVER_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'stdio.js');

// A first call may wait on a browser login, which the server allows up to
// FORMIO_AUTH_TIMEOUT for; template transfers allow five minutes.
const CALL_TIMEOUT_MS = 15 * 60 * 1000;

export interface ToolOutcome {
  isError: boolean;
  /** The error code from `_meta["io.form/error"]`, when the call failed. */
  code?: string;
  structured?: Record<string, unknown>;
  text: string;
}

export interface LiveSession {
  call(tool: string, args?: Record<string, unknown>): Promise<ToolOutcome>;
  toolNames(): Promise<string[]>;
  close(): Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export async function startLiveSession({
  cwd = REPO_ROOT,
  env = process.env,
}: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<LiveSession> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [...systemCaArgs(process.allowedNodeEnvironmentFlags), SERVER_ENTRY],
    cwd,
    env: Object.fromEntries(
      Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
    // The server prints the portal-login URL on stderr; the person running the suite
    // needs to see it to log in on first use.
    stderr: 'inherit',
  });
  const client = new Client({ name: 'formio-mcp-live-tests', version: '0.0.0' });
  await client.connect(transport);
  return {
    async call(tool, args = {}) {
      const result = await client.callTool({ name: tool, arguments: args }, undefined, {
        timeout: CALL_TIMEOUT_MS,
      });
      const meta = isRecord(result._meta) ? result._meta['io.form/error'] : undefined;
      const content = Array.isArray(result.content) ? result.content : [];
      return {
        isError: result.isError === true,
        code: isRecord(meta) && typeof meta.code === 'string' ? meta.code : undefined,
        structured: isRecord(result.structuredContent) ? result.structuredContent : undefined,
        text: content
          .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
          .join(' '),
      };
    },
    async toolNames() {
      const { tools } = await client.listTools();
      return tools.map((tool) => tool.name);
    },
    close: () => client.close(),
  };
}

/**
 * The credential the server itself sends for the project `cwd` resolves to, chosen by
 * the server's own resolver: FORMIO_API_KEY when it is bound to that project (the
 * project FORMIO_PROJECT_URL names), used in preference to a login exactly as the
 * server does; otherwise the cached portal-login token for its deployment.
 */
async function authHeader({
  cwd,
  baseUrl,
}: {
  cwd: string;
  baseUrl: string;
}): Promise<Record<string, string>> {
  // With no resolvable project the server applies no key either, so the cached
  // login is the credential that remains.
  const apiKey = (() => {
    try {
      return resolveProjectConfig(cwd, getConfig(), { onNote: () => undefined }).apiKey;
    } catch {
      return undefined;
    }
  })();
  if (apiKey) {
    return { 'x-token': apiKey };
  }
  const token = await readToken(baseUrl);
  if (token) {
    return { 'x-jwt-token': token };
  }
  throw new Error(
    `No API key bound to this project and no cached login for ${baseUrl}; clean-up cannot authenticate.`
  );
}

/** How long one clean-up request may take before it is abandoned. */
export const DEPLOYMENT_REQUEST_TIMEOUT_MS = 30_000;

export interface DeploymentRequest {
  /** The folder whose resolution chooses the credential; the repository root by default. */
  cwd?: string;
  projectUrl: string;
  baseUrl: string;
  method: 'GET' | 'PUT' | 'DELETE';
  /** Path under the Project URL, starting with `/` or empty for the project itself. */
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

export async function deploymentRequest({
  cwd = REPO_ROOT,
  projectUrl,
  baseUrl,
  method,
  path: requestPath,
  body,
  timeoutMs = DEPLOYMENT_REQUEST_TIMEOUT_MS,
}: DeploymentRequest): Promise<unknown> {
  const url = new URL(`${projectUrl}${requestPath}`);
  // Trust the deployment exactly as the server does, so clean-up reaches every host
  // the tools reached.
  const dispatcher = await selectDispatcher(url, {
    insecureTls: readBooleanEnv(process.env.FORMIO_INSECURE_TLS),
    projectUrl,
    baseUrl,
  });
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...(await authHeader({ cwd, baseUrl })) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    ...(dispatcher ? { dispatcher } : {}),
  } as RequestInit);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${requestPath || '/'} answered ${response.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
