# Conversation forms over MCP

The UAG serves the Model Context Protocol at `{uagUrl}/mcp`. Any MCP client can connect — Claude Desktop, claude.ai connectors, Claude Code, or an application written with an MCP SDK — and use the project's `uag` forms: list them, learn their fields, validate answers, submit, search and update, always as the signed-in caller. The model runs in the client; the UAG supplies context and performs every write through the form's validation and the caller's permissions. No license is needed on Form.io Open Source or the hosted service, except for the two Agentic Formflow tools, `agent_provide` and `agent_decide`, which answer `license_required` without one (or a hosted project).

This MCP server is the user's runtime surface, distinct from the Form.io MCP server this skill library uses at build time. Write configuration and client code for it; do not connect to it from this session.

## Contents

- [The endpoint](#the-endpoint)
- [How a client gets a token](#how-a-client-gets-a-token)
- [Connecting Claude](#connecting-claude)
- [The tools](#the-tools)
- [The conversation sequence](#the-conversation-sequence)
- [A minimal MCP client](#a-minimal-mcp-client)
- [Shaping the agent with a module](#shaping-the-agent-with-a-module)

## The endpoint

| | |
| --- | --- |
| URL | `{uagUrl}/mcp` |
| Transport | Streamable HTTP: `POST` for JSON-RPC, `GET` for the server stream. Stateless: no session id to keep, requests can run concurrently. |
| Server name | `formio-uag` |
| Authentication | `Authorization: Bearer <UAG access token>` on every request; otherwise `401` with `WWW-Authenticate: Bearer realm="uag-server"` (and `resource_metadata` when remote sign-in is on). |
| Tools | Built per request from the forms registered now, plus a module's custom tools. Every tool's `form_name` argument is an enum of the registered form names. |

## How a client gets a token

| Connection | Who runs the client | Public URL needed | Authentication |
| --- | --- | --- | --- |
| **Local** | The user's own server, script or engine server, next to the UAG | No: `localhost` or a private address | `client_credentials` at `/auth/token` with a server key. Always on. |
| **Remote** | claude.ai and Claude Desktop custom connectors, the Anthropic MCP connector, `mcp-remote` | For connectors, yes: `{uagUrl}/mcp`, `/auth/*` and `/.well-known/*` over HTTPS. `mcp-remote` runs on the user's machine, so a local URL works. | OAuth 2.0 authorization code with PKCE (`S256`), in the browser, with the project's own login form. Needs `MCP_OAUTH=true` and the UAG's database (`MONGO`, licensed unless the project and the database are both on development hosts). |

### Local clients: `client_credentials`

| Deployment | `client_id` | `client_secret` |
| --- | --- | --- |
| Form.io Open Source | `formio-oss-x-admin-key` | The Form.io server's `ADMIN_KEY` |
| Form.io Enterprise, hosted | `<project name>-x-token` (the project's `name` setting) | The project API key, `PROJECT_KEY` |

```http
POST /auth/token
Content-Type: application/json

{ "grant_type": "client_credentials", "client_id": "formio-oss-x-admin-key", "client_secret": "<ADMIN_KEY>" }
```

```json
{ "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 3600, "scope": "formio" }
```

`expires_in` is `JWT_EXPIRE_TIME` minutes times 60. Cache the token and request a new one with `client_credentials` shortly before it expires; this grant returns no refresh token. Refusals are OAuth errors (RFC 6749), `400` with `{ "error": "invalid_client", "error_description": "..." }` for a wrong `client_id` prefix or secret (`invalid_request`, `invalid_grant` and `unsupported_grant_type` for the other cases). A `401` from `{uagUrl}/mcp` is RFC 6750's: `WWW-Authenticate` names `error="invalid_token"` when a token was sent, and the body is `{ error, error_description }`. **A `client_credentials` token acts as the project administrator**: every tool call may read and write anything in the project. Use it for trusted automation only; anything acting for a person should present that person's own token.

### Remote clients: OAuth with PKCE

A signed-in session lasts as long as the user's Form.io login token, whatever `JWT_EXPIRE_TIME` says: Form.io's `jwt.expireTime` (240 minutes by default), after which `mcp-remote` or the connector asks the user to sign in again. Raise Form.io's setting, not the UAG's, for longer sessions.

The client discovers everything itself: `401` with `resource_metadata` → `/.well-known/oauth-protected-resource` → `/.well-known/oauth-authorization-server` → dynamic registration at `/auth/register` → the browser opens `/auth/authorize`, which loads the project's login form from `LOGIN_FORM` → the code is exchanged at `/auth/token` with the `code_verifier`. Every later tool call runs as that user.

What the UAG needs for it:

- `MCP_OAUTH=true` and `MONGO` (with a license that includes the UAG, unless both the project and the database are on development hosts such as `formio.local` and `mongo.local`). Without a usable database the UAG starts with sign-in off and says why; `/.well-known/*` and `/auth/authorize` answer `404`.
- `LOGIN_FORM` set to a login form JSON URL the user's **browser** can load, such as `https://forms.example.com/user/login` (Open Source) or `https://forms.example.com/myproject/user/login` (Enterprise). The default, `{PROJECT}/user/login`, is usually a container address.
- A public URL the discovery documents name correctly: behind a reverse proxy set `TRUST_PROXY` and forward `Host` and `X-Forwarded-Proto`; when TLS ends in front of that proxy, set `BASE_URL` to the public `https` URL. Check with `curl https://uag.example.com/.well-known/oauth-protected-resource`.
- For connectors, publish only `{uagUrl}/mcp`, `/auth` and `/.well-known` publicly, unless browsers also use the chat widget or Agent Input, which need the form routes as well.

## Connecting Claude

**Claude Desktop, any plan, through `mcp-remote`** (the UAG need not be public). Sign in once from a terminal with `npx mcp-remote http://localhost:3200/mcp` (the browser opens the UAG's login page; the token is cached under `~/.mcp-auth`, which the user deletes to sign in as someone else), then add to `claude_desktop_config.json` (**Developer → Open App Config File**) and restart Claude Desktop:

```json
{
  "mcpServers": {
    "formio-uag": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3200/mcp"]
    }
  }
}
```

**claude.ai and Claude Desktop custom connectors** (plans with connectors). The UAG must be public over HTTPS with remote sign-in configured as above. In Claude: **Settings → Connectors → Add custom connector**, name it, enter `https://uag.example.com/mcp`, then **Connect** and sign in. For a local test, a tunnel to the proxy works with `BASE_URL` set to the tunnel's `https` URL and `LOGIN_FORM` at the tunnel's login form.

**Claude Code** connects to the same endpoint as a remote HTTP MCP server (`claude mcp add --transport http formio-uag https://uag.example.com/mcp`), signing in through the same OAuth flow.

**Roles and permissions govern the agent.** The agent can do exactly what the signed-in user can do, because every tool call runs as that user; there is no separate agent policy. Scope each form's submission access per role, and give agents to users whose roles are scoped to what they need — an agent acting for an administrator can read and change anything.

## The tools

| Tool | Annotation | What it does |
| --- | --- | --- |
| `get_forms` | Reads | Lists the tagged forms with the caller's create, read and update permissions on each. Call it first. |
| `get_form_fields` | Reads | Fields with label, `data_path`, type, description and value rule (`criteria`: `required`, `optional`, `all`; `parent_path` for nested forms and grids). |
| `get_field_info` | Reads | Full detail for chosen `field_paths`: required, format, options, validation. |
| `collect_field_data` | Reads | Applies `updates` (`{ data_path, new_value }[]`) to `form_data`, validates, and reports errors or what is still missing. Saves nothing. |
| `confirm_form_submission` | Reads | A summary of `form_data` for the user to approve. |
| `submit_completed_form` | Creates | Validates and submits `form_data` through the UAG, so the form's Run task actions and Form.io's actions run. |
| `find_submissions` | Reads | Searches (`search_query` of `{ data_path, operator, search_value }`, operators `equals`, `contains`, `regex`, `in`, `greater_than`, ...), counts, or loads one by `submission_id`. |
| `submission_update` | Overwrites | Applies `updates` to an existing submission, with full validation. |
| `agent_provide` | Reads | A task's criteria, a submission's values and the task's fields, as instructions for the client's own model, which then writes with `submission_update`. Agentic Formflow. |
| `agent_decide` | Reads | A task's decision questions as JSON, for the client's own decision model. Agentic Formflow. |
| `fetch_external_data` | Reads | Options for a URL- or resource-fed select, or a Data Source value. |

`form_data` is the conversation's state, kept by the client and sent on every call: a flat object of data path to value (`{ "customer.firstName": "Joe", "children[0].age": 5 }`). Results are Markdown text rendered from response templates a module can override; a problem sets `isError: true`.

## The conversation sequence

What a form-driven agent's system prompt should describe:

1. `get_forms` — choose the form that matches what the user wants; never assume a form exists.
2. `get_form_fields` — learn what it needs.
3. `get_field_info` — before asking about a field, learn its type, rules and exact options.
4. `collect_field_data` — record answers as they come, several at once.
5. `confirm_form_submission` — show a summary and ask the user to confirm.
6. `submit_completed_form` — only after the user confirms.

To change a record: `find_submissions`, then `submission_update` after the user confirms.

## A minimal MCP client

A chat client that gets a token, connects to `{uagUrl}/mcp`, offers the UAG's tools to Claude, and runs the tool loop. It holds no form-specific knowledge: change the form and the conversation changes. (To put a conversation on a web page without running a loop like this, use the chat widget instead.)

```js
// chat.mjs — node chat.mjs "I need to report that my internet is down"
// npm install @anthropic-ai/sdk @modelcontextprotocol/sdk
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const UAG_URL = process.env.UAG_URL;                   // the UAG URL
const CLIENT_ID = process.env.UAG_CLIENT_ID;           // formio-oss-x-admin-key, or <project>-x-token
const CLIENT_SECRET = process.env.UAG_CLIENT_SECRET;   // ADMIN_KEY or PROJECT_KEY, from a secret store
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 15;

const SYSTEM = `You help a customer complete a request over chat, using the tools available.
1. Call get_forms and pick the form that matches what the customer wants. Never assume a form exists.
2. Call get_form_fields, then get_field_info before asking about a field, so you know its rules and allowed values.
3. Ask one question at a time. Never show field keys, JSON or tool names to the customer.
4. Record answers with collect_field_data as they arrive. Never invent a value.
5. When every required field is collected, call confirm_form_submission, show the summary and ask to confirm.
6. Only after the customer confirms, call submit_completed_form.`;

// One token for this one-shot run. A long-running client renews it before `expires_in`
// runs out and reconnects with the new one, because the transport's headers are fixed.
async function getToken() {
  const response = await fetch(`${UAG_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!response.ok) throw new Error(`Token request failed (${response.status}). Check the client id and secret.`);
  const body = await response.json();
  return body.access_token;
}

async function turn(anthropic, mcp, tools, messages, userText) {
  messages.push({ role: 'user', content: userText });
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({ model: MODEL, max_tokens: 16000, system: SYSTEM, tools, messages });
    messages.push({ role: 'assistant', content: response.content });   // tool_use blocks must stay in the history
    if (response.stop_reason !== 'tool_use') {
      return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    }
    const calls = response.content.filter((b) => b.type === 'tool_use');
    const results = await Promise.all(calls.map(async (call) => {
      try {
        const result = await mcp.callTool({ name: call.name, arguments: call.input });
        return {
          type: 'tool_result', tool_use_id: call.id, is_error: !!result.isError,
          content: (result.content || []).map((c) => ({ type: 'text', text: c.type === 'text' ? c.text : JSON.stringify(c) })),
        };
      } catch (error) {
        return { type: 'tool_result', tool_use_id: call.id, content: `Tool call failed: ${error.message}`, is_error: true };
      }
    }));
    messages.push({ role: 'user', content: results });
  }
  return 'I could not finish that. Could you rephrase?';
}

const anthropic = new Anthropic();   // reads ANTHROPIC_API_KEY
const mcp = new Client({ name: 'uag-chat', version: '1.0.0' });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${UAG_URL}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${await getToken()}` } },
}));
try {
  const { tools } = await mcp.listTools();   // JSON Schema already: passes straight to the Messages API
  const claudeTools = tools.map((t) => ({ name: t.name, description: t.description || '', input_schema: t.inputSchema }));
  console.log(await turn(anthropic, mcp, claudeTools, [], process.argv[2] || 'What can you help me with?'));
} finally {
  await mcp.close();
}
```

Before exposing anything like it: authenticate each user and give them their own UAG token (the PKCE flow) so their roles apply — this sample uses an administrator credential; keep the confirm step, and gate write tools in code using the annotations (`readOnlyHint`, `destructiveHint`); rate-limit sessions, since every turn is a full tool loop and the UAG does not rate-limit MCP calls; and handle `max_tokens` and `refusal` stop reasons as well as `tool_use` and `end_turn`. The UAG holds no conversation state, so keep `messages` per user session.

## Shaping the agent with a module

A UAG module can change what the built-in tools tell the model (`config.toolOverrides`, `config.responseTemplates`), add custom tools (`config.tools`), and install the forms and roles a use case needs (`config.template`). For example, to make an agent check permissions before collecting fields:

```js
module.exports = {
  config: {
    toolOverrides: {
      get_forms: {
        description: 'Get a list of forms that the user has access to submit. You must call this tool before calling the `get_form_fields` tool to verify if the user has access to submit the form.',
      },
    },
  },
};
```

See [deployment.md](./deployment.md#modules) for mounting a module.
