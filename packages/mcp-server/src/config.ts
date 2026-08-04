export interface FormioConfig {
  baseUrl?: string;
  projectUrl?: string;
  apiKey?: string;
  loginFormUrl?: string;
  jwt?: string;
  // Browser-login server binding. Defaults suit a desktop: an ephemeral port on
  // loopback. A container needs a known port, and a bind address the host can
  // reach through a published port.
  authHost?: string;
  authPort?: number;
  authTimeoutMs?: number;
}

// After resolveProjectConfig has merged in the cwd's mapped project URL.
// baseUrl is guaranteed by getConfig (required in plugin context; defaults
// to https://api.form.io standalone).
export interface ResolvedFormioConfig extends FormioConfig {
  baseUrl: string;
  projectUrl: string;
}

export function getConfig(): FormioConfig {
  const apiKey = process.env.FORMIO_API_KEY;
  const loginFormUrl = process.env.FORMIO_LOGIN_FORM;
  // Standalone-use fallback: when the server is launched outside the plugin
  // (e.g. via .mcp.json), FORMIO_PROJECT_URL lets users skip project_set
  // entirely. Plugin context leaves this unset — the SessionStart hook
  // drives per-cwd project_set instead.
  const pluginContext = process.env.FORMIO_PLUGIN_CONTEXT === '1';
  // Plugin always collects FORMIO_BASE_URL via user-config, so require it
  // there. Standalone falls back to the hosted cloud default.
  const baseUrl = pluginContext
    ? process.env.FORMIO_BASE_URL
    : process.env.FORMIO_BASE_URL || 'https://api.form.io';
  if (!baseUrl) {
    throw new Error('FORMIO_BASE_URL is required');
  }
  // standalone mcp server (outside of claude plugin) needs to set project url from process.env
  //
  // Deliberately not required here. Clients and directory crawlers launch the
  // server with no configuration to read tools/list, so failing at startup made
  // it look like a server with no tools. resolveProjectConfig raises the error
  // instead, at the point the project URL is actually needed and with guidance
  // the caller can act on.
  const projectUrl = pluginContext ? null : process.env.FORMIO_PROJECT_URL;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    projectUrl: projectUrl?.replace(/\/+$/, ''),
    apiKey: apiKey || undefined,
    loginFormUrl: loginFormUrl || undefined,
    jwt: undefined,
    authHost: process.env.FORMIO_AUTH_HOST || undefined,
    authPort: parsePositiveInt(process.env.FORMIO_AUTH_PORT),
    authTimeoutMs: toMilliseconds(parsePositiveInt(process.env.FORMIO_AUTH_TIMEOUT)),
  };
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function toMilliseconds(seconds: number | undefined): number | undefined {
  return seconds === undefined ? undefined : seconds * 1000;
}
