import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeHttpUrl, readHttpUrlEnv } from '../config.js';
import { toMcpStructuredResult } from '../mcp-responses.js';
import { projectMappingShape } from '../output-schemas.js';
import { local } from '../tool-annotations.js';
import { readProjectEntry, writeProjectEntry } from '../project-map.js';
import {
  COMMITTED_CONFIG_FILE,
  committedConfigWritePath,
  findCommittedConfig,
} from '../committed-config.js';
import { derivesOwnBaseUrl } from '../project-resolver.js';
import fs from 'fs';
import path from 'path';

export interface ProjectSetOptions {
  cwd?: () => string;
  baseUrl?: () => string | undefined;
}

export function registerProjectSetTool(server: McpServer, options: ProjectSetOptions = {}) {
  const getServerCwd = options.cwd ?? (() => process.cwd());
  // Last-resort base URL: FORMIO_BASE_URL in the server environment is one
  // global value, so it only applies to a directory with no mapped base URL of
  // its own. An explicit baseUrl argument lets each cwd map to its own
  // deployment.
  //
  // Read through readHttpUrlEnv, never raw. A host that sets this from its own
  // variable — the .mcpb desktop bundle does — passes the literal
  // "${FORMIO_BASE_URL}" when it does not expand it: truthy, so taken raw it reached
  // normalizeHttpUrl and threw out of the handler. The first project_set in a
  // fresh directory then failed, leaving no way to map any project at all.
  const getEnvBaseUrl =
    options.baseUrl ??
    (() => readHttpUrlEnv({ raw: process.env.FORMIO_BASE_URL, name: 'FORMIO_BASE_URL' }));
  server.registerTool(
    'project_set',
    {
      description: [
        'Set the active Form.io project for the given working directory by recording its URL in ~/.formio/projects.json',
        'You MUST call this tool whenever the user asks to set, change, or switch the active Form.io project — do not merely acknowledge the request in text. Persisting the choice requires the tool call.',
        "The chosen URL is persisted to ~/.formio/projects.json keyed by the cwd argument when provided (or the MCP server process cwd otherwise). Pass the `cwd` argument whenever you know the user's current working directory — the server process cwd is fixed at spawn and may not match where the user actually is.",
        'Every Form.io tool resolves its project URL from this map on each call, so the new mapping takes effect immediately for subsequent tool calls from the same cwd.',
        'You normally pass only projectUrl. The base URL — which builds the portal-login URL and keys the cached token — is derived from it — https://api.form.io for a project on a form.io host, and the parent path for a project addressed as a sub-directory — so there is nothing to supply. Pass baseUrl ONLY when the server reports that it cannot be determined, which happens for a project URL that carries no path on a customer domain: there the deployment is a sibling sub-domain and nothing in the project URL names it. Do not ask the user for a base URL before the server says it needs one.',
        `Pass scope to choose WHERE the choice is recorded. The default "user" writes the machine-local mapping in ~/.formio/projects.json, which is keyed by absolute path and therefore does not survive a clone. "repo" instead writes a committed ${COMMITTED_CONFIG_FILE} — versioned with the code, visible in a diff, and shared with everyone who clones the repository. Use "repo" when the target is a property of the application being built; use the default when it is a property of this machine. "repo" REQUIRES an absolute cwd: that file is found by walking up, so one written into the wrong directory governs every directory beneath it, and the server process cwd is not the user's.`,
        `Resolution is by scope, narrowest first, and precedence runs: a committed ${COMMITTED_CONFIG_FILE}, then the working-directory mapping, then FORMIO_PROJECT_URL in the environment, which is the weakest of the three. So a mapping written here DOES override an environment value, and a committed file overrides both.`,
      ].join(' '),
      inputSchema: {
        projectUrl: z
          .url({ protocol: /^https?$/ })
          .optional()
          .describe(
            'Full URL of the Form.io project to activate. Optional only when this cwd already has a project mapped, in which case omitting it updates the baseUrl alone and leaves the project unchanged — that is how the "Base URL cannot be determined" error is repaired without re-asking for a project URL it did not request. Required when nothing is mapped yet. On the Form.io hosted cloud it is the project name as a sub-domain of form.io, e.g. https://examples.form.io. On a customer-hosted deployment it is either a sibling sub-domain of that customer’s domain, e.g. https://myproject.mysite.com, or a sub-directory of the deployment, e.g. https://forms.mysite.com/myproject — whichever that deployment uses.'
          ),
        cwd: z
          .string()
          .optional()
          .describe(
            'User\'s current working directory to key the persisted mapping against. Pass whenever known (e.g. from UserPromptSubmit hook context). Falls back to the MCP server\'s process.cwd() when omitted — except with scope "repo", which requires an absolute path here and refuses without one.'
          ),
        scope: z
          .enum(['user', 'repo'])
          .optional()
          .describe(
            `Where to record the project. "user" (default) writes the machine-local mapping in ~/.formio/projects.json. "repo" writes a committed ${COMMITTED_CONFIG_FILE} — the nearest existing one at or above cwd, or a new one in cwd — which is versioned with the code and takes precedence over the mapping. "repo" requires an absolute cwd.`
          ),
        baseUrl: z
          .url({ protocol: /^https?$/ })
          .optional()
          .describe(
            'Deployment URL for the Form.io Enterprise Server that hosts this project. It builds the portal-login URL and keys the cached token, so a wrong one fails at login rather than on the request. Usually omitted: it is derived from projectUrl wherever it can be. Supply it when the server reports that it cannot be determined — a project URL with no path on a customer domain, whose deployment is a sibling sub-domain. It MAY carry a path of its own when the deployment is mounted at a sub-path. Persisted per-cwd alongside the project URL, so each directory can target a different deployment. When omitted it falls back to the base URL already mapped for this directory, and only then to the global FORMIO_BASE_URL.'
          ),
      },
      outputSchema: projectMappingShape,
      // Writes only to the local project map — no Form.io request involved.
      annotations: local('Set the active project', false),
    },
    async ({ projectUrl, cwd, baseUrl: baseUrlArg, scope }) => {
      const entryCwd = cwd ?? getServerCwd();
      if (scope === 'repo') {
        // The user-scope branch below can key a mapping to the server's own
        // process cwd and warn about it, because a mapping is read back by that
        // one exact path. A committed file is not: it is found by walking UP, so
        // one written into the server's directory — arbitrary for a plugin- or
        // desktop-launched server, often a home directory — governs every
        // non-git directory beneath it, and no warning undoes that. Refuse.
        if (!cwd) {
          throw new Error(
            "cwd is required with scope \"repo\". It decides which directory the committed formio.json is written into, and that file governs every directory beneath it — the MCP server's own working directory is fixed at spawn and is usually not the user's. Pass the user's current working directory as an absolute path."
          );
        }
        // path.resolve inside the writer would silently re-base a relative value
        // on that same server directory, which is the identical misplacement
        // arrived at through a value the caller did supply.
        if (!path.isAbsolute(cwd)) {
          throw new Error(
            `cwd must be an absolute path with scope "repo" (received: ${cwd}). A relative value would be resolved against the MCP server's own working directory, not the user's.`
          );
        }
        return writeCommittedScope({ projectUrl, baseUrl: baseUrlArg, cwd });
      }
      const existing = readProjectEntry(entryCwd);
      const previousMapped = existing?.env.FORMIO_PROJECT_URL;
      // A committed formio.json configures the project exactly as the mapping
      // does, and requireBaseUrl's remedy — "pass baseUrl alongside the cwd" —
      // deliberately does not re-ask for a project URL. So the question is
      // whether ANY source has one, not whether this map does: asking only the
      // map made that remedy fail with "projectUrl is required" for a directory
      // whose project the server had just named.
      const committedProjectUrl = findCommittedConfig(entryCwd)?.projectUrl;
      if (!projectUrl && !baseUrlArg) {
        throw new Error(
          'Pass at least one of projectUrl or baseUrl. With a project already mapped for this cwd, either one alone is a valid update.'
        );
      }
      // Required only where nothing configures a project at all.
      if (!projectUrl && !previousMapped && !committedProjectUrl) {
        throw new Error(
          `projectUrl is required for ${entryCwd}, which has no project mapped yet. Ask the user for their Project URL and call project_set again.`
        );
      }
      const normalizedPrevious = previousMapped
        ? // Re-normalized rather than passed through: the stored value is
          // hand-editable and predates this validation, and it is about to be
          // rewritten as though freshly supplied.
          normalizeHttpUrl(previousMapped, `FORMIO_PROJECT_URL mapped for ${entryCwd}`)
        : undefined;
      // Undefined when only a committed file names the project. Nothing is
      // written to the mapping in that case: copying the committed value in would
      // make a second record that goes stale the moment the tracked file changes,
      // and this call was asked for a deployment, not for a project.
      const normalized = projectUrl
        ? normalizeHttpUrl(projectUrl, 'projectUrl')
        : normalizedPrevious;
      // What this directory will resolve to once the write lands, whichever record
      // holds it — the value the derivation questions below are about.
      const effectiveProjectUrl = (normalized ?? committedProjectUrl) as string;
      const repointed = Boolean(normalizedPrevious) && normalized !== normalizedPrevious;
      // Read tolerantly, exactly like the environment global below it. A stored
      // base URL is data rather than the caller's typing, and this call is the
      // documented repair for a directory whose mapping the resolver now refuses:
      // normalizing it strictly made the repair fail with the very error it was
      // called to clear, leaving no way to fix that directory at all.
      const previousBase = readHttpUrlEnv({
        raw: existing?.env.FORMIO_BASE_URL,
        name: `FORMIO_BASE_URL mapped for ${entryCwd}`,
      });
      // Precedence: the explicit argument, then the base URL already mapped for
      // this directory, then the environment global. The mapping outranks the
      // global deliberately — it is the more specific answer for THIS directory
      // and the one resolveProjectConfig honours at resolve time. Environment
      // first would make the fallback unreachable wherever a host exports a
      // FORMIO_BASE_URL: a re-point at a sibling project would silently move a
      // self-hosted directory to whatever that global names, which is what this
      // order prevents. To change a directory's deployment, pass baseUrl.
      // Falsy, not nullish: FORMIO_BASE_URL arrives from a host prompt the user
      // may have cleared, and an empty string is not a deployment. Stopping the
      // chain there would drop the mapped base URL exactly as omitting it did.
      //
      // The global link is reached only for a project URL that derives no
      // deployment of its own — see derivesOwnBaseUrl. Otherwise the global would
      // be written in place of the derivation and outrank it here forever.
      //
      // The MAPPED link is dropped on the same terms when the directory is being
      // re-pointed: that value belongs to the project it was recorded with, so
      // carrying it onto a project that names its own deployment leaves one
      // deployment answering for another — and, since the mapping outranks
      // derivation, answering forever. A re-set that leaves the project alone
      // keeps it, because there it is this project's own explicit answer.
      const carriedBase =
        repointed && derivesOwnBaseUrl(effectiveProjectUrl) ? undefined : previousBase;
      const resolvedBase =
        baseUrlArg ||
        carriedBase ||
        (derivesOwnBaseUrl(effectiveProjectUrl) ? undefined : getEnvBaseUrl());
      const baseUrl = resolvedBase ? normalizeHttpUrl(resolvedBase, 'baseUrl') : undefined;
      // The server's process cwd is fixed at spawn; for a plugin-launched server
      // it is not the user's directory. Keying there still beats refusing — some
      // clients have no cwd to pass — but the caller has to be told, or the next
      // call that does pass a cwd misses the mapping and loops.
      const serverCwdWarning = cwd
        ? ''
        : ` Warning: no cwd argument was passed, so this mapping is keyed to the MCP server's own working directory. If that is not the user's directory, call project_set again with cwd set to it.`;

      if (normalizedPrevious === normalized && previousBase === baseUrl) {
        const message = `Active project is already ${effectiveProjectUrl} and persisted for ${entryCwd}; no change${serverCwdWarning}`;
        return toMcpStructuredResult(
          {
            ok: true,
            message,
            cwd: entryCwd,
            projectUrl: effectiveProjectUrl,
            ...(baseUrl && { baseUrl }),
            changed: false,
          },
          message
        );
      }

      // FORMIO_PROJECT_URL is omitted where only the committed file names the
      // project: writing a copy of it here would make a second record that goes
      // stale the moment the tracked file changes.
      const env: Record<string, string> = {
        ...(normalized && { FORMIO_PROJECT_URL: normalized }),
        ...(baseUrl && { FORMIO_BASE_URL: baseUrl }),
      };
      writeProjectEntry(entryCwd, env);
      const message =
        (normalized
          ? previousMapped
            ? `Active project set to ${normalized} (was ${previousMapped}; persisted for ${entryCwd})`
            : `Active project set to ${normalized}; mapping persisted for ${entryCwd}`
          : `Base URL ${baseUrl} persisted for ${entryCwd}; the project stays recorded in the committed ${COMMITTED_CONFIG_FILE} as ${effectiveProjectUrl}`) +
        serverCwdWarning;
      return toMcpStructuredResult(
        {
          ok: true,
          message,
          cwd: entryCwd,
          projectUrl: effectiveProjectUrl,
          ...(baseUrl && { baseUrl }),
          changed: true,
        },
        message
      );
    }
  );
}

