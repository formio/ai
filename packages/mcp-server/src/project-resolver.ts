import path from 'path';
import { z } from 'zod';
import { FormioConfig, ResolvedFormioConfig } from './config.js';
import { readProjectEntry } from './project-map.js';

function isPluginContext(): boolean {
  return process.env.FORMIO_PLUGIN_CONTEXT === '1';
}

const PLUGIN_CWD_DESCRIPTION =
  "User's current working directory as an absolute path. Required — the tool looks up the mapped Form.io project from ~/.formio/projects.json[cwd]. Call project_set first if the cwd is not yet mapped.";

const STANDALONE_CWD_DESCRIPTION =
  'Optional and ignored. The per-directory project map applies only when running as the Claude Code plugin; here the project comes from FORMIO_PROJECT_URL. Accepted so the same call works in either mode.';

// The per-cwd map is only consulted in plugin context, so requiring cwd
// elsewhere made callers invent a value that could not change the result — and
// pointed them at project_set, which is not even registered outside the plugin.
// Exported so tests can build a schema after changing the environment.
export function buildCwdSchema() {
  if (isPluginContext()) {
    return z
      .string()
      .min(1, 'cwd is required')
      .refine((value) => path.isAbsolute(value), {
        message: 'cwd must be an absolute path',
      })
      .describe(PLUGIN_CWD_DESCRIPTION);
  }

  return z.string().optional().describe(STANDALONE_CWD_DESCRIPTION);
}

// Built once at module load, which is correct because the plugin sets
// FORMIO_PLUGIN_CONTEXT before the server process starts.
export const cwdSchema = buildCwdSchema();

export function resolveProjectConfig(
  cwd: string | undefined,
  baseConfig: FormioConfig
): ResolvedFormioConfig {
  const pluginContext = isPluginContext();

  // Plugin context: the hook drives per-cwd project_set, so the map is
  // authoritative and cwd must be usable. Standalone: the map is at best stale
  // leftover from prior plugin use in this cwd, so the environment wins and cwd
  // is never read — validating a value we are about to ignore would only
  // produce confusing failures.
  if (pluginContext) {
    if (typeof cwd !== 'string' || cwd.length === 0) {
      throw new Error('cwd is required and must be a non-empty string.');
    }
    if (!path.isAbsolute(cwd)) {
      throw new Error(`cwd must be an absolute path (received: ${cwd}).`);
    }
  }

  const mappedEnv = pluginContext && cwd ? readProjectEntry(cwd)?.env : undefined;
  const mapped = mappedEnv?.FORMIO_PROJECT_URL;
  const projectUrl = mapped ?? baseConfig.projectUrl;
  if (!projectUrl) {
    throw new Error(
      pluginContext
        ? `No Form.io project is mapped for cwd=${cwd}. Call project_set with projectUrl and cwd=${cwd}, or set the FORMIO_PROJECT_URL environment variable, before invoking Form.io tools.`
        : 'No Form.io project is configured. Set the FORMIO_PROJECT_URL environment variable before invoking Form.io tools.'
    );
  }
  const baseUrl = mappedEnv?.FORMIO_BASE_URL ?? baseConfig.baseUrl;
  if (!baseUrl) {
    throw new Error('baseUrl is missing on config. getConfig() should always populate it.');
  }
  return {
    ...baseConfig,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    projectUrl: projectUrl.replace(/\/+$/, ''),
  };
}
