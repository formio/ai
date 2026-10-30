# Patterns, editions and licensing

The UAG sits in front of one Form.io project and serves three entry points: MCP tools at `{uagUrl}/mcp` for agents that bring their own model, the **Agent API** under each form (`{form}/agent/*`) for applications, and the project's own API, so an application can use the UAG's URL as its project URL. This page helps you choose which of them a request needs, and says what each one costs in licensing before anyone builds on it.

## Contents

- [How the UAG works, in five rules](#how-the-uag-works-in-five-rules)
- [The four surfaces](#the-four-surfaces)
- [Editions](#editions)
- [Licensing](#licensing)
- [Checking a deployment](#checking-a-deployment)
- [Packages](#packages)
- [Coming from UAG 1.x](#coming-from-uag-1x)

## How the UAG works, in five rules

- **It serves only forms tagged `uag`.** At startup it reads the project's `/export` and registers every form and resource whose `tags` include `uag`; it re-reads the export every `PROJECT_TTL` seconds (default `900`). An untagged form is invisible to every MCP tool and agent operation, and nothing errors.
- **It stores no submissions (proxy mode).** Every create and update it receives is forwarded to Form.io, which validates it, stores it and runs the form's own actions (Save Submission, Login, Role Assignment, Webhook, Email, Group). The UAG runs only its own actions — "Agent: Run task", and any action a UAG module adds — before or after the forward, so nothing runs twice. Login and registration are forwarded too, and Form.io's response, with the token it issues, is passed back.
- **Every call has a Form.io identity.** A Form.io user token (`x-jwt-token`) works against the UAG as it does against Form.io: the UAG verifies it with Form.io and forwards it unchanged. MCP clients use UAG access tokens, from `client_credentials` (administrator) or from a browser sign-in (the user).
- **Every write goes through the form.** Every value an agent or engine proposes runs through the form's own validation, conditionals and calculations on the server before it is forwarded.
- **Models only answer.** In the Agent API and Run task the UAG calls **engines** (adapters to a model provider) that return answers; the UAG validates them and performs the write. Only MCP clients hold write tools, and the form and the caller's permissions still gate every write they make.

## The four surfaces

| | Conversation forms over MCP | The chat widget | Agentic Formflow | Agentic workflows |
| --- | --- | --- | --- | --- |
| A person or system | Talks to Claude, ChatGPT or an agent you write, which fills in or looks up forms | Talks to a chat on your page that fills in one form | Describes something; the form, or your application, is filled from it | Submits; an agent works on the submission afterwards (or before it is stored) |
| Entry point | `{uagUrl}/mcp` | `{form}/agent/chat`, through `Formio.createChat` from `@formio/uag-js` | `{form}/agent/extract`, `decide`, `generate`; Agent Input in `@formio/uag-js` | The "Agent: Run task" action on submissions sent to the UAG |
| Model | The MCP client's | An agent engine in the UAG | Engines in the UAG | Engines in the UAG |
| Needs a task on the form | No | No | Yes | Yes |
| Saves | The client calls `submit_completed_form` / `submission_update` | The person confirms; the form submits through the UAG | Nothing: stateless | Yes: before the save as part of it, or after it as an update |
| Reference | [mcp-clients.md](./mcp-clients.md) | [chat-widget.md](./chat-widget.md) | [agent-api.md](./agent-api.md), [uag-js.md](./uag-js.md) | [workflows.md](./workflows.md) |

How to tell them apart from a request:

- **"Let Claude (or our agent, or ChatGPT) use our forms"**, "connect Claude Desktop to Form.io", "an assistant that files service requests for our staff" — conversation forms over MCP.
- **"Add a chat to this form"**, "let people fill the form in by talking", "a conversational intake page" — the chat widget. No MCP client and no model code in the application.
- **"Fill the form in from what they type"**, "prefill the claim from the description", "decide which wizard pages apply", "our backend needs the category and a summary for this text" — Agentic Formflow. In a formio.js page, Agent Input; anywhere else, the Agent API.
- **"Score every application"**, "triage each ticket when it is submitted", "an agent reviews and a second one assigns the award" — agentic workflows with Run task.

Common combinations: Agent Input in the browser plus a Run task before the save that re-decides the routing fields on the server (the browser's decisions are suggestions; the server's are trusted); a chat widget on a public form plus a Run task after the save that triages what the chat collected (the chat never sets a task's fields — those are left to Run task).

## Editions

| | Form.io Open Source | Form.io Enterprise, self-hosted | Project on Form.io's hosted service |
| --- | --- | --- | --- |
| `PROJECT` (how the UAG reaches Form.io) | The server's root, `http://formio:3001` | The project endpoint, `http://formio-enterprise:3000/myproject` | `https://<project>.form.io` |
| The UAG's credential | `ADMIN_KEY` (the server's admin key) | `PROJECT_KEY` (a project API key), plus `LICENSE_KEY` | `PROJECT_KEY` |
| `client_credentials` client id | `formio-oss-x-admin-key` | `<project name>-x-token` | `<project name>-x-token` |
| Project URL on the UAG | The UAG's root | `/{projectName}` or `/project/{projectId}` | `/{projectName}` or `/project/{projectId}` |
| An agent role acting on users' behalf | No | Yes, with `JWT_SECRET` shared with Form.io | No (the hosted service does not share its secret) |
| Portal stage connected to the UAG, Action Logs | No | Yes | — |

Setting `PROJECT_KEY` is what makes the UAG treat `PROJECT` as an Enterprise or hosted project.

## Licensing

| You run | You need |
| --- | --- |
| MCP tools and conversation forms, including a form's chat (`{form}/agent/chat`), on Form.io Open Source or a hosted project | Nothing |
| MCP tools and conversation forms on a self-hosted Form.io Enterprise project | A Form.io license that includes the UAG, in `LICENSE_KEY` (development hosts such as `localhost` are exempt) |
| **Agentic Formflow** — the Agent API's `extract`, `decide` and `generate`, Agent Input, the "Agent: Run task" action, the `agent_decide` and `agent_provide` MCP tools, and `uag-eval` — on a self-hosted project, Open Source or Enterprise | A Form.io license that includes the UAG, in `LICENSE_KEY` |
| The same against a project on Form.io's hosted service (`https://*.form.io`) | Nothing: it runs under Form.io's license (`reason: "hosted"`), except `uag-eval` against a real engine, which runs offline and needs a `LICENSE_KEY` that includes the UAG for the `--project` URL (with only the stub engines it needs none) |
| The UAG's own database (`MONGO`), and with it remote MCP sign-in (`MCP_OAUTH`), durable runs, Action Logs and the license grace period, on any edition | A license that includes the UAG, unless the project and the database are both on development hosts (`localhost`, `*.localhost`, `lvh.me`, `*.lvh.me`, `*.local`, `file:` URLs) |
| The Agent API and Run task with only the stub engines, to build against the API before there are model keys | Nothing: `UAG_ENGINES=stub-decision,stub-agent` (`reason: "stub-engines"`). Their answers are placeholders. `agent_decide` and `agent_provide` still need a license or a hosted project |

Unlicensed Agentic Formflow requests are refused with `403` and `{ "code": "license_required", "edition": "open-source" }`; a Run task before the save refuses the submission the same way, and one after the save fails in the background and is logged. Agentic Formflow has **no development-host exemption**: a project on `localhost` needs the license too, so to build against the Agent API or Run task locally without one, enable only the stub engines. The hosted-service exemption covers `https` endpoints on `form.io` or its subdomains, after the UAG confirms with `GET /formio-config` that the server is the hosted service, and it is turned off by anything that weakens the proof that the UAG is talking to form.io: `NODE_TLS_REJECT_UNAUTHORIZED=0`, `NODE_EXTRA_CA_CERTS`, `NODE_USE_SYSTEM_CA=1`, or the `--use-system-ca` / `--use-openssl-ca` flags (in `NODE_OPTIONS` too). A corporate base image that adds certificate authorities loses the exemption. On a hosted project, leave `LICENSE_KEY` unset unless the UAG has a database of its own: with a key set, the project must be on that key's endpoint allowlist, or the UAG does not load it. Write the license into `LICENSE_KEY` (Form.io Enterprise reads the same variable, so one license can run both); `UAG_LICENSE` is deprecated and still read until UAG 3.0. A trial license comes from `support@form.io`.

What an operator needs to know about the license itself:

- **Online licenses** (the usual kind, validated with `LICENSE_SERVER`, default `https://license.form.io`) carry the `uagServer` scope and a number of UAG servers. Each project endpoint a UAG serves counts as one; replicas serving the same project count once. A UAG past the number is refused ("UAG server limit reached") and does not load its project. **Offline licenses** need `LICENSE_REMOTE=true` and the `uag` option, and are issued for one project.
- **A self-hosted Enterprise project** loads only when `PROJECT`'s host is on the license's endpoint allowlist (trial licenses expect `api-server:3000`); development hosts are exempt from this check, not from Agentic Formflow's.
- **License server outages.** With the UAG's database, the last confirmed license is trusted for 12 hours from the start of an outage, and a restart does not reset that. Without the database there is no grace period: licensed features turn off as soon as the license server cannot confirm the key, and a self-hosted Enterprise project does not load until it can. A production deployment on an online license should have the database, and egress to the license server.

## Checking a deployment

`GET {uagUrl}/agent/capabilities` always answers, licensed or not, and is the first thing to check. It takes a UAG bearer token, or a server key from a server (never from a browser):

```json
{
  "engines": [
    { "name": "jev", "kind": "decision", "model": "jev-1.13.0", "type": "jev", "package": "@formio/uag-jev", "version": "2.0.0" },
    { "name": "claude", "kind": "agent", "model": "claude-opus-5-5", "type": "claude", "package": "@formio/uag-claude", "version": "2.0.0" }
  ],
  "operations": {
    "extract": { "available": true, "engines": ["jev", "claude"] },
    "decide": { "available": true, "engines": ["jev", "claude"] },
    "generate": { "available": true, "engines": ["claude"] },
    "chat": { "available": true, "engines": ["claude"] }
  },
  "edition": "enterprise",
  "formflow": { "licensed": true, "allowed": true, "reason": "licensed" },
  "durableRuns": true,
  "mcpOAuth": false
}
```

`formflow.reason` is `licensed`, `hosted`, `stub-engines` or `unlicensed`. `durableRuns` and `mcpOAuth` are `true` only when the UAG uses its own database. The startup log says the same in words: `[formio-uag] Open Source edition. Agentic Formflow requires a license ...`.

## Packages

| Package | What it is |
| --- | --- |
| `@formio/uag`, image `formio/uag` | The UAG. The image includes every official engine. Node 22 or newer, run with `--no-node-snapshot` when embedded. Its only Form.io server dependency is `@formio/appserver` (2.25.1 or later), which brings `@formio/appserver-core`; do not add `appserver-core` to an embedding application yourself. |
| `@formio/uag-jev`, `@formio/uag-claude`, `@formio/uag-openai`, `@formio/uag-grok`, `@formio/uag-gemini` | The engines, versioned independently of the UAG. `@formio/uag-claude` 2.x is the Claude engine; 1.x was the retired Claude integration. |
| `@formio/uag-js` | The formio.js module: saves `uag` forms through the UAG, adds Agent Input, and renders forms as a chat. Runs in the browser, peer of `@formio/js` 5. |
| `@formio/uag-sdk` | The Engine SDK, for writing an engine of your own. |
| `@formio/uag-engines`, image `formio/uag-engines` | The engine server, which keeps model keys and model traffic out of the UAG. |

## Versions

This skill describes UAG 2.0. Until `2.0.0` is released, 2.0 ships as release candidates, `2.0.0-rc.N`, under the npm dist-tag `rc`, and `latest` is not a safe default: on `@formio/uag`, `@formio/uag-claude` and the `formio/uag` image it names a 1.x release this skill does not describe, and on the packages that are new in 2.0 (`@formio/uag-js`, `@formio/uag-sdk`, `@formio/uag-engines` and the other engines) it can name an older release candidate. The `formio/uag-engines` image has no `latest` tag at all. Resolve every package's version before writing it into a file or a command:

1. Run `npm view <package> dist-tags --json` for each package the work installs or references: `@formio/uag`, `@formio/uag-js`, each engine (versioned independently of the UAG), `@formio/uag-engines` for an engine server, and `@formio/uag-sdk` for a custom engine.
2. Use the version `latest` names when it is `2.0.0` or a later 2.x release that is not a prerelease. Otherwise use the version `rc` names, a `2.0.0-rc.N`. When neither is a 2.x version, tell the user that UAG 2.0 is not published for that package and write nothing for it.
3. Write that exact version everywhere: `npm install @formio/uag-js@2.0.0-rc.3`, the image tag `formio/uag:2.0.0-rc.3` (the `formio/uag` and `formio/uag-engines` images carry their packages' version tags, `rc` included), and jsDelivr URLs such as `https://cdn.jsdelivr.net/npm/@formio/uag-js@2.0.0-rc.3/index.js`. The references write these as `{uagVersion}` (`@formio/uag` and its image), `{uagJsVersion}` (`@formio/uag-js`) and `{engineVersion}` (an engine).

Never write a range or a bare name instead. A range such as `@2`, `^2.0.0` or `~2.0.0` matches no prerelease, so `npm install` fails on it and jsDelivr answers `404`; `npm install` with a package name and no version, and an image with no tag, take `latest`. When the registry cannot be queried, write the dist-tag itself — `@formio/uag-js@rc`, `formio/uag:rc` — and tell the user to pin the version it resolves to. When the version written is a release candidate, tell the user so, and that moving to `2.0.0` once it is released is a version bump in these same places.

## Coming from UAG 1.x

Personas are now **tasks**: the components of a task carry its name in their `uag` custom property (the form itself is still tagged `uag`), and the Agent API, the MCP tools, `@formio/uag-js` and `uag-eval` take `task` (`persona` and the `agent_provide_data` tool were removed in 2.0). `/agent/provide` and its webhook pattern are replaced by "Agent: Run task" after the save; the root-level `/agent/extract`, `/agent/decide` and `/agent/generate` moved under each form (`{form}/agent/...`); `MONGO` is now the UAG's own database rather than a submission store; remote MCP sign-in is off unless `MCP_OAUTH=true` with that database. The UAG repository's `MIGRATING-2.0.md` lists every change.
