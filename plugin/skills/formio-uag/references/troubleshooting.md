# Troubleshooting

Most UAG problems are configuration, and they surface far from their cause: a missing tag looks like a missing form, an unlicensed database looks like a sign-in page that does not exist. Hand the user the checks below to run; do not probe their deployment from this session.

## Contents

- [First checks](#first-checks)
- [Startup](#startup)
- [Forms agents cannot see](#forms-agents-cannot-see)
- [Authentication](#authentication)
- [The Agent API, Agent Input and the chat](#the-agent-api-agent-input-and-the-chat)
- [Run task workflows](#run-task-workflows)
- [Engines and engine servers](#engines-and-engine-servers)

## First checks

| Check | How |
| --- | --- |
| Is it running, and which edition? | The startup log: `[formio-uag] ... edition. Agentic Formflow ...`, then `Form.io UAG server running on port 3200`. |
| Engines, license, database features | `GET {uagUrl}/agent/capabilities` with a bearer token, or with `x-token` / `x-admin-key` from a server (never a browser): `engines`, `operations`, `edition`, `formflow.reason`, `durableRuns`, `mcpOAuth`. |
| What did one request do? | Every Agent API response carries `X-Request-Id`; search the UAG's log for it. `DEBUG=formio:*` for detail. |
| Why a field got its value | Post the data to `{form}/agent/decide` or `{form}/agent/generate` with the task and `overwrite: true`, and read each field's `status` and `reason`. Nothing is saved. |
| What did a task run do? | The submission's `metadata.uag`; the log line `Run task "<task>" failed for submission ...`; Action Logs in a connected classic-portal stage, with the database. |

## Startup

| Symptom | Cause |
| --- | --- |
| Exits with "No Form.io project could be loaded" | `PROJECT` is unreachable from inside the UAG container (a browser address instead of a container one), or paired with the wrong credential: `ADMIN_KEY` for Open Source, `PROJECT_KEY` (plus `LICENSE_KEY` when self-hosted Enterprise) for a project. |
| Exits on first boot, works after a restart | Form.io was not answering yet: add a healthcheck and `depends_on: condition: service_healthy`, or raise `PROJECT_RETRIES`. |
| Restart-loops with "Endpoint ... is not allowed for this license" | The license's endpoint allowlist does not include `PROJECT`'s host. |
| "License is not configured" for a `*.form.io` project | TLS checks are weakened (`NODE_TLS_REJECT_UNAUTHORIZED=0`, `NODE_EXTRA_CA_CERTS`, `NODE_USE_SYSTEM_CA`), which turns the hosted exemption off. |
| Startup stops naming an engine | Its package is not installed, the name is duplicated, a required setting (API key, model) is missing, or a `remote` instance's engine server refused its key. |
| "The database (MONGO) is not used: ... needs a license" | No license that includes the UAG, and the project and database are not both on development hosts. The UAG runs without database features. |
| "MCP_OAUTH is set, but remote MCP sign-in is off" | Sign-in needs a usable database. |
| Startup stops: "Could not connect to MONGO", "The MONGO user may not use the database", "MONGO_CONFIG is not valid JSON" | `MONGO` unreachable or its credentials wrong; grant the user `readWrite` on `UAG_DATABASE`; fix the driver options. |
| Startup stops: the database "holds uag-* collections that the UAG did not create", or "was created by a newer UAG" | Choose another `UAG_DATABASE`, or upgrade the UAG. Nothing was changed. |
| "@formio/uag needs Node started with --no-node-snapshot" | An embedding server started Node without the flag: `node --no-node-snapshot`, or `NODE_OPTIONS=--no-node-snapshot`. |
| The log warns "JWT_SECRET is not set" | Tokens last only as long as the process. Set `JWT_SECRET`, the same on every instance. |
| The log warns "MCP_OAUTH is on, but LOGIN_FORM is not set" | The sign-in page would load the login form from a container address. Set `LOGIN_FORM` to its public URL. |
| "@formio/uag needs @formio/appserver-core 2.25.1 or later, through @formio/appserver" | An embedding application installs an older `@formio/appserver`, or its lockfile resolves an older core. Upgrade `@formio/appserver`; do not add `@formio/appserver-core` directly. |
| "UAG server limit reached" | The online license's count of UAG servers is used up: each project endpoint served counts once. |
| Licensed features turn off when the license server is unreachable | No database, so no grace period; with it, the last confirmed license holds for 12 hours. Allow egress to `LICENSE_SERVER`. |
| `401` errors in the log right after starting | `PROJECT_KEY` or `ADMIN_KEY` is empty or does not belong to `PROJECT`. |

## Forms agents cannot see

| Symptom | Cause |
| --- | --- |
| An agent says a form does not exist; `get_forms` does not list it | The form is not tagged `uag`, or the change has not reached the UAG yet. Wait `PROJECT_TTL` seconds, or restart the UAG. |
| `{form}/agent/*` answers `404` "does not exist or is not tagged" | As above, or the URL is not the form's path or `form/{formId}` under the project's URL on the UAG (`/{projectName}` on Enterprise and hosted). |
| `POST /agent/extract` at the UAG's root answers `404` | Operations are under the form since 2.0: `{form}/agent/extract`. Only `/agent/capabilities` is at the root. |
| A change saved in the portal has no effect | The project cache has not refreshed; also confirm the form was saved, not only the component. |
| A module template change has no effect; a deleted form comes back | Templates only install what the project lacks, and `TEMPLATE_SYNC=boot` reinstalls deleted template forms. Change existing forms in the portal; use `TEMPLATE_SYNC=off` when stages manage the project. |

## Authentication

| Symptom | Cause |
| --- | --- |
| Every `{uagUrl}/mcp` request returns `401` | No `Authorization: Bearer <token>` (exchange a key at `/auth/token` first), or the token expired or was signed with another `JWT_SECRET`. |
| `/auth/token` returns `400` | Read the body's `error`: `invalid_client` is a wrong `client_id` prefix (`formio-oss-x-admin-key`, or `<project name>-x-token`) or secret; `invalid_grant` a used or expired code or an expired sign-in; `unsupported_grant_type` an unknown grant, or `authorization_code` with remote sign-in off. |
| `/.well-known/*` and `/auth/authorize` answer `404` | Remote sign-in is off: `MCP_OAUTH` is not `true`, or there is no usable database. |
| A remote connector cannot authenticate | The discovery documents name a URL it cannot reach, often `http` behind a TLS proxy. Set `TRUST_PROXY` and forward `Host` and `X-Forwarded-Proto`, or set `BASE_URL`. |
| The login page cannot load the form | `LOGIN_FORM` is not a login form JSON URL the browser can reach. |
| `mcp-remote` signs in as the wrong user | Delete `~/.mcp-auth` and sign in again. |
| `mcp-remote` or a connector asks to sign in again after a few hours | The session ends with the user's Form.io login token (Form.io's `jwt.expireTime`, 240 minutes by default), not `JWT_EXPIRE_TIME`. |
| A `refresh_token` exchange answers `400` | The Form.io login it wraps has expired: sign the user in again. `client_credentials` returns no refresh token; request a new token with the credentials. |
| `401` "Admin credentials cannot be used from a browser. Use a bearer token." | A key was sent from a page to an agent operation. Use the user's token or a relay. |
| `401` "Scoped tokens can only be used on /mcp." | A research token from a remote engine was used to start new work. |
| Tokens stop working after a restart or on another instance | `JWT_SECRET` is unset or differs between instances. |
| A browser call with a key returns `401` | Keys are refused from browsers. Send the user's `x-jwt-token`, or use a relay. |
| `401` "Sign in to use this form's agent operations." | No credential and the form does not allow anonymous use (`uagAnonymous`, and anonymous limits not `0`). |
| `403` "Anonymous visitors may not submit this form." | `uagAnonymous` is on but the Anonymous role may not create submissions. |
| `429` for anonymous visitors | Over `AGENT_ANONYMOUS_RATE_LIMIT` or the total. Behind a proxy without `TRUST_PROXY`, every visitor shares the proxy's address and one allowance. |

## The Agent API, Agent Input and the chat

| Symptom | Cause |
| --- | --- |
| `403` with `code: "license_required"` | Agentic Formflow is not allowed: no license that includes the UAG for the project's endpoint, and not a hosted project. Conversation forms and the chat are unaffected. |
| `503` "No enabled engine can serve" | `UAG_ENGINES` is unset or names no engine for the work. The chat needs an agent engine. |
| `400` 'UAG 2.0 renamed "persona" to "task"' | The request still sends 1.x's `persona`. Send `task`. |
| `400` naming the task | Unknown task, extract without `text` for a task with no input, or a write/unknown tool in `uagTools`. |
| Decision fields come back `suggested`, `calibrated: false` | No decision engine is enabled, or it failed, so an agent engine answered. |
| A field is always `uncertain` | The answer flips when options are reversed (rewrite ambiguous labels, or `uagOrderCheck: "false"`), the mention check is in the band, or `uagThreshold` is above what the engine reaches. Measure with `uag-eval`. |
| A field is never answered | It is in `excluded`: already filled (send `overwrite`), hidden by conditionals, in a grid, not requested by this operation, or a confidence companion. |
| Hiding a page wiped the values that decided it | Set `clearOnHide: false` on the decision fields themselves. |
| Agent Input does nothing | The form has no task with an input, the form was rendered from a definition without `_id`, `agentInput` is `false`, or the module was registered on another copy of `@formio/js`. |
| CORS errors in the browser | Allow the application's origin in the UAG's `CORS` (several separated by commas). |
| Agent Input's results arrive all at once, or the request times out behind a proxy | The proxy buffers the event stream or cuts long requests: turn buffering off for `text/event-stream` and raise read timeouts ([deployment.md](./deployment.md#behind-a-reverse-proxy)). |
| `413` | The body is over 5 MB for an agent operation, over `MAX_BODY_SIZE` for anything else, or over the proxy's own limit (nginx: `client_max_body_size`). |
| Template overrides for the chat have no effect | They were keyed `bootstrap5`; key them by `Formio.Templates.framework` (`bootstrap` on a default install). |
| "This form is not available for chat." | Not tagged `uag`, or rendered from a definition without its `_id`. |
| The chat never offers to submit | A required field is one the chat cannot collect (it opens the form for it), or a value fails validation. |
| `403` on every chat turn | The user cannot create the form's submissions, or the form sets `uagChat: "false"`. |
| `502` on a chat turn | Every engine failed; the UAG's log has their errors under the `requestId`. |

## Run task workflows

| Symptom | Cause |
| --- | --- |
| Nothing happens after submitting | The submission went to Form.io, not the UAG; the action's method or condition does not match; its Task is not set; or a run after the save failed (check the log). |
| `action_create` refuses `agentRunTask` | Expected: Form.io's action catalog does not list the UAG's action. Add it in a template, a connected portal stage, a module, or with Form.io's action API ([workflows.md](./workflows.md#adding-the-action)). |
| "Agent: Run task" opens as a blank page in the portal | The stage is not connected to the UAG. |
| A submission is refused with `503` or `429` | A decisions-only run before the save could not decide some fields. Nothing was stored. |
| A run fails: the token is not accepted | No agent role, and the submitter's token expired or was logged out before the run. |
| A run after the save fails with `404` "Submission ... was not found" | No agent role, and the submitter may not read the submission: grant Read Own. |
| "JWT_SECRET must be the same as Form.io Enterprise's" | The action names an agent role and the secrets differ. |
| `403` "You may not submit this form." | The user's roles may not create, and they hold no submitter role, or the agent role lacks Create All. |
| "... its Run task actions name different agent roles." | Several Run task actions on create name different agent roles. |
| "An agent cannot act with an admin role." | The agent role is an admin role. |
| Closed-set fields are never saved | Only an agent engine is enabled: add `uagAgentDecides: "true"`, or a decision engine. |
| An agent runs continuously | A Run task on update whose condition stays true after its own save. The UAG stops such a chain after 5 runs. |
| A Run task never runs, and the log says its conditions use an operator Form.io does not know | Fix the operator; the log line lists the accepted ones. An unknown operator never runs the action. |
| A value the client sent is not stored | The field is `uagAuthoritative` in a task a Run task runs: only the task sets it. |
| Some task fields are filled, others not | The others lack the task's exact `uag` value, already had a value, or are hidden by conditionals. |
| Runs are lost on restart | No usable database (`durableRuns: false`), or the action names no agent role. |
| The submitter waits a long time | The run is before the save; set **When** to after the save unless the answer must be in the response. |

## Engines and engine servers

| Symptom | Cause |
| --- | --- |
| A remote engine fails with `401` | `UAG_ENGINE_<NAME>_KEY` differs from the engine server's `UAG_ENGINE_SERVER_KEY`. |
| "does not host an engine named ..." | Set `UAG_ENGINE_<NAME>_ENGINE` to the engine's name on the server. |
| An engine is passed over: "does not support tool use" | The task lists `uagTools` and that engine cannot call tools. |
| A local model through Ollama returns nothing useful | It must support structured outputs, and tool calling for tasks that research. |

To report a UAG bug, include the UAG version, the failing request's `X-Request-Id` and the matching log lines. Security issues go privately to `security@form.io`.
