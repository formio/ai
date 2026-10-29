# The Agent API

The Agent API runs a form's tasks inside the UAG and returns validated values with a status, an engine and a reason for each field. It is **stateless**: it answers from the data in the request, never reads a stored submission, and saves nothing. To run a task on a submission and save the answers, send the submission to the UAG and add "Agent: Run task" ([workflows.md](./workflows.md)). This is the HTTP surface for any backend or client; in a formio.js page, [`@formio/uag-js`](./uag-js.md) calls it for you.

| Endpoint | Saves | Needs | Purpose |
| --- | --- | --- | --- |
| `POST {form}/agent/extract` | No | Create or update access; Agentic Formflow | Fill a task's fields from free text (`text`, or the task's input in `data`): decisions and open values. Streams on request. |
| `POST {form}/agent/decide` | No | Create or update access; Agentic Formflow | Choose a task's closed-set fields from `data`, with a calibrated confidence. |
| `POST {form}/agent/generate` | No | Create or update access; Agentic Formflow | Write a task's open values from `data`, researching with `uagTools` if the task lists any. |
| `POST {form}/agent/chat` | No | Create access; no Agentic Formflow license | One turn of a conversation that fills the form in. What the chat widget calls. |
| `GET /agent/capabilities` | No | A UAG bearer token or a server key | Engines, operations, edition, license state, `durableRuns`, `mcpOAuth`. At the UAG's root. |

Every operation except `capabilities` needs an enabled engine; `chat` needs an agent engine.

## Contents

