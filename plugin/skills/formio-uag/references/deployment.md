# Deploying the UAG

The UAG runs as the Docker image `formio/uag` (which includes every official engine), as `npx uag`, or embedded in a Node.js server. Write the deployment files into the user's working directory with every secret as a placeholder (`CHANGEME`, or `${VAR}` read from an `.env` the user fills from their secret store); never invent or reuse a real key.

## Contents

- [Compose stacks](#compose-stacks)
- [The three URLs](#the-three-urls)
- [Environment variables](#environment-variables)
- [Engines](#engines)
- [The UAG's database](#the-uags-database)
- [Connecting the Enterprise portal](#connecting-the-enterprise-portal)
- [Modules](#modules)
- [Embedding in a Node.js server](#embedding-in-a-nodejs-server)
- [Production checklist](#production-checklist)

## Compose stacks

### Form.io Open Source and the UAG

MCP and conversation forms (including the chat widget) work here with no license. `ADMIN_KEY` must match on both services.

```yaml
services:
  mongo:
    image: mongo:7
    restart: always
    volumes: [mongo-data:/data/db]

  formio:                              # Form.io Open Source, listening on 3001
    image: formio/formio
    restart: always
    depends_on: [mongo]
    ports: ["3000:3001"]
    environment:
      NODE_CONFIG: '{"mongo": "mongodb://mongo:27017/formio-oss", "jwt": {"secret": "${FORMIO_JWT_SECRET}"}, "mongoSecret": "${FORMIO_MONGO_SECRET}"}'
      ROOT_EMAIL: ${ROOT_EMAIL}
      ROOT_PASSWORD: ${ROOT_PASSWORD}
      ADMIN_KEY: ${ADMIN_KEY}
    healthcheck:                       # the UAG loads the project at startup, so wait for Form.io
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 5s
      retries: 40

  formio-uag:
    image: formio/uag
    restart: always
    depends_on:
      formio: { condition: service_healthy }
    ports: ["3200:3200"]
    environment:
      PROJECT: http://formio:3001      # how the UAG reaches Form.io, container to container
      ADMIN_KEY: ${ADMIN_KEY}
      JWT_SECRET: ${UAG_JWT_SECRET}
      UAG_ENGINES: claude              # an agent engine, for the chat widget
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
      CLAUDE_MODEL: claude-sonnet-5-5
      CORS: ${APP_ORIGIN}              # the application's origin
      PROJECT_TTL: 60

volumes:
  mongo-data:
```

### A project on Form.io's hosted service

Agentic Formflow is allowed with no license (`reason: "hosted"`). Create a project API key under **Project Settings → API Keys**. Leave `LICENSE_KEY` unset unless you add the UAG's database (`MONGO`), which needs one: with a key set, the project must be on that key's endpoint allowlist, or the UAG does not load it.

```bash
docker run -d --name formio-uag -p 3200:3200 \
  -e PROJECT="https://<project>.form.io" \
  -e PROJECT_KEY="$PROJECT_KEY" \
  -e JWT_SECRET="$UAG_JWT_SECRET" \
  -e UAG_ENGINES="jev,claude" -e TYPESAFE_API_KEY="$TYPESAFE_API_KEY" -e CLAUDE_API_KEY="$CLAUDE_API_KEY" \
  formio/uag
```

### Self-hosted Form.io Enterprise

`PROJECT` is the project endpoint (`http://formio-enterprise:3000/myproject`), with `PROJECT_KEY` and a `LICENSE_KEY` that includes the UAG and whose endpoint allowlist includes `PROJECT`'s host. Set `JWT_SECRET` to the Enterprise server's own when Run task actions act with an agent role ([workflows.md](./workflows.md#who-a-run-acts-as)), and `PORTAL_SECRET` to connect a portal stage.

## The three URLs

| Setting | Used by | Must be reachable from |
| --- | --- | --- |
| `PROJECT` | The UAG, to load the project and forward submissions | The UAG container. A container-to-container address is right. |
| `BASE_URL` (optional) | Remote MCP clients, through the OAuth discovery documents | Remote clients, over public HTTPS. Without it the UAG derives its URL from each request (`Host`, or the forwarded headers with `TRUST_PROXY`). |
| `LOGIN_FORM` | The user's browser, on `/auth/authorize` (only with `MCP_OAUTH`) | The browser. Defaults to `{PROJECT}/user/login`, usually not browser-reachable. |

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PROJECT` | **required** | The Open Source server's root, or the Enterprise or hosted project endpoint. |
| `ADMIN_KEY` / `PROJECT_KEY` | **one required** | `ADMIN_KEY` for Open Source; a project API key for Enterprise and hosted (setting it is what marks the project as Enterprise). Also accepted from callers as `x-admin-key` / `x-token`. |
| `JWT_SECRET` | random per start | **Set it, the same on every instance**, or tokens break on restart. Equal to Form.io Enterprise's for agent roles, and then equivalent to administrator access. |
| `JWT_EXPIRE_TIME` | `3600` | Minutes the UAG's access tokens last; refresh tokens twice as long. Keep it short in production. |
| `LICENSE_KEY` | none | A Form.io license that includes the UAG. `UAG_LICENSE` is deprecated, still read until UAG 3.0. |
| `UAG_ENGINES` | none | Engine instances to enable (below). Unset: no engines; MCP still works. |
| `PROJECT_TTL` | `900` | Seconds between project refreshes. `60` or more outside development; `0` disables them. |
| `TEMPLATE_SYNC` | `boot` | When a module's template is installed: `boot`, `refresh` or `off` (use `off` when stage deployments manage the project). |
| `CORS` | `true` (every origin) | `true` allows every origin, `false` turns CORS off, any other value is the **one** allowed origin (a comma-separated list is read as one literal origin). For several origins, set a `cors` options object in a module's `config` or `new UAGServer(config)`. |
| `TRUST_PROXY` | unset | Behind a reverse proxy: `true`, a hop count, or addresses. Also makes anonymous rate limits see visitors' addresses. |
| `MCP_OAUTH` | `false` | `true` turns on remote MCP sign-in. Needs `MONGO`. |
| `MONGO`, `UAG_DATABASE`, `MONGO_CONFIG` | none, `uag`, none | The UAG's own database (below). |
| `TASK_RUN_RETENTION_DAYS` | `90` | Days run records are kept; `0` keeps them forever. |
| `PORTAL_SECRET` | none | Lets a Form.io Enterprise portal stage connect to the UAG. |
| `AGENT_ANONYMOUS_RATE_LIMIT`, `AGENT_ANONYMOUS_TOTAL_RATE_LIMIT` | `10`, `100` | Anonymous agent requests a minute, per address and in total, per process. `0` turns anonymous use off. |
| `PROJECT_RETRIES`, `PROJECT_RETRY_DELAY` | `5`, `5000` | Retries while Form.io is still starting. |
| `UAG_MODULE` | none | For `npx uag` only: a module's path. The image loads `/app/module`. |
| `DEBUG` | unset | `formio:*`, `formio:uag*`, `formio:uag:runner`. |
| `PORT` | `3200` | |

## Engines

An **engine** connects the UAG to a model provider. None runs until `UAG_ENGINES` names it.

| Kind | Answers | Official engines |
| --- | --- | --- |
| Decision | Closed-set fields within its option limit, with a calibrated confidence. Fast (Jev: 70–500 ms). | `jev` (`TYPESAFE_API_KEY`, `TYPESAFE_MODEL` — pin a dated model such as `jev-1.13.0`); `openai` with `kind: decision` |
| Agent | Open values, and closed-set fields as an uncalibrated fallback; may research with `uagTools`; serves the chat | `claude` (`CLAUDE_API_KEY`, `CLAUDE_MODEL`, default `claude-opus-5-5`), `openai` (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` for Ollama or vLLM), `grok` (`XAI_API_KEY`, `XAI_MODEL`), `gemini` (`GEMINI_API_KEY`, `GEMINI_MODEL`) |
| Built in | `stub-decision`, `stub-agent` (placeholders, no keys, no license), `remote` (an engine on an engine server) | |

`UAG_ENGINES` lists instances as `<type>` or `<name>:<type>`, so one type can run twice with different settings; `UAG_ENGINE_<NAME>_<SETTING>` configures one instance and wins over the type's own variables:

```bash
UAG_ENGINES=jev,fast:claude,deep:claude
TYPESAFE_API_KEY=...
CLAUDE_API_KEY=...                       # shared by both Claude instances
UAG_ENGINE_FAST_MODEL=claude-haiku-5-5
UAG_ENGINE_DEEP_MODEL=claude-opus-5-5
```

A misconfigured engine (not installed, a duplicate name, a missing key) stops startup with the instance named.

**Routing.** Decision fields go to `['decision', 'agent']` and value fields to `['agent']` by default: decision engines first, falling back to agent engines when one fails, times out, is over its rate limit or none is enabled. A form overrides it with `uagEngine` on a field or the criteria; a deployment with `config.routing` and `routing.timeouts` in a module. Value fields of a task that researches go only to agent engines that support tool use.

**Which engines to enable** for each pattern: MCP needs none; the chat widget needs an agent engine; Agentic Formflow and Run task want a decision engine for closed-set fields plus an agent engine for open values (with only an agent engine, closed-set fields that a workflow must save need `uagAgentDecides`).

**Where data goes.** An engine sends a task's criteria, input, `uagContext` values and today's date to its provider (TypeSafe for `jev`, Anthropic for `claude`, OpenAI or the server it points at, xAI, Google). For data that must stay in the network, point `openai` at a local OpenAI-compatible server. To keep model keys and model traffic out of the UAG, run engines on an engine server (`formio/uag-engines`, with `UAG_ENGINE_SERVER_KEY`) and name them on the UAG as `remote` instances (`UAG_ENGINES=claude:remote`, `UAG_ENGINE_CLAUDE_URL`, `UAG_ENGINE_CLAUDE_KEY` of at least 32 characters). Custom engines are npm packages named `uag-engine-<type>`, built with `@formio/uag-sdk`.

## The UAG's database

Optional. `MONGO` (it may be the server Form.io uses; `UAG_DATABASE`, default `uag`, selects the database) holds only `uag-*` collections — sign-in codes, run records, the license outage marker — never submissions. It turns on:

| Feature | Without it |
| --- | --- |
| Remote MCP sign-in (`MCP_OAUTH`) | Off. Local clients still use `/auth/token`. |
| Run records, shown in a connected portal stage's Action Logs | Failures are only logged. |
| Runs after the save that survive a restart (actions with an agent role), shared safely across replicas | Kept in memory by the instance that received the submission. |
| A 12-hour license grace period when the license server is unreachable | None. |

It needs a license that includes the UAG on every edition, unless the project and the database are both on development hosts. Without one the UAG starts with these features off and says why. Give the `MONGO` user `readWrite` on `UAG_DATABASE` only.

## Connecting the Enterprise portal

So the portal can add "Agent: Run task" and show run records: set `PORTAL_SECRET` on the UAG to a long random secret and make the UAG reachable from the portal's browser; in the portal create an empty stage, open **Staging → Connect to an On-Premise Environment**, enter the UAG's root URL and the secret, choose **Subdirectories** as the project path type, then choose the project and **Connect Stage**. In that stage, forms and actions are read and saved through the UAG; team members keep their own permissions.

## Modules

A module is a JavaScript object that configures the UAG for a use case: a project template of forms, resources, roles and actions it installs when the project lacks them (`config.template`), custom MCP tools (`config.tools`), changes to the built-in tools (`config.toolOverrides`, `config.responseTemplates`), custom form actions (`actions`), hooks, and engine and routing configuration (`config.engines`, `config.routing`, `config.agentApi`). Mount it over `/app/module` in the image, name it in `UAG_MODULE` for `npx uag`, or pass it to `server.use()`.

```js
// module/index.js
module.exports = {
  config: {
    template: require('./project.json'),     // { "forms": {}, "resources": {}, "actions": { "claim:triage": { ... } } }
    routing: { decision: ['jev', 'agent'], value: ['deep'], timeouts: { jev: 2000, deep: 60000 } },
    agentApi: {
      rateLimits: { caller: { extract: { limit: 30 }, chat: { limit: 20 } } },
      chat: { engines: ['fast', 'deep'] },
    },
  },
};
```

```yaml
  formio-uag:
    image: formio/uag
    volumes:
      - ./module:/app/module
```

A template only adds what the project lacks, matched by key, and never changes a form or action the project already has. With `TEMPLATE_SYNC=boot`, a template form deleted from the project returns on the next restart. A mounted module cannot `require('@formio/uag')` (the image is that package); it can `require` the UAG's own dependencies, or bring its own `node_modules`. A module's custom actions run in the UAG; one registered under the name of a Form.io action (`save`, `login`, `role`, `webhook`, `email`, `group`) is never run by the UAG.

## Embedding in a Node.js server

```js
import Express from 'express';
import { UAGServer, trustProxySetting } from '@formio/uag';

const server = new UAGServer();             // configured by the environment variables above
// server.use(myModule);                    // before router()
const app = Express();
const trust = trustProxySetting(process.env.TRUST_PROXY);   // the image and `npx uag` do this themselves
if (trust !== undefined) app.set('trust proxy', trust);
app.use(await server.router());
app.listen(process.env.PORT || 3200);
```

Node 22 or newer, started with `--no-node-snapshot` (isolated-vm, which runs form logic, needs it), with the engines it enables installed beside it (`npm install @formio/uag @formio/uag-claude`).

## Production checklist

- Replace every placeholder secret: `ADMIN_KEY` / `PROJECT_KEY`, `JWT_SECRET`, `PORTAL_SECRET`, engine keys, database credentials. Keep them in a secret store, not in Compose files or images.
- Set `JWT_SECRET` explicitly and identically on every instance; choose a `JWT_EXPIRE_TIME` matching the session policy.
- Keep the UAG on a private network unless remote MCP clients must connect; then terminate TLS in front of it, publish only `{uagUrl}/mcp`, `/auth` and `/.well-known` — unless browsers also use the chat widget or Agent Input, which need the form routes (`{form}/agent/*` and submissions) too — and set `TRUST_PROXY` or `BASE_URL`.
- Restrict `CORS` to the application's origin (one origin; several need a `cors` object in configuration). Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` on a reachable deployment.
- Authenticate each person with their own token; reserve keys for server-side automation.
- Raise `PROJECT_TTL`; pin `formio/uag`, engine package versions and model names.
- Rate-limit callers and set anonymous limits and provider spend limits for public forms.
- Measure decision thresholds with `uag-eval` before relying on them.
- Run more than one instance only with the database (durable runs) and a shared `JWT_SECRET`; rate-limit counters are per process.