// The tool half of `project set --scope repo`. Kept beside the mapping writer
// rather than shared with the CLI's copy because the two return different shapes —
// a structured MCP result versus a shell result — while the placement rule they
// both obey lives in committedConfigWritePath.
function writeCommittedScope({
  projectUrl,
  baseUrl,
  cwd,
}: {
  projectUrl?: string;
  baseUrl?: string;
  cwd: string;
}) {
  const target = committedConfigWritePath(cwd);

  // Read-modify-write so a hand-added key ($schema, a convention comment) is not
  // discarded by a tool that only owns two fields.
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(target)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      existing = {};
    }
  }

  const resolvedProjectUrl = projectUrl
    ? normalizeHttpUrl(projectUrl, 'projectUrl')
    : typeof existing.projectUrl === 'string'
      ? normalizeHttpUrl(existing.projectUrl, `projectUrl in ${target}`)
      : undefined;
  if (!resolvedProjectUrl) {
    throw new Error(
      `projectUrl is required for ${target}, which records no project yet. Ask the user for their Project URL and call project_set again with scope "repo".`
    );
  }

  const resolvedBaseUrl = baseUrl
    ? normalizeHttpUrl(baseUrl, 'baseUrl')
    : typeof existing.baseUrl === 'string'
      ? normalizeHttpUrl(existing.baseUrl, `baseUrl in ${target}`)
      : undefined;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    `${JSON.stringify({ ...existing, projectUrl: resolvedProjectUrl, ...(resolvedBaseUrl ? { baseUrl: resolvedBaseUrl } : {}) }, null, 2)}\n`
  );

  const message =
    `Wrote ${target} (${COMMITTED_CONFIG_FILE}, committed scope): project ${resolvedProjectUrl}` +
    `${resolvedBaseUrl ? ` on ${resolvedBaseUrl}` : ''}. ` +
    `This file is versioned with the code and takes precedence over the working-directory mapping, so everyone who clones this repository resolves the same project.`;

  return toMcpStructuredResult(
    {
      ok: true,
      message,
      cwd,
      projectUrl: resolvedProjectUrl,
      ...(resolvedBaseUrl && { baseUrl: resolvedBaseUrl }),
      changed: true,
    },
    message
  );
}
