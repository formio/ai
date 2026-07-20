# Custom JWT

## Overview

Custom JWT is Form.io Enterprise's escape hatch for on-prem deployments that want to issue Form.io tokens from their own backend. The customer mints a JWT signed with the deployment's `JWT_SECRET` environment variable; Form.io accepts it as if it had issued the token itself. Useful when Form.io is embedded behind another auth boundary (a Backend-for-Frontend, an internal portal, a session-tracked microservice) and a full OAuth/SAML/LDAP integration would be overkill.

## When to use this

Reach for Custom JWT when:

- The deployment is Form.io Enterprise (on-prem). Custom JWT requires control over the deployment's `JWT_SECRET`, which Form.io SaaS does not expose.
- The customer's backend is already the source of truth for sessions and user identity.
- Embedding Form.io inside an existing app and re-using its session, not federating against an IdP, is the goal.

Not for:

- Form.io SaaS — `JWT_SECRET` is platform-managed and cannot be used to forge tokens.
- Federated identity → see [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md).
- Swapping an existing OIDC token for a Form.io JWT → see [`token-swap.md`](./token-swap.md).
- Issuing magic-link emails → see [`email-auth.md`](./email-auth.md).

## Configuration

### Deployment prerequisites

1. On-prem Form.io Enterprise with a unique `JWT_SECRET` environment variable set in the Docker / Kubernetes deployment. Document the value in a secrets manager — it MUST match between the API server and any worker that issues tokens.
2. Roles created in the project. Each role you intend to assign has a stable MongoDB ID — note them down (or fetch them via `role_list`).
3. A `user` Resource (or whichever Form.io Resource you treat as the canonical user record) to point `form._id` at. This is a **passive association only** — it records where the user conceptually "belongs". The user forged by the Custom JWT is **ephemeral**: it is never written to this Resource and no submission row is ever created or required for it.
4. Form Access configured so the roles you mint into the JWT actually grant the access you expect — see [`roles-and-permissions.md`](./roles-and-permissions.md).

### Required JWT payload shape

The token MUST be signed with `JWT_SECRET` and carry this payload:

```js
{
  external: true,
  form:    { _id: 'USER_RESOURCE_FORM_ID' },
  project: { _id: 'PROJECT_ID' },
  user: {
    _id: 'external',
    data: { name: 'joe' },
    roles: ['ROLE_ID_1', 'ROLE_ID_2']
  }
}
```

Required claim semantics:

- `external: true` — flags the token as customer-issued so Form.io skips the normal credential lookup.
- `form._id` — the MongoDB ID of the `user` Resource form. This is a **passive association only** (which Resource the user conceptually belongs to); Form.io does not read a submission from it or write one to it.
- `project._id` — the MongoDB ID of the Form.io project.
- `user._id` — `"external"` is the sentinel for an **ephemeral user** that has no Form.io submission row and never will. The identity lives entirely in this token.
- `user.data` — arbitrary profile data the token carries (the renderer's `Formio.user` is hydrated from this).
- `user.roles` — an array of role MongoDB IDs that gate the user's access.

### Generating the token (Node example)

```js
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    external: true,
    form: { _id: '59795d259be16e3ee58fddaa' },
    project: { _id: '59795d259be16e3ee58fdda6' },
    user: {
      _id: 'external',
      data: { name: 'joe' },
      roles: ['59795d259be16e3ee58fdda7'],
    },
  },
  process.env.JWT_SECRET
);
```

The same library that signs (`jsonwebtoken` in Node, equivalents in Python, Go, Ruby, etc.) can be used in any backend the customer controls. Sign with HS256 unless the deployment is configured for a different algorithm.

### Handing the token to the client

After signing, the backend hands the JWT to the renderer by writing it into `localStorage` under the key `formioToken`:

```html
<script type="text/javascript">
  localStorage.setItem('formioToken', 'FORMIO_TOKEN');
</script>
```

Once `formioToken` is present, the Form.io renderer attaches it as the `x-jwt-token` header on every subsequent Form.io request. The user is authenticated from that point on.

For service-to-service callers (a backend script, a CI pipeline), attach the same `x-jwt-token` header on every HTTP request manually instead of writing to `localStorage`.

### Rotation and revocation

- The token's lifetime is whatever your signing library puts in `exp`. Pick a TTL that matches your backend's session policy.
- There is no built-in revocation list. To force logout, rotate `JWT_SECRET` on the deployment — every outstanding Custom JWT immediately becomes invalid (which also invalidates every other Form.io session keyed by the old secret).
- For per-user revocation, prefer issuing short-lived Custom JWTs and refreshing them from your backend on a tight cadence.

### Security considerations

- Treat `JWT_SECRET` as a top-tier secret. Leakage lets an attacker forge any user with any roles.
- NEVER ship `JWT_SECRET` to the browser. Sign tokens server-side only.
- Validate the `user.roles` array against the actual roles a session should hold; do not trust client-supplied role lists.
- Avoid putting PII you do not need in `user.data` — the payload lives in `localStorage` on the browser.

## MCP Tool Preference

`JWT_SECRET` is a deployment-level environment variable; configuring it MUST be done via the Form.io project portal / deployment configuration (Docker env, Kubernetes secret, etc.) — no MCP tool covers it. Surrounding workflow:

- Use `role_list` to fetch the MongoDB IDs you will put into `user.roles`.
- Use `form_list` / `form_get` to fetch the `_id` of the `user` Resource form to put into `form._id`.
- Use `project_export` to fetch the project `_id` to put into `project._id`.
- For runtime endpoint documentation (token introspection, token validation), see the `runtime-auth` reference in the `formio-api` skill.

## See also

- [`token-swap.md`](./token-swap.md) — the OIDC-token-driven alternative when an IdP is already in play.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the standard Form.io JWT payload (the Custom JWT is the same shape minus `external: true`).
- [`roles-and-permissions.md`](./roles-and-permissions.md) — how the role IDs in `user.roles` gate access at runtime.
