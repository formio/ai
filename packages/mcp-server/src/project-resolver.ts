import path from 'path';
import { z } from 'zod';
import { FormioConfig, ResolvedFormioConfig } from './config.js';
import { readProjectEntry } from './project-map.js';

export const cwdSchema = z
  .string()
  .min(1, 'cwd is required')
  .refine((value) => path.isAbsolute(value), {
    message: 'cwd must be an absolute path',
  })
  .describe(
    "User's current working directory as an absolute path. Required — the tool looks up the mapped Form.io project from ~/.formio/projects.json[cwd]. Call project_set first if the cwd is not yet mapped."
  );

export function resolveProjectConfig(cwd: string, baseConfig: FormioConfig): ResolvedFormioConfig {
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new Error('cwd is required and must be a non-empty string.');
  }
  if (!path.isAbsolute(cwd)) {
    throw new Error(`cwd must be an absolute path (received: ${cwd}).`);
  }

  // Plugin context: the hook drives per-cwd project_set, so the map is
  // authoritative. Standalone context: the map is at best stale leftover from
  // prior plugin use in this cwd — ignore it so the user's .mcp.json env wins.
  const pluginContext = process.env.FORMIO_PLUGIN_CONTEXT === '1';
  const mapped = pluginContext ? readProjectEntry(cwd)?.env.FORMIO_PROJECT_URL : undefined;
  const projectUrl = mapped ?? baseConfig.projectUrl;
  if (!projectUrl) {
    throw new Error(
      `No Form.io project is mapped for cwd=${cwd}. Call project_set with projectUrl and cwd=${cwd}, or set the FORMIO_PROJECT_URL environment variable, before invoking Form.io tools.`
    );
  }
  if (!baseConfig.baseUrl) {
    throw new Error('baseUrl is missing on config. getConfig() should always populate it.');
  }
  return {
    ...baseConfig,
    baseUrl: baseConfig.baseUrl,
    projectUrl: projectUrl.replace(/\/+$/, ''),
  };
}
