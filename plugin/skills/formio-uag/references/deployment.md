# Deploying the UAG

The UAG runs as the Docker image `formio/uag` (which includes every official engine), as `npx uag`, or embedded in a Node.js server. Pin the image and every package to the exact version resolved as [patterns-and-licensing.md](./patterns-and-licensing.md#versions) describes; `{uagVersion}` below is that version of `@formio/uag`, which the image is tagged with too. An unpinned `formio/uag` is `latest`, which is UAG 1.x until 2.0.0 is released. Write the deployment files into the user's working directory with every secret as a placeholder (`CHANGEME`, or `${VAR}` read from an `.env` the user fills from their secret store); never invent or reuse a real key.

## Contents

- [Compose stacks](#compose-stacks)
- [Health checks](#health-checks)
- [Behind a reverse proxy](#behind-a-reverse-proxy)
- [Kubernetes](#kubernetes)
- [The three URLs](#the-three-urls)
- [Environment variables](#environment-variables)
- [Engines](#engines)
- [The UAG's database](#the-uags-database)
- [Connecting the Enterprise portal](#connecting-the-enterprise-portal)
- [Modules](#modules)
- [Embedding in a Node.js server](#embedding-in-a-nodejs-server)
- [Running more than one instance](#running-more-than-one-instance)
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
    image: formio/uag:{uagVersion}
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
docker run -d --name formio-uag --restart unless-stopped -p 3200:3200 \
  -e PROJECT="https://<project>.form.io" \
  -e PROJECT_KEY="$PROJECT_KEY" \
  -e JWT_SECRET="$UAG_JWT_SECRET" \
  -e CORS="$APP_ORIGIN" \
  -e UAG_ENGINES="jev,claude" -e TYPESAFE_API_KEY="$TYPESAFE_API_KEY" -e CLAUDE_API_KEY="$CLAUDE_API_KEY" \
  -e CLAUDE_MODEL="claude-sonnet-5-5" -e PROJECT_TTL=300 \
  formio/uag:{uagVersion}
```

### Self-hosted Form.io Enterprise

`PROJECT` is the project endpoint (`http://formio-enterprise:3000/myproject`), with `PROJECT_KEY` and a `LICENSE_KEY` that includes the UAG and whose endpoint allowlist includes `PROJECT`'s host. Set `JWT_SECRET` to the Enterprise server's own when Run task actions act with an agent role ([workflows.md](./workflows.md#who-a-run-acts-as)), and `PORTAL_SECRET` to connect a portal stage.

```yaml
services:
  formio-enterprise:                   # already deployed; shown for the variables the UAG shares with it
    image: formio/formio-enterprise:<pinned>
    environment:
      PORT: 3000
      LICENSE_KEY: ${LICENSE_KEY}
      JWT_SECRET: ${FORMIO_JWT_SECRET}
      # ...MONGO, DB_SECRET, admin account and portal settings as for any Enterprise deployment
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 5s
      retries: 60

  formio-uag:
    image: formio/uag:{uagVersion}
    restart: always
    depends_on:
      formio-enterprise: { condition: service_healthy }
    ports: ["3200:3200"]
    environment:
      PROJECT: http://formio-enterprise:3000/myproject
      PROJECT_KEY: ${PROJECT_KEY}          # must already exist on the project (Project Settings -> API Keys)
      LICENSE_KEY: ${LICENSE_KEY}          # the same Form.io license; it must include the UAG
      JWT_SECRET: ${FORMIO_JWT_SECRET}     # Form.io's own, only when an agent role acts for users
      PORTAL_SECRET: ${UAG_PORTAL_SECRET}  # only to connect a portal stage
      UAG_ENGINES: jev,claude
      TYPESAFE_API_KEY: ${TYPESAFE_API_KEY}
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
      CLAUDE_MODEL: claude-sonnet-5-5
      CORS: ${APP_ORIGIN}
      PROJECT_TTL: 300
```

The project and its API key must exist before the UAG starts, or it exits with "No Form.io project could be loaded". In a brand-new stack, create them first (in the portal, or with a one-off setup job that `depends_on` Form.io's health and that the UAG `depends_on` with `condition: service_completed_successfully`, as the UAG repository's `demo/docker-compose.enterprise.yml` does).

### An `.env.example`

Write one beside every stack, with each secret as a placeholder and a note on how to generate it:

```bash
# Form.io
PROJECT_KEY=CHANGEME            # Project Settings -> API Keys (Enterprise, hosted)
ADMIN_KEY=CHANGEME              # Open Source only; the same value on Form.io and the UAG
LICENSE_KEY=CHANGEME            # self-hosted Enterprise, Agentic Formflow off the hosted service, or MONGO
# The UAG
UAG_JWT_SECRET=CHANGEME         # openssl rand -hex 32; the same on every instance
APP_ORIGIN=https://app.example.com
# Engines
TYPESAFE_API_KEY=CHANGEME
CLAUDE_API_KEY=CHANGEME
```

## Health checks

`GET {uagUrl}/status` needs no credential and answers `200` with a small JSON object of package versions. The UAG opens its port only after the project is loaded, the engines are enabled and the database (if any) is checked, so a `200` from `/status` means it is serving. Use it for Compose healthchecks, load-balancer checks and Kubernetes probes; it calls no model and does not touch Form.io. For a deeper check from a server, `GET /agent/capabilities` with the key reports engines and license state. The `formio/uag` image declares a `HEALTHCHECK` on it.

```yaml
  formio-uag:
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3200/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 10s
      retries: 30
```

## Behind a reverse proxy

Anything public goes through TLS in front of the UAG. What the proxy must do:

- **Forward `Host` and `X-Forwarded-Proto`** (and `X-Forwarded-For`), and set `TRUST_PROXY` on the UAG to the number of proxy hops (`1`) or the proxy's addresses. The UAG then names its public `https` URL in the OAuth documents, and counts anonymous limits per visitor rather than per proxy. When the proxy cannot forward them correctly, set `BASE_URL` to the public URL instead.
- **Not buffer streams.** Agent Input's `extract` is a Server-Sent Events stream. The UAG sends `X-Accel-Buffering: no`, which nginx honours; for other proxies and load balancers, turn response buffering off for `text/event-stream`.
- **Allow long requests.** A Run task before the save holds the submission until the engines answer, and research may take up to `agentApi.research.timeout` (120 seconds). Set read timeouts to at least 180 seconds.
- **Allow the body sizes the forms need.** nginx's default `client_max_body_size` is `1m`; submissions with base64 files and agent operations (up to 5 MB) need more. The UAG's own limit is `MAX_BODY_SIZE` (default `16mb`, as Form.io's).
- **Publish only what is used.** Remote MCP clients need `{uagUrl}/mcp`, `/auth` and `/.well-known`. Browsers using `@formio/uag-js` or the chat need the project's form, submission and `agent` paths too. `/status` reveals only package versions.

```nginx
server {
    listen 443 ssl;
    server_name uag.example.com;
    # ssl_certificate ... ;
    client_max_body_size 20m;

    location / {
        proxy_pass http://formio-uag:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 180s;
    }
}
```

The UAG repository's `demo/samples/custom-module` is a tested layout that puts Form.io and the UAG behind one nginx origin, routing only the UAG's MCP endpoint, `/auth` and `/.well-known` to it.

## Kubernetes

The UAG is a stateless Deployment behind a Service. Keep secrets in a Secret (or an external secret store), pin the image, and probe `/status`. Give the startup probe time for `PROJECT_RETRIES` × `PROJECT_RETRY_DELAY` while Form.io starts. Run one replica unless the UAG has its database and a shared `JWT_SECRET` ([Running more than one instance](#running-more-than-one-instance)).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: formio-uag }
spec:
  replicas: 1
  selector: { matchLabels: { app: formio-uag } }
  template:
    metadata: { labels: { app: formio-uag } }
    spec:
      containers:
        - name: uag
          image: formio/uag:{uagVersion}
          ports: [{ containerPort: 3200 }]
          env:
            - { name: PROJECT, value: "http://formio.formio.svc.cluster.local:3000/myproject" }
            - { name: UAG_ENGINES, value: "jev,claude" }
            - { name: CLAUDE_MODEL, value: "claude-sonnet-5-5" }
            - { name: CORS, value: "https://app.example.com" }
            - { name: TRUST_PROXY, value: "1" }
            - { name: PROJECT_TTL, value: "300" }
          envFrom:
            - secretRef: { name: formio-uag }   # PROJECT_KEY, JWT_SECRET, LICENSE_KEY, TYPESAFE_API_KEY, CLAUDE_API_KEY, MONGO
          startupProbe:
            httpGet: { path: /status, port: 3200 }
            periodSeconds: 5
            failureThreshold: 60
          readinessProbe:
            httpGet: { path: /status, port: 3200 }
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /status, port: 3200 }
            periodSeconds: 30
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits: { memory: 1Gi }
---
apiVersion: v1
kind: Service
metadata: { name: formio-uag }
spec:
  selector: { app: formio-uag }
  ports: [{ port: 3200, targetPort: 3200 }]
```

The resource figures are a starting point, not a measurement: form logic runs in `isolated-vm`, and memory grows with the number and size of forms. Expose the Service through the cluster's Ingress with the proxy rules above (buffering off for event streams, a long read timeout, a large enough body size). A module is mounted at `/app/module` from a ConfigMap or a volume; an engine server is a second Deployment whose Service is reachable only from the UAG.

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
| `JWT_SECRET` | random per start, with a startup warning | **Set it, the same on every instance**, or tokens break on restart. Equal to Form.io Enterprise's for agent roles, and then equivalent to administrator access. |
| `JWT_EXPIRE_TIME` | `60` | Minutes the UAG's access tokens last (an upper bound: a token signed in through `MCP_OAUTH` ends with the user's Form.io login token, 240 minutes by default). Refresh tokens cannot outlive it. Keep it short in production. |
| `LICENSE_KEY` | none | A Form.io license that includes the UAG. `UAG_LICENSE` is deprecated, still read until UAG 3.0. |
| `LICENSE_REMOTE`, `LICENSE_SERVER` | unset, `https://license.form.io` | `true` for an offline license; the server online licenses are validated with (the UAG needs egress to it). |
| `LOGIN_FORM` | `{PROJECT}/user/login` | With `MCP_OAUTH`: the login form JSON URL the user's browser loads. |
| `UAG_ENGINES` | none | Engine instances to enable (below). Unset: no engines; MCP still works. |
| `PROJECT_TTL` | `900` | Seconds between project refreshes. `60` or more outside development; `0` disables them. |
| `TEMPLATE_SYNC` | `boot` | When a module's template is installed: `boot`, `refresh` or `off` (use `off` when stage deployments manage the project). |
| `CORS` | `true` (every origin) | `true` allows every origin, `false` turns CORS off, any other value is the allowed origin, or several separated by commas (`https://app.example.com,https://admin.example.com`). |
| `TRUST_PROXY` | unset | Behind a reverse proxy: `true`, a hop count, or addresses. Also makes anonymous rate limits see visitors' addresses. |
| `MCP_OAUTH` | `false` | `true` turns on remote MCP sign-in. Needs `MONGO`. |
| `MONGO`, `UAG_DATABASE`, `MONGO_CONFIG` | none, `uag`, none | The UAG's own database (below). |
| `TASK_RUN_RETENTION_DAYS` | `90` | Days run records are kept; `0` keeps them forever. |
| `PORTAL_SECRET` | none | Lets a Form.io Enterprise portal stage connect to the UAG. |
| `AGENT_ANONYMOUS_RATE_LIMIT`, `AGENT_ANONYMOUS_TOTAL_RATE_LIMIT` | `10`, `100` | Anonymous agent requests a minute, per address and in total, per process. `0` turns anonymous use off. |
| `PROJECT_RETRIES`, `PROJECT_RETRY_DELAY` | `5`, `5000` | Retries while Form.io is still starting. |
| `MAX_BODY_SIZE` | `16mb` | Largest JSON body, as Form.io's; bodies are parsed before authentication, so raise it only as far as the forms need. A form's agent operations take at most 5 MB whatever it is. |
| `NODE_TLS_REJECT_UNAUTHORIZED` | unset | `0` accepts a self-signed `PROJECT` certificate. Never on a reachable deployment; it also turns off the hosted-service exemption. Prefer adding the CA (which turns the exemption off too). |
| `UAG_MODULE` | none | For `npx uag` only: a module's path. The image loads `/app/module`. |
| `DEBUG` | unset | `formio:*`, `formio:uag*`, `formio:uag:runner`. |
| `PORT` | `3200` | |

## Engines

An **engine** connects the UAG to a model provider. None runs until `UAG_ENGINES` names it.

| Kind | Answers | Official engines |
| --- | --- | --- |
| Decision | Closed-set fields within its option limit, with a calibrated confidence. Fast (Jev: 70–500 ms). | `jev` (`TYPESAFE_API_KEY`, `TYPESAFE_MODEL` — pin a dated model such as `jev-1.13.0`); `openai` with `kind: decision` |
| Agent | Open values, and closed-set fields as an uncalibrated fallback; may research with `uagTools`; serves the chat | `claude` (`CLAUDE_API_KEY`, `CLAUDE_MODEL`, default `claude-opus-5-5`), `openai` (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` for Ollama, vLLM or another OpenAI-compatible server — which never receives `OPENAI_API_KEY`: give it its own key as `UAG_ENGINE_<NAME>_API_KEY`), `grok` (`XAI_API_KEY`, `XAI_MODEL`), `gemini` (`GEMINI_API_KEY`, `GEMINI_MODEL`) |
| Built in | `stub-decision`, `stub-agent` (placeholders, no keys, no license), `remote` (an engine on an engine server) | |

`OPENAI_MODEL`, `XAI_MODEL` and `GEMINI_MODEL` have no default, and startup stops without them. `openai` answers decisions with `OPENAI_KIND=decision` (or `UAG_ENGINE_<NAME>_KIND`).

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
    image: formio/uag:{uagVersion}
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

Node 22 or newer, started with `--no-node-snapshot` (isolated-vm, which runs form logic, can crash the process without it; or `NODE_OPTIONS=--no-node-snapshot` — the constructor refuses to start without it), with the engines it enables installed beside it (`npm install @formio/uag@{uagVersion} @formio/uag-claude@{engineVersion} express`, each version resolved on its own, since engines are versioned independently of the UAG).

What breaks an embedded UAG:

- **Remote MCP sign-in needs a host's root.** The UAG can be mounted under a path (`app.use('/uag', await server.router())`, with `https://app.example.com/uag` as the UAG URL): the Agent API, the chat, submissions, `/status` and the MCP endpoint with `client_credentials` all work there. With `MCP_OAUTH`, MCP clients look for the OAuth discovery documents at the root of the host, so give the UAG a host name of its own.
- **Register the application's own routes first** when the UAG is mounted at the root. Requests the UAG does not serve fall through to later routes, except those with an admin credential (`x-admin-key`, `x-token`), which it forwards to Form.io.
- **Load `.env` yourself.** `new UAGServer()` reads `process.env`; only the `uag` command and the image load a `.env` file (`require('dotenv/config')` first).
- **Build tools in the image.** `isolated-vm` compiles on install: `make`, `python3` and `g++` (`apk add make python3 g++` on Alpine) in the build stage.
- **One Form.io server package.** `@formio/uag` depends only on `@formio/appserver` (2.25.1 or later), which brings `@formio/appserver-core`. Do not add `appserver-core` yourself or pin an older `@formio/appserver`; the constructor throws "@formio/uag needs @formio/appserver-core 2.25.1 or later, through @formio/appserver" when the lockfile resolves an older one.
- **Configuration precedence.** A module's `config`, then the constructor's, then the environment. `config.engines` replaces `UAG_ENGINES` when set.
- **`router()` rejects** when the project cannot be loaded, an engine is misconfigured or the database may not be used. Exit on it, as the example does, so the process manager restarts it.

To ship fewer engines than the official image, build an image of your own: `npm install --omit=dev @formio/uag@{uagVersion}` plus only the engine packages it enables, `ENV NODE_OPTIONS=--no-node-snapshot`, and `ENTRYPOINT ["node_modules/.bin/uag"]` (`UAG_MODULE` names a module). Naming an engine that is not installed stops startup.

## Running more than one instance

The UAG holds no conversation state and its MCP endpoint is stateless, so instances can sit behind a load balancer, with no sticky sessions:

- The same `JWT_SECRET` on every instance, or each refuses the others' tokens.
- The same `MONGO` and `UAG_DATABASE`, for remote MCP sign-in (an authorization code issued by one instance is exchanged at another) and for run records. A run after the save survives an instance stopping only with the database and an action that names an agent role; any other run lives in the instance that received the submission.
- Rate limits, anonymous limits included, are per process: the total allowance is replicas × the limit.
- Each instance refreshes the project on its own `PROJECT_TTL` timer, so instances can briefly serve different versions of a form.
- With `TEMPLATE_SYNC=boot` every instance installs missing template items at startup; instances starting together install nothing twice. For large fleets, set `off` and provision once.

## Production checklist

- Replace every placeholder secret: `ADMIN_KEY` / `PROJECT_KEY`, `JWT_SECRET`, `PORTAL_SECRET`, engine keys, database credentials. Keep them in a secret store, not in Compose files or images.
- Set `JWT_SECRET` explicitly and identically on every instance; choose a `JWT_EXPIRE_TIME` matching the session policy.
- Keep the UAG on a private network unless remote MCP clients must connect; then terminate TLS in front of it, publish only `{uagUrl}/mcp`, `/auth` and `/.well-known` — unless browsers also use the chat widget or Agent Input, which need the form routes (`{form}/agent/*` and submissions) too — and set `TRUST_PROXY` or `BASE_URL`.
- Restrict `CORS` to the applications' origins (comma-separated). Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` on a reachable deployment.
- Authenticate each person with their own token; reserve keys for server-side automation.
- Raise `PROJECT_TTL`; pin `formio/uag`, engine package versions and model names.
- Rate-limit callers and set anonymous limits and provider spend limits for public forms.
- Measure decision thresholds with `uag-eval` before relying on them.
- Run more than one instance only with the database (durable runs) and a shared `JWT_SECRET`; rate-limit counters are per process.
- On an online license, allow egress to the license server and add the database, which gives a 12-hour grace period when the license server is unreachable; without it, licensed features stop at once.
- Health-check `/status`, and let the orchestrator restart the UAG when it exits: it exits rather than serve half-configured.
