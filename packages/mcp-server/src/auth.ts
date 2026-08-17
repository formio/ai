import express from 'express';
import { exec } from 'child_process';
import { browserlessReason, currentBrowserEnvironment } from './browser-availability.js';
import { ResolvedFormioConfig } from './config.js';
import { formioRawFetch } from './formio-client.js';

export interface AuthenticateOptions {
  onReady?: (port: number) => void;
}

const DEFAULT_AUTH_HOST = '127.0.0.1';
// Generous on purpose. The point of the timeout is to stop an unattended hang
// from lasting forever, not to hurry an interactive login — an SSO redirect, a
// 2FA prompt or a password-manager detour can all take minutes. Anyone actually
// signing in will finish well inside this.
const DEFAULT_AUTH_TIMEOUT_MS = 15 * 60 * 1000;

function buildLoginPage(loginFormUrl: string): string {
  const domain = new URL(loginFormUrl).hostname;
  return `<!DOCTYPE html>
<html>
<head>
<title>Form.IO Login</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:400,400italic,700">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css">
<link rel="stylesheet" href="https://cdn.form.io/js/5.2.2/formio.full.min.css">
<style>
  body { font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; margin: 0; padding: 2rem 1rem; color: #333; }
  .logo-wrap { text-align: center; margin-bottom: 1rem; }
  .logo-wrap img { max-width: 300px; height: auto; }
  .page-title { text-align: center; margin-bottom: 2rem; font-weight: 300; color: #333; }
  .auth-card { max-width: 480px; margin: 0 auto; background: #fff; padding: 2rem; border: 1px solid #e5e5e5; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .auth-title { text-align: center; margin-bottom: 1.5rem; font-size: 1.1rem; letter-spacing: 0.5px; color: #555; }
  .btn-primary, .btn-success { background-color: #67b346; border-color: #67b346; }
  .btn-primary:hover, .btn-success:hover { background-color: #57a036; border-color: #57a036; }
  #status { text-align: center; margin-top: 1rem; color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<div class="logo-wrap">
  <img src="https://portal.form.io/template/images/formio-logo-with-slogan.png" alt="Form.io">
</div>
<h2 class="page-title">Logging in to ${domain}</h2>
<div class="auth-card">
  <h4 class="auth-title">RETURNING USER LOGIN</h4>
  <div id="formio"></div>
  <div id="status"></div>
</div>
<script src="https://cdn.form.io/js/5.2.2/formio.form.min.js"></script>
<script>
var statusEl = document.getElementById('status');
Formio.createForm(document.getElementById('formio'), '${loginFormUrl}').then(function(form) {
  // Suppress only Formio's default success alert (to avoid a UI flash); keep login error alerts intact.
  const baseSetAlert = form.setAlert.bind(form);
  form.setAlert = function(type, message, options) {
    if (type === 'success') return;
    return baseSetAlert(type, message, options);
  };
  form.on('submit', function(submission) {
    var token = Formio.getToken();
    statusEl.innerHTML = token ? 'Token captured, completing login...' : 'Error: No token received from Form.io SDK';
    if (!token) return;
    fetch('/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    }).then(function() {
      document.querySelector('.auth-card').innerHTML =
        '<div class="alert alert-success text-center mb-0" role="alert">' +
        '<i class="bi bi-check-circle-fill me-2"></i>Login successful. You may close this window.' +
        '</div>';
    }).catch(function(err) {
      statusEl.innerHTML = 'Error sending token: ' + err.message;
    });
  });
}).catch(function(err) {
  statusEl.innerHTML = 'Error loading form: ' + err.message;
});
</script>
</body>
</html>`;
}

const LOGIN_FORM_PROBE_TIMEOUT_MS = 1500;
const resolvedLoginFormCache = new Map<string, string>();

function loginFormCacheKey(config: ResolvedFormioConfig): string {
  return `${config.baseUrl ?? ''}|${config.projectUrl}`;
}

export function resetLoginFormCache(): void {
  resolvedLoginFormCache.clear();
}

async function checkLoginForm(
  loginFormUrl: string,
  config: ResolvedFormioConfig
): Promise<boolean> {
  const url = new URL(loginFormUrl);
  url.searchParams.set('select', '_id');
  const loginForm = await formioRawFetch(url, config, {
    signal: AbortSignal.timeout(LOGIN_FORM_PROBE_TIMEOUT_MS),
  }).catch(() => null);
  return (loginForm as { _id?: string } | null)?._id ? true : false;
}

