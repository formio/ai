## Why

An application that onboards users — a person creates an account with only an email address and sets a password later from an emailed link, or an administrator creates an account on someone else's behalf — needs each user to be able to update their own user record. Form.io supports that through **Self Access**: the `{ "type": "self" }` entry in the user resource's `submissionAccess` (the portal's "Self Access" checkbox).

What Self Access needs was settled from the server source and confirmed live. In nirvana `apps/formio-server/node_modules/formio/src/middleware`, `permissionHandler.getSelfAccessPermissions` reads the entry and flags the request, `hasAccess` then grants a user their role's `*_own` permission on the record whose `_id` is theirs (`req.selfAccess && user === access.submission._id && hasOwnAccess`), and `ownerFilter` adds that record to their index — none of which reads `owner`. On a 9.9.2 deployment, user records an administrator created with `owner` omitted, `null`, and `''` (stored as the administrator's id, an unrelated id, and the record's own id) could each be read and updated by their own user with Self Access on; with it off, only the record that owned itself could. So Self Access needs the entry and a role holding `read_own` / `update_own`, and no `owner` value. Template import keeps the entry (`templates/import.js` maps each entry's `roles`).

The skills said none of this:

- `formio-auth/references/roles-and-permissions.md` described Self Access as "write the submission's own `_id` into its `owner` property", which an agent cannot do and which names neither the entry nor the role it needs.
- The planner's canonical `user` resource granted `update_own` but carried no Self Access entry, and neither did its example templates.
- `email-auth.md`'s onboarding workflow named no Role Assignment, so the created user held no role and no `*_own` permission.
- A user record created directly on the user resource gets a role only from a Role Assignment on that resource; the planner emitted one only on the register form.

Every change adds guidance; no API, pattern, or capability is removed.

## What Changes

- **`formio-auth`**: `roles-and-permissions.md` replaces the Self Access bullet with a section stating the entry, the role it needs, where that role comes from, and that the record's `owner` does not matter. `email-auth.md`'s onboarding workflow adds Self Access and a Role Assignment.
- **`formio-resource-planner`**: the canonical `user` resource and both example templates carry `{ "type": "self", "roles": [] }`; a plan that creates users directly on the user resource also emits an unconditional `user:role` Role Assignment there. Self-check line added.
- **`formio-schema`**: the `self` access type is described; the submission `owner` row points to Self Access.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `formio-auth-skill`, `formio-resource-planner-skill`, `formio-schema-skill`: each gains a requirement that its documents carry the Self Access guidance above.

## Impact

- Skill prose under `plugin/skills/` for the three skills above.
- One new test file, `packages/skill-tests/src/source-facts/self-access.test.ts`, including a library-wide guard that no document asks for an `owner` value or generates code to send one.
- No MCP server code changes.
