## 1. Shared path-argument rule

<!-- depends_on: none -->

### Red

- [x] 1.1 Write failing tests in `src/__tests__/path-arguments.test.ts` for `checkProjectPath`: accepts `user/login`, `form/65a1b2c3d4e5f60718293a4b`, `a/b/c`; refuses `""`, `https://example.com/x`, `mailto:x`, `/user/login`, `//example.com/x`, `user\\login`, `user//login`, `./user`, `user/..`, `user/../../other`
- [x] 1.2 Write failing tests for `checkResourceSegment`: accepts `3`, `email`, `65a1b2c3d4e5f60718293a4b`; refuses everything `checkProjectPath` refuses plus any value containing `/`
- [x] 1.3 Write failing tests for the zod schemas `projectPathArgument(name)` and `resourceSegmentArgument(name)`: a refused value produces an issue whose message names the argument and the accepted shape

### Green

- [x] 1.4 Implement `src/tools/path-arguments.ts` with the two predicates and the two schema factories to pass 1.1–1.3

### Refactor

- [x] 1.5 Review implementation and refactor as needed

## 2. Tools apply the rule to every path argument

<!-- depends_on: 1 -->

### Red

- [x] 2.1 Write failing tests (in each tool's existing test file) that `form_get`, `form_revisions_list` and `form_revision_get` return `isError: true` naming `formIdOrPath` for `https://example.com/x`, `//example.com/x` and `user/../../other`, with `formioFetch` never called; and still request `{projectUrl}/user/login` for `user/login`
- [x] 2.2 Write failing tests that every `action_*` tool refuses a `formId` containing `/` or a scheme, that `action_get` / `action_update` / `action_delete` refuse `actionId: "abc/def"`, that `action_type_get` refuses `actionName: "../x"`, and that `form_revision_get` refuses `version: "3/../../x"` — each naming the argument, with no request made
- [x] 2.3 Write a failing test that enumerates the registered tools and asserts every argument listed in the `tool-path-arguments` spec uses `projectPathArgument` or `resourceSegmentArgument` (or the existing ObjectId check for `form_update.formId` / `role_update.roleId`)

### Green

- [x] 2.4 Replace the `z.string()` schemas for `formIdOrPath`, `formId` (action tools), `actionId`, `actionName` and `version` with the shared schemas, keeping each argument's name and description text, to pass 2.1–2.3

### Refactor

- [x] 2.5 Review implementation and refactor as needed

## 3. formioFetch keeps every request under the Project URL

<!-- depends_on: none -->

### Red

- [x] 3.1 Write failing tests in `formio-client.test.ts`: path `user/login` under `https://examples.form.io` is sent; path `form/<id>` under `https://forms.mysite.com/myproject` is sent to `https://forms.mysite.com/myproject/form/<id>`
- [x] 3.2 Write failing tests that `formioFetch` throws naming the path and Project URL, and calls `fetch` zero times, for `https://example.com/x`, `../otherproject/form` under a sub-directory project, and a built URL `https://forms.mysite.com/myproject2/form` under `https://forms.mysite.com/myproject`
- [x] 3.3 Write a failing test that the refusal happens before any auth header is built (the auth gate and `getAuthHeader` are not reached)

### Green

- [x] 3.4 Add the origin and segment-prefix check to `formioFetch` after the URL is built and before `ensureAuthenticated` / `formioRawFetch`, to pass 3.1–3.3

### Refactor

- [x] 3.5 Review implementation and refactor as needed

## 4. Registrable-domain pair verdict

<!-- depends_on: none -->

### Red

- [x] 4.1 Write failing tests in a new `src/__tests__/related-deployment.test.ts` for `classifyPair`: `myproject.mysite.com` + `api.mysite.com` → `ok`; `myproject.forms.mysite.com` + `forms.mysite.com` → `ok`; `myproject.mysite.co.uk` + `api.mysite.co.uk` → `ok`; `myproject.mysite.co.uk` + `api.othersite.co.uk` → `unrelated-deployment`; `myproject.mysite.com` + `forms.othersite.com` → `unrelated-deployment`; `a.herokuapp.com` + `b.herokuapp.com` → `unrelated-deployment`; `http://myproject.localhost:3000` + `http://localhost:3000` → `ok`; forced pair of unrelated hosts → `ok`; hosted and sub-directory projects keep their existing verdicts
- [x] 4.2 Write a failing test that `faultedHalf('unrelated-deployment')` is `'deployment'`
- [x] 4.3 Write failing writer tests: `project_set` and `project set` refuse `https://myproject.mysite.com` + `https://forms.othersite.com` naming both hosts and the rule, recording nothing; `project set --force` records it
- [x] 4.4 Write failing resolver tests (extend `pair-validity-at-read.test.ts`): a committed file, a mapping entry, and the environment each holding the unrelated pair produce a note naming the record and the rule, and `project_get` reports `base-url-unresolved`; a forced mapping entry resolves both values with no note
- [x] 4.5 Write failing regression tests that every shape in `formio-mcp-setup/references/project-urls.md` — `https://examples.form.io`, `https://forms.mysite.com/myproject`, `https://myproject.mysite.com` + `https://api.mysite.com` — resolves with no note and no new prompt

### Green

- [x] 4.6 Add `tldts` to `packages/mcp-server` dependencies and implement `sharesRegistrableDomain(projectHost, baseHost)` (private domains on; single-label / IP fallback) in `pair-rule.ts`
- [x] 4.7 Add the `unrelated-deployment` verdict to `PairValidity`, `faultedHalf` and `classifyPair` (asked only for a path-less project outside `form.io`, after the existing deployment-half verdicts)
- [x] 4.8 Add the shared refusal message constant and wire it into the resolver's deployment-half note, `cli/project-command.ts`, and `project_set`'s refusal, to pass 4.3–4.5

### Refactor

- [x] 4.9 Review implementation and refactor as needed

## 5. API key binds to FORMIO_PROJECT_URL's origin

<!-- depends_on: none -->

### Red

- [x] 5.1 Write failing resolver tests: with `FORMIO_API_KEY` set and `FORMIO_PROJECT_URL` `https://examples.form.io`, a resolved `https://examples.form.io` carries `apiKey`; a committed file resolving `https://other.form.io` carries none; `FORMIO_PROJECT_URL` unset with a mapping carries none; a sub-directory project on the key's origin carries it
- [x] 5.2 Write failing `ensure-auth.test.ts` / `formio-client.test.ts` tests: when the resolved config carries no key, no request sends `x-token` and the portal-login path runs; when it carries the key, `x-token` is sent and no browser opens (covered by existing `formio-client.test.ts` / `ensure-auth.test.ts` cases for a config without a key; the new behaviour — the resolver withholding the key — is asserted in `api-key-binding.test.ts`)
- [x] 5.3 Write failing `project_get` tests (delivered as a resolution note, which `project_get` returns in `notes`): the report states the key is set but not applied, naming the origin it applies to, or that `FORMIO_PROJECT_URL` is unset

### Green

- [x] 5.4 Set `apiKey` on the resolved configuration in `project-resolver.ts` only when the origin rule holds, to pass 5.1–5.2
- [x] 5.5 Add the unapplied-key statement to `project-report.ts` / `project_get` output (and its output schema, if a field is added), to pass 5.3

### Refactor

- [x] 5.6 Review implementation and refactor as needed

## 6. Documentation and release notes

<!-- depends_on: 4, 5 -->

### Red

- [x] 6.1 Write a failing test (extend an existing README/doc test or add one) that `packages/mcp-server/README.md`, `README.md` and `plugin/README.md` each state that `FORMIO_API_KEY` applies only to the project on `FORMIO_PROJECT_URL`'s origin

### Green

- [x] 6.2 Update the three READMEs and `server.json`'s `FORMIO_API_KEY` description; add a changeset for `@formio/mcp` describing the API-key binding and the registrable-domain pair rule as behaviour changes, in neutral terms
- [x] 6.3 Confirm no skill under `plugin/skills/` builds a request path or sets `FORMIO_API_KEY` (grep), so no skill prose changes; run `pnpm test`, `pnpm lint`, `pnpm format`

### Refactor

- [x] 6.4 Review implementation and refactor as needed

## 7. Review fixes (PR #88 code review)
<!-- depends_on: 1, 2, 3, 4, 5, 6 -->

### Red

- [x] 7.1 Write failing tests: `%2e%2e`, `.%2E`, `%2e`, `?`, `#`, a space and a `.` inside a segment are refused by the path rule
- [x] 7.2 Rewrite the coverage test to enumerate every registered tool and fail when a tool declaring a path argument has no fixture; it fails on `form_update.version`
- [x] 7.3 Write failing tests: `formioFetch` and `validateToken` send `redirect: 'manual'`; a 302 is reported naming its location and is not re-sent
- [x] 7.4 Write failing test: a sibling project on the same sub-directory origin does not receive the key
- [x] 7.5 Write failing tests: browserless and timeout login errors state the withheld-key reason instead of asking for the key
- [x] 7.6 Write failing tests: sibling hosts under `localhost` and a private TLD are related; different branches of a private TLD and an IP deployment for a real domain are not

### Green

- [x] 7.7 Replace the denylist with a per-segment allowlist; apply the shared schema to `form_update.version`
- [x] 7.8 Set `redirect: 'manual'` on credentialed requests and report a 3xx with its location
- [x] 7.9 Bind the key to the normalized Project URL and carry the reason as `apiKeyNotApplied`; use it in both login remedies
- [x] 7.10 Compare hosts directly under an unlisted suffix; IP literals pair only with themselves
- [x] 7.11 Mark the changeset `minor` and update the READMEs, `server.json` and changeset to the project-URL binding

### Refactor

- [x] 7.12 Review implementation and refactor as needed