async function resolveDefaultLoginFormUrl(config: ResolvedFormioConfig): Promise<string> {
  const cacheKey = loginFormCacheKey(config);
  const cached = resolvedLoginFormCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const candidates: string[] = [];
  if (config.baseUrl) {
    candidates.push(`${config.baseUrl}/formio/user/login`);
  }
  candidates.push(`${config.projectUrl}/admin/login`);
  candidates.push(`${config.projectUrl}/user/login`);

  for (const candidate of candidates) {
    if (await checkLoginForm(candidate, config)) {
      resolvedLoginFormCache.set(cacheKey, candidate);
      return candidate;
    }
  }

  return candidates[0];
}

// Checked before anything is bound or launched: on a host with no browser the
// login can never complete, and the whole login timeout would be spent
// discovering that.
function assertBrowserAvailable(config: ResolvedFormioConfig): void {
  if (config.forceBrowser) {
    return;
  }
  // Configuring both a host and a port is the user saying the login page is
  // reachable from their machine. Ignoring that would make the remedy this very
  // error recommends return the identical error — and would newly block
  // devcontainer and Codespaces users whose ports are forwarded.
  const publishedLoginEndpoint = Boolean(config.authHost && config.authPort);
  const reason = browserlessReason(currentBrowserEnvironment(), { publishedLoginEndpoint });
  if (!reason) {
    return;
  }
  throw new Error(
    `Cannot complete the Form.io browser login: ${reason}. ` +
      `Set FORMIO_API_KEY to authenticate without a browser. ` +
      `If the host running your browser can reach this machine, set both FORMIO_AUTH_HOST=0.0.0.0 and ` +
      `FORMIO_AUTH_PORT to a published port so the login page is reachable from it. ` +
      `Set FORMIO_FORCE_BROWSER=1 to attempt the browser login anyway.`
  );
}

export async function authenticate(
  config: ResolvedFormioConfig,
  options?: AuthenticateOptions
): Promise<string> {
  assertBrowserAvailable(config);

  const app = express();
  app.use(express.json());

  let resolveJwt!: (value: string) => void;
  let rejectJwt!: (reason: Error) => void;
  const jwtPromise = new Promise<string>((resolve, reject) => {
    resolveJwt = resolve;
    rejectJwt = reject;
  });

  app.get('/', async (_req, res) => {
    try {
      const loginFormUrl = config.loginFormUrl ?? (await resolveDefaultLoginFormUrl(config));
      res.send(buildLoginPage(loginFormUrl));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).send(`Login form resolution failed: ${message}`);
      rejectJwt(err instanceof Error ? err : new Error(message));
    }
  });

  app.post('/callback', (req, res) => {
    const token = (req.body as { token: string }).token;
    if (!token) {
      process.stderr.write('Auth callback received but token is empty\n');
      res.status(400).send('No token received');
      return;
    }
    process.stderr.write('Auth callback received token successfully\n');
    res.send('Login successful. You can close this tab.');
    resolveJwt(token);
  });

  const host = config.authHost ?? DEFAULT_AUTH_HOST;
  // Captured so the timeout error can name it. stderr reaches logs, but the
  // error reaches the user, and the URL is the one thing they need.
  let loginUrl: string | undefined;
  const server = app.listen(config.authPort ?? 0, host, () => {
    const addr = server.address();
    if (addr && typeof addr !== 'string') {
      const port = addr.port;
      // A wildcard bind is not a usable address to visit, so advertise loopback.
      const reachableHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
      loginUrl = `http://${reachableHost}:${port}/`;

      // Always print the URL. It is the only recourse where no browser can be
      // launched — a container, an SSH session, CI — and without it the user has
      // no way to reach the login page.
      process.stderr.write(`Form.io login required: ${loginUrl}\n`);

      const openCmd =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      exec(`${openCmd} "${loginUrl}"`, (err) => {
        if (err) {
          process.stderr.write(
            `Could not open a browser automatically (${err.message}). ` +
              `Open the URL above manually to finish signing in.\n`
          );
        }
      });
      options?.onReady?.(port);
    }
  });

  const timeoutMs = config.authTimeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS;
  const timer = setTimeout(() => {
    rejectJwt(
      new Error(
        `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the Form.io login to complete. ` +
          (loginUrl ? `Open ${loginUrl} to sign in, then retry. ` : '') +
          `If this environment has no browser — a container, a remote shell, or CI — set FORMIO_API_KEY ` +
          `instead, or set FORMIO_AUTH_HOST=0.0.0.0 and FORMIO_AUTH_PORT to a published port so the login ` +
          `page is reachable from your machine.`
      )
    );
  }, timeoutMs);
  // Do not hold the event loop open on this timer alone.
  timer.unref();

  try {
    return await jwtPromise;
  } finally {
    clearTimeout(timer);
    server.close();
  }
}