- [URLs](#urls)
- [Credentials](#credentials)
- [Request fields](#request-fields)
- [The result object](#the-result-object)
- [Extract](#extract)
- [Decide](#decide)
- [Generate](#generate)
- [Chat](#chat)
- [Errors](#errors)
- [Rate limits](#rate-limits)
- [A relay of your own](#a-relay-of-your-own)

## URLs

`{form}` is the form's URL on the UAG: its path, or `form/{formId}`, under the project's URL on the UAG.

| Project on | Example |
| --- | --- |
| Form.io Open Source | `https://uag.example.com/supportrequest/agent/extract` |
| Form.io Enterprise, or the hosted service | `https://uag.example.com/myproject/supportrequest/agent/extract`, or `https://uag.example.com/project/{projectId}/form/{formId}/agent/extract` |

The form comes from the URL; a `form` in the body is ignored. A form that is not tagged `uag`, or that the project does not have, answers `404`. The pre-2.0 root routes (`/agent/extract`, `/agent/decide`, `/agent/generate`) no longer exist.

## Credentials

The operations take the same credentials as the form's submissions; the credential decides who the operation runs as.

| Header | Runs as | Use from |
| --- | --- | --- |
| `x-jwt-token: <Form.io user token>` | That user, verified with Form.io. Form.io roles apply, including to research. | Browsers and applications acting for a signed-in user |
| `x-remote-token: <portal remote token>` | A portal team member (`team_write` and above may run the operations) | A portal stage connected to the UAG |
| `Authorization: Bearer <UAG access token>` | That user, or administrator for a `client_credentials` token | Servers, and MCP clients signed in with OAuth |
| `x-token: <PROJECT_KEY>` | Administrator | Servers only (Enterprise and hosted) |
| `x-admin-key: <ADMIN_KEY>` | Administrator | Servers only (Open Source) |

- **Server keys are refused from browsers.** A request with `x-token` or `x-admin-key` and an `Origin` or `Sec-Fetch-Site` header is answered `401`. Node's `fetch` sends neither, so servers are unaffected.
- **No credential is refused (`401`)** unless the form sets `uagAnonymous: "true"`. With it, visitors are answered as the Anonymous role when that role may create the form's submissions, and refused with `403` "Anonymous visitors may not submit this form." when it may not; anonymous requests are rate-limited ([form-properties.md](./form-properties.md#uaganonymous)).
- **Scoped tokens** (the UAG's research tokens for remote engines) are refused (`401` "Scoped tokens can only be used on /mcp.").

Every response after authentication carries an `X-Request-Id` header and a `requestId` in the body; send your own `X-Request-Id` to set it, and search the UAG's log for it when a request fails.

## Request fields

| Field | Endpoints | Meaning |
| --- | --- | --- |
| `task` | All | The task (its `uag` value). Without it: `decide` and `generate` run every task; `extract` every task with an input, or every task when `text` is given. |
| `data` | extract, decide, generate, chat | The submission data, nested as in a Form.io submission (`{ "customer": { "name": "..." } }`). |
| `overwrite` | extract, decide, generate | Default `false`: only empty fields are answered, and filled ones are `excluded` as `already has a value`. |
| `text` | extract | Source text; replaces the task's input for this call. |

Bodies are limited to 5 MB (`413`). `persona` is not accepted: send `task`.

## The result object

`extract`, `decide` and `generate` answer with:

```json
{
  "requestId": "3285ea93-e7ed-4cba-9ffc-e28ac9642856",
  "tasks": ["triage"],
  "data": { "description": "Billing question about my last invoice", "category": "billing", "categoryConfidence": 0.925, "urgent": true },
  "fields": {
    "category": {
      "path": "category", "task": "triage", "value": "billing", "status": "confident",
      "engine": "jev", "model": "jev-1.13.0", "calibrated": true, "confidence": 0.925,
      "reason": "confidence 0.92 ≥ threshold 0.6"
    },
    "summary": {
      "path": "summary", "task": "triage", "value": "Customer asks about a charge on their last invoice.",
      "status": "suggested", "engine": "claude", "model": "claude-opus-5-5", "calibrated": false,
      "reason": "extracted by an agent engine; not calibrated"
    }
  },
  "errors": [],
  "excluded": [ { "path": "categoryConfidence", "reason": "holds the confidence of another field", "task": "triage" } ],
  "engines": [
    { "kind": "decision", "task": "triage", "engine": "jev", "model": "jev-1.13.0", "latencyMs": 212, "attempts": [] },
    { "kind": "value", "task": "triage", "engine": "claude", "model": "claude-opus-5-5", "latencyMs": 2140, "attempts": [] }
  ]
}
```

| Key | Content |
| --- | --- |
| `data` | The request's `data` merged with every value returned, then validated by the form. |
| `fields[path]` | `path`, `task`, `status` (`confident`, `uncertain`, `suggested`, `missing`), `engine`, `model`, `calibrated`; `value` when answered; `confidence` from decision engines; up to three `alternatives` (`{ value, label, confidence }`) for uncertain decisions; `noMatch` and `newRecordName` for resource selects; `reason`. |
| `errors` | Validation errors on the merged data, `{ path, label, error }`. A field that fails validation is never `confident`. |
| `excluded` | Target fields left out, with `reason` and `task` ([tasks.md](./tasks.md#what-is-excluded)). |
| `engines` | One entry per engine group: `kind`, `task`, `engine`, `model`, `latencyMs`, `attempts` (engines passed over, `{ engine, error }`), and `toolCalls` for research. |

A group whose engines all failed does not fail the request: it is still `200`, the group's fields are `missing` with `engine: null`, and the other groups' values are returned. An engine's own error text is never passed through; the full error is in the UAG's log under the request id.

How an application should use the statuses: apply `confident` values; prefill `uncertain` ones and ask the person to check them, offering the `alternatives`; show `suggested` values as suggestions to confirm; leave `missing` fields for the person.

## Extract

`POST {form}/agent/extract` — decision fields go to a decision engine and open values to an agent engine, concurrently. Models get no tools.

```bash
curl -s -X POST "$UAG_URL/supportrequest/agent/extract" \
  -H "x-jwt-token: $FORMIO_TOKEN" -H 'Content-Type: application/json' \
  -d '{ "task": "triage", "data": { "description": "My internet has been down since last night" } }'
```

A named task without an input, and no `text`, is refused with `400`.

### Streaming

Send `Accept: text/event-stream` to get each engine group as it finishes; decisions usually arrive in a few hundred milliseconds and values in seconds, so a client can apply decisions (and the pages they turn on) first.

| Event | Data |
| --- | --- |
| `result` | `{ kind, task, engine, model, latencyMs, attempts, fields, patch, toolCalls?, error? }` per engine group. `patch` holds the values to apply, confidence companions included. |
| `error` | `{ kind, task, error, attempts }` after the `result` of a group whose engines all failed; or `{ requestId, error }`, with no `kind`, for a failure that ends the stream. |
| `done` | The full result object, last. |

The stream opens only once the request is planned, so refusals (credentials, unknown form or task, no engine, no license) are ordinary JSON errors. `EventSource` cannot send a POST body; read the stream with `fetch`:

```js
// formUrl: the form's URL on the UAG, from the application's configuration.
export async function extract({ formUrl, token, task, data, onResult }) {
  const response = await fetch(`${formUrl}/agent/extract`, {
    method: 'POST',
    headers: { 'x-jwt-token': token, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ task, data }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`${response.status}: ${body.error || body.detail || response.statusText}`);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const payload = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] || 'null');
      if (event === 'result') onResult?.(payload);              // apply payload.patch
      if (event === 'error' && !payload?.kind) throw new Error(payload?.error || 'The extraction failed.');
      if (event === 'done') return payload;                     // the full result object
    }
  }
  throw new Error('The stream ended before its result.');
}
```

## Decide

`POST {form}/agent/decide` — a task's closed-set fields from in-flight data, with calibrated confidences. Value fields are `excluded` as `not requested`. Always plain JSON. A `submissionId` is refused with `400`: to decide a stored submission and save the result, use Run task with **Answer** set to decisions only. With no decision engine, decision fields fall back to an agent engine (`suggested`, `calibrated: false`).

## Generate

`POST {form}/agent/generate` — a task's open values from in-flight data, with an agent engine. Decision fields are `excluded` as `not requested`. When the criteria lists `uagTools`, the engine may research first, as the caller; a tool that may write or does not exist is refused with `400`. To get decisions and values for the same data, call `decide` and `generate` at the same time.

## Chat

`POST {form}/agent/chat` — one turn of a conversation that fills the form in. The client keeps the conversation and the data; one agent engine reads them with the form's fields, rules and options, and the UAG checks every value against the form. Nothing is stored or saved; the client submits the form itself, through the UAG, once the person confirms. The chat widget does all of this ([chat-widget.md](./chat-widget.md)); call it directly only for a chat UI of your own.

| Field | Required | Meaning |
| --- | --- | --- |
| `messages` | Yes | 1 to 40 `{ "role": "user" \| "assistant", "content": "..." }`, each at most 2000 characters, ending with the person's. |
| `data` | No | The form's current data. |
| `locked` | No | Paths the person set in the form itself (at most 500); the turn neither asks for nor changes them. |

The response carries `reply` (the next message), `patch` (values accepted this turn — write them into the form), `data`, `fields` (each value given this turn: `suggested`, or `invalid` with the form's `error`), `errors`, `remaining` (`required`, `optional` and `unsupported` fields still to fill), `complete` (no required field empty and no errors), `confirmed` (the person confirmed a complete form; the client may submit — the UAG never does), and `engine` (`name`, `model`, `latencyMs`, `toolCalls`, token `usage`).

A turn only ever sets the form's visible input fields a person may enter: never a task's decision or value fields, `uagAuthoritative`, hidden, disabled or calculated fields. Grids, nested forms, files, signatures, addresses, URL- or resource-fed selects and similar are reported in `remaining.unsupported` for the person to fill in the form. Chat answers `503` with no agent engine, `502` when every engine failed, `403` when the form sets `uagChat: "false"` or the caller cannot create submissions.

## Errors

Error bodies are `{ requestId, error }`, with `code` and `edition` when the license is missing. Credential refusals are `{ detail }` (or plain text for an expired Form.io token).

| Status | Cause |
| --- | --- |
| `400` | Unknown task (the message lists the form's tasks); a form with no tasks; extract with no `text` for a task with no input; `submissionId` sent to decide; a write or unknown tool in `uagTools`; a malformed chat turn. |
| `401` | No valid credential; a server key from a browser; a scoped token; a portal member below `team_write`; no credential on a form without `uagAnonymous`. |
| `403` | Agentic Formflow is not licensed (`code: "license_required"`) — checked before the form is read, so it answers for every form; the caller lacks create/update access; chat turned off by `uagChat: "false"`. |
| `404` | The form does not exist or is not tagged `uag`. |
| `413` | Body over 5 MB. |
| `429` | The caller, an anonymous visitor, or every engine is over its rate limit. `Retry-After` when the caller is limited. |
| `502` | Chat: every engine failed. |
| `503` | No enabled engine can serve the operation. |

## Rate limits

Set in the UAG's configuration (a module's `config`, or `new UAGServer(config)`), not in environment variables:

```js
module.exports = {
  config: {
    agentApi: {
      rateLimits: {
        caller: { extract: { limit: 30, windowMs: 60000 }, chat: { limit: 20 }, default: { limit: 60 } },
        engine: { claude: { limit: 100, windowMs: 60000 }, default: { limit: 300 } }
      }
    }
  }
};
```

Caller limits are per user and per operation; over a limit the answer is `429` with `Retry-After`. An engine over its limit is skipped for the next in the routing list. Counters are in memory per process. Every request with a server key and every anonymous visitor share one caller counter, and all `client_credentials` tokens another, so size limits for servers accordingly.

## A relay of your own

When a browser must not hold a credential the UAG accepts — a public form that needs a CAPTCHA, a budget or your own sessions — the browser calls your server, your server checks what it must and calls the UAG with a key, and the browser never sees the key. The relay fixes the form and the task whatever the browser sends, forwards no browser headers (`Origin`, cookies), and streams the response back:

```js
// server.mjs — UAG_URL, FORM_PATH and ADMIN_KEY come from the server's own environment.
import express from 'express';
import { Readable } from 'node:stream';

const { PORT = 8080, UAG_URL, FORM_PATH, ADMIN_KEY } = process.env;
const TASK = 'triage';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/agent/extract', async (req, res) => {
  // Check your own session, CAPTCHA or budget here, and rate limit per user.
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  let response;
  try {
    response = await fetch(`${UAG_URL}/${FORM_PATH}/agent/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: req.get('accept') || 'application/json',
        'x-admin-key': ADMIN_KEY,   // x-token with a PROJECT_KEY for Enterprise or hosted projects
      },
      body: JSON.stringify({ task: TASK, data: req.body?.data || {} }),
      signal: controller.signal,
    });
  } catch {
    if (!res.headersSent) res.status(502).json({ error: 'The UAG could not be reached.' });
    return;
  }
  res.status(response.status);
  res.set('Content-Type', response.headers.get('content-type') || 'application/json');
  res.set('Cache-Control', 'no-cache');
  res.set('X-Accel-Buffering', 'no');   // keep proxies from buffering the stream
  if (response.body) Readable.fromWeb(response.body).pipe(res);
  else res.end();
});

app.listen(PORT);
```

The key acts as administrator: research by such a request reads as administrator too, so a relay for untrusted visitors should use tasks with no `uagTools`. Point `@formio/uag-js` at the relay with `formUrl` ([uag-js.md](./uag-js.md#public-forms)).
