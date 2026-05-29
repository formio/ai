// TEMPORARY: browser-based consent prompt for MCP clients that do not yet support
// the `elicitation` capability. Remove this module (and its call site in
// form_update.ts) once elicitation is universally supported by the clients we
// care about.

import express from 'express';
import { exec } from 'child_process';

export type RevisionsConsentChoice =
  | 'enable-original'
  | 'enable-current'
  | 'proceed-without-history'
  | 'cancel';

export type RevisionsLicenseConsentChoice = 'continue' | 'cancel';

const esc = (s: string): string => s.replace(/</g, '&lt;');

interface Choice {
  value: string;
  title: string;
  desc: string;
  variant?: 'recommended' | 'danger';
  pill?: string;
}

interface PageOptions {
  title: string;
  headerTitle: string;
  headerSub: string;
  meta: { label: string; value: string; id?: string };
  sections: { title?: string; choices: Choice[] }[];
}

const SHARED_STYLE = `
  :root {
    --formio-green: #67b346; --formio-green-dark: #4f9132;
    --ink: #1f2933; --ink-soft: #52606d; --ink-mute: #7b8794;
    --line: #e4e7eb; --line-soft: #f1f4f7;
    --surface: #fff; --bg: #f7f9fb;
    --danger: #b3261e; --danger-soft: #fdecea;
    --warning-bg: #fff8e6; --warning-border: #f4d27a;
    --shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06);
  }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background: var(--bg); margin: 0; padding: 3rem 1rem; color: var(--ink); -webkit-font-smoothing: antialiased; }
  .shell { max-width: 600px; margin: 0 auto; }
  .brand { display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
  .brand img { height: 32px; width: auto; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
  .card-header { padding: 1.5rem 1.75rem 1rem; border-bottom: 1px solid var(--line-soft); }
  .header-title { margin: 0 0 .4rem; font-size: 1.25rem; font-weight: 600; }
  .header-sub { margin: 0; font-size: .92rem; color: var(--ink-soft); }
  .meta { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin: 1rem 1.75rem; padding: .75rem 1rem; background: var(--warning-bg); border: 1px solid var(--warning-border); border-radius: 8px; font-size: .88rem; color: var(--ink-soft); }
  .meta-label { font-weight: 600; color: var(--ink); }
  .meta-id { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .82rem; color: var(--ink-mute); word-break: break-all; }
  .section-title { margin: 1.5rem 1.75rem .5rem; font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-mute); }
  .choices { padding: 0 1.75rem 1.5rem; display: flex; flex-direction: column; gap: .75rem; }
  .choice { display: block; width: 100%; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 10px; padding: .9rem 1.1rem; text-align: left; cursor: pointer; font: inherit; transition: border-color 120ms ease, background 120ms ease; }
  .choice:hover { border-color: var(--ink-mute); }
  .choice-title { font-weight: 600; font-size: .95rem; display: flex; align-items: center; gap: .5rem; }
  .choice-desc { margin-top: .25rem; font-size: .85rem; color: var(--ink-soft); line-height: 1.4; }
  .choice.is-recommended { border-color: var(--formio-green); background: rgba(103,179,70,.06); }
  .choice.is-recommended:hover { background: rgba(103,179,70,.12); border-color: var(--formio-green-dark); }
  .choice.is-recommended .choice-title { color: var(--formio-green-dark); }
  .choice.is-danger { color: var(--danger); border-color: var(--danger); }
  .choice.is-danger:hover { background: var(--danger-soft); }
  .pill { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: .15rem .5rem; border-radius: 999px; background: var(--formio-green); color: #fff; }
  .status { padding: 0 1.75rem 1.5rem; text-align: center; color: var(--ink-mute); font-size: .85rem; min-height: 1.25rem; }
  .footnote { text-align: center; color: var(--ink-mute); font-size: .78rem; margin-top: 1.25rem; }
`;

const SHARED_SCRIPT = `
  var statusEl = document.getElementById('status');
  document.querySelectorAll('button[data-choice]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var choice = btn.getAttribute('data-choice');
      statusEl.textContent = 'Sending choice…';
      document.querySelectorAll('button[data-choice]').forEach(function (b) { b.disabled = true; b.style.opacity = '0.6'; b.style.cursor = 'not-allowed'; });
      fetch('/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice: choice }) })
        .then(function () { statusEl.textContent = 'Choice captured. You can close this tab.'; })
        .catch(function (err) { statusEl.textContent = 'Error: ' + err.message; });
    });
  });
`;

function renderChoice(c: Choice): string {
  const cls = c.variant ? `choice is-${c.variant}` : 'choice';
  const pill = c.pill ? ` <span class="pill">${esc(c.pill)}</span>` : '';
  return `<button class="${cls}" data-choice="${esc(c.value)}">
    <div class="choice-title">${esc(c.title)}${pill}</div>
    <div class="choice-desc">${esc(c.desc)}</div>
  </button>`;
}

function renderPage(opts: PageOptions): string {
  const metaIdHtml = opts.meta.id ? `<span class="meta-id">${esc(opts.meta.id)}</span>` : '';
  const sectionsHtml = opts.sections
    .map((s) => {
      const title = s.title ? `<div class="section-title">${esc(s.title)}</div>` : '';
      return `${title}<div class="choices">${s.choices.map(renderChoice).join('')}</div>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter:400,500,600,700&display=swap">
<style>${SHARED_STYLE}</style>
</head><body>
<div class="shell">
  <div class="brand"><img src="https://portal.form.io/template/images/formio-logo-with-slogan.png" alt="Form.io"></div>
  <div class="card">
    <div class="card-header">
      <h1 class="header-title">${esc(opts.headerTitle)}</h1>
      <p class="header-sub">${esc(opts.headerSub)}</p>
    </div>
    <div class="meta">
      <span class="meta-label">${esc(opts.meta.label)}:</span>
      <strong>${esc(opts.meta.value)}</strong>
      ${metaIdHtml}
    </div>
    ${sectionsHtml}
    <div class="status" id="status">&nbsp;</div>
  </div>
  <div class="footnote">Form.io MCP local consent prompt · You can close this tab after choosing.</div>
</div>
<script>${SHARED_SCRIPT}</script>
</body></html>`;
}

export interface BrowserConsentOptions {
  onReady?: (port: number) => void;
  openBrowser?: boolean;
}

// Shared runner: spins up a local express server on an ephemeral port, renders
// the consent page, opens the browser, and waits for the browser to POST the
// user's choice back to `/callback`.
async function runBrowserConsent<TChoice>(
  page: () => string,
  normalize: (raw: string | undefined) => TChoice,
  options: BrowserConsentOptions = {}
): Promise<TChoice> {
  const app = express();
  app.use(express.json());

  let resolveChoice!: (value: TChoice) => void;
  const choicePromise = new Promise<TChoice>((resolve) => {
    resolveChoice = resolve;
  });

  app.get('/', (_req, res) => res.send(page()));
  app.post('/callback', (req, res) => {
    const raw = (req.body as { choice?: string }).choice;
    res.send('Choice captured. You can close this tab.');
    resolveChoice(normalize(raw));
  });

  const server = app.listen(0, '127.0.0.1', () => {
    const addr = server.address();
    if (addr && typeof addr !== 'string') {
      const consentUrl = `http://127.0.0.1:${addr.port}/`;
      if (options.openBrowser !== false) {
        const openCmd =
          process.platform === 'darwin'
            ? 'open'
            : process.platform === 'win32'
              ? 'start'
              : 'xdg-open';
        exec(`${openCmd} "${consentUrl}"`);
      }
      options.onReady?.(addr.port);
    }
  });

  try {
    return await choicePromise;
  } finally {
    server.close();
  }
}

export type RequestRevisionsLicenseConsentOptions = BrowserConsentOptions;

export async function requestRevisionsLicenseConsent(
  deploymentLabel: string,
  actionLabel: string,
  options: RequestRevisionsLicenseConsentOptions = {}
): Promise<RevisionsLicenseConsentChoice> {
  const page = () =>
    renderPage({
      title: 'Form.io — Security Module Required',
      headerTitle: 'Form revisions are not available on this deployment',
      headerSub: `The Security Module is required for revision tracking. You can still ${actionLabel}, but history will not be preserved.`,
      meta: { label: 'Deployment', value: deploymentLabel },
      sections: [
        {
          choices: [
            {
              value: 'continue',
              title: 'Continue without revision tracking',
              desc: 'Proceed with the action. Remembered for this deployment across future sessions.',
              variant: 'recommended',
            },
            {
              value: 'cancel',
              title: 'Cancel',
              desc: 'Abort the action. No changes are made.',
              variant: 'danger',
            },
          ],
        },
      ],
    });
  return runBrowserConsent<RevisionsLicenseConsentChoice>(
    page,
    (raw) => (raw === 'continue' ? 'continue' : 'cancel'),
    options
  );
}

export type RequestRevisionsConsentOptions = BrowserConsentOptions;

const REVISIONS_CHOICES: readonly RevisionsConsentChoice[] = [
  'enable-original',
  'enable-current',
  'proceed-without-history',
  'cancel',
];

export async function requestRevisionsConsent(
  formName: string,
  formId: string,
  options: RequestRevisionsConsentOptions = {}
): Promise<RevisionsConsentChoice> {
  const page = () =>
    renderPage({
      title: 'Form.io — Revisions Disabled',
      headerTitle: 'Revisions are disabled for this form',
      headerSub:
        'Choose how Form.io should track this update. It is recommended to enable revisions. They track every update so you can audit changes, roll back, or pin submissions to a prior form version.',
      meta: { label: 'Form', value: formName, id: formId },
      sections: [
        {
          title: 'Recommended',
          choices: [
            {
              value: 'enable-original',
              title: 'Enable revisions',
              pill: 'Original',
              desc: 'Track revision history; submissions render against the form version active when they were submitted.',
              variant: 'recommended',
            },
            {
              value: 'enable-current',
              title: 'Enable revisions',
              pill: 'Current',
              desc: 'Track revision history; submissions always render against the latest form version.',
              variant: 'recommended',
            },
          ],
        },
        {
          title: 'Other',
          choices: [
            {
              value: 'proceed-without-history',
              title: 'Update without history',
              desc: 'Proceed with the update — no audit trail. The form will continue to operate without revision history.',
            },
            {
              value: 'cancel',
              title: 'Cancel',
              desc: 'Make no changes. The pending update is discarded.',
              variant: 'danger',
            },
          ],
        },
      ],
    });
  return runBrowserConsent<RevisionsConsentChoice>(
    page,
    (raw) =>
      REVISIONS_CHOICES.includes(raw as RevisionsConsentChoice)
        ? (raw as RevisionsConsentChoice)
        : 'cancel',
    options
  );
}
