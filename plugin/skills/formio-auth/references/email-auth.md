# Email-token authentication (SSO Email Token)

## Overview

Email-token authentication (Form.io's "SSO Email Token" workflow) issues a one-time login link via email instead of asking for a password. A form submission triggers a standard **Email action**, and the email body contains a `[[token(...)]]` macro. At send time Form.io resolves that macro by **searching a Resource for the record that matches the recipient's email**, and — if a record is found — mints a JWT for that user and substitutes it into the link. The recipient clicks the link, lands on a page in _your_ application (the **callback URL**), and that page exchanges the token for a Form.io session. The result is a regular Form.io session indistinguishable from Resource-backed login or SSO.

## When to use this

Reach for email-token auth when:

- The product wants a passwordless sign-in or "magic link" flow.
- The product needs to 'verify' a users email address before continuing a user onboarding process.
- A workflow needs to email a specific, already-known person an authenticated deep link into the app (e.g. "a manager gets a link to review this submission").
- Users need to reset a forgotten password — see "Password reset" below.
- The user population is comfortable with magic-link UX (consumer apps, light-touch B2B portals, review/approval flows).

Not for:

- Backend service authentication → use [`custom-jwt.md`](./custom-jwt.md) or [`token-swap.md`](./token-swap.md).
- High-friction enterprise environments with mandatory IdP federation → see [`sso-oidc.md`](./sso-oidc.md), [`sso-saml.md`](./sso-saml.md), [`sso-ldap.md`](./sso-ldap.md).
- Onboarding brand-new users. **Email-token auth does not create users** — see "The recipient must already exist" below.

## How it works

1. A form is submitted (in the tutorial, an Expense Report; for a passwordless login, a small "enter your email" form).
2. An **Email action** on that form fires and sends an email to a recipient address.
3. The email **Message** contains a `[[token(...)]]` macro. When the email is rendered, Form.io searches the referenced Resource for a record whose email matches, and — if found — replaces the macro with a freshly minted JWT for that user.
4. The link in the email points to a **callback URL inside the application** (a page the coding agent builds), carrying the token in the query string.
5. The recipient clicks the link. The callback page reads the token and calls `Formio.setToken()` to establish the session, then routes the user wherever the app needs them (e.g. the submission to review).

## Configuration

### Prerequisite: Email Transport

The Email action sends through an **Email Transport** that must be configured first. Select the transport on the action. Transport secrets (SMTP host, port, credentials, sender address) are set in the Form.io project portal — they are not exposed as MCP tools.

### The Email action

This uses the **standard Email action** (not a special "authentication" action). Its relevant fields:

- **Email Transport** — the configured transport to send through.
- **To** — the recipient's email address (a fixed address, or a value pulled from the triggering submission's data).
- **Message** — the email body, which contains the magic link with the `[[token(...)]]` macro.

Use `action_type_get` on the `email` action type to inspect its current `settings` schema before authoring, since transport and template fields evolve faster than other actions. For general action shape conventions in `template.json`, see `../../formio-resource-planner/references/template-json.md`.

### The token macro

The link in the email Message embeds a token macro.

```
https://yourapplication.com/?token=[[token(data.email=manager)]]#/project-domain/expensereport/submission/{{ id }}/edit
```

In this example, `https://yourapplication.com` would be replaced with the URL of the deployed application that the user is developing that contains the 'Magic Link' email login.

Reading the `[[token(data.email=manager)]]` macro.

> the token will then search within the **Manager** resource and try to find a record that matches the **Email** data within the given Resource. If a match is found, a special JWT token will be generated.

So in `[[token(data.email=manager)]]`:

- `data.email` — the path of the field **on the searched resource's records** that holds the address. Form.io looks for a record in that resource whose `data.email` equals the address this email is being sent to (the action's **To**, matched case-insensitively); it does not read this value from the triggering submission.
- `manager` — the machine name of the **Resource that gets searched**; list several separated by commas.

The full grammar is `[[token(<fieldPath>=<resource>[,<resource>…])[,<minutes>]]]`. An optional number after the closing parenthesis sets the token lifetime in minutes — see "Token lifetime" below. With no `=resource` part, the token is issued for the triggering submission itself. The macro is replaced only in the message body, and only when the email has exactly one recipient — with several recipients, send a separate email to each. When no record matches, the link carries the text `INVALID_TOKEN`.

For a 'default' passwordless **login** flow, the equivalent macro searches the `user` Resource — `[[token(data.email=user)]]` — and the action's **To** is set to the address the visitor typed (for example `{{ data.email }}`). That recipient address is what gets matched against `data.email` on the user records.

`{{ id }}` is the triggering submission's ID, used in the tutorial to deep-link the recipient into that submission in edit mode. It is an ordinary email-template variable, independent of the token.

### Token lifetime

Every link the macro mints expires. Write the lifetime, in minutes, as a number after the closing parenthesis:

```
[[token(data.email=user)]]       → 120 minutes, the server default
[[token(data.email=user),30]]    → 30 minutes
[[token(data.email=user),1440]]  → 24 hours
```

The clock starts when the email is sent, not when it is opened, so leave enough time for the email to arrive and be read. A link used after it expires does not sign anyone in; the application should offer to send a new one. Write a whole number of minutes: `0` gives the 120-minute default, and anything else after the comma — a decimal, a unit, a word — stops the server recognising the macro at all, so the email carries the literal macro text instead of a token. A deployment that sets the `SESSION_EXPIRE_TIME` environment variable also ends every session that many minutes after it starts, and the session a link carries starts when the email is sent.

Choose the lifetime for what the link does: a short one (15–60 minutes) for a password reset or sign-in link someone asked for a moment ago, a longer one for an invitation or approval request that may sit in an inbox. When the user building the application has not said, keep the default and tell them the number can be added.

### The application link is a callback URL

In an application built by the coding agent, the **callback URL** is a page that exists _inside the application the agent is building_. Only the host/path changes; the `?token=[[token(...)]]` macro stays exactly as above. For example:

```
https://your-app.example.com/auth/callback?token=[[token(data.email=user)]]
```

(Append whatever app-specific route or query the page needs to send the user onward after login, e.g. the submission ID to open.)

The callback page is developer-authored. Its job is to read the token off the URL and hand it to the Form.io SDK, which stores it as the active session:

```js
const query = Formio.pageQuery();
if (query.token) {
  await Formio.setToken(null);
  const user = await Formio.setToken(query.token).catch(() => null);
}
```

`Formio.pageQuery()` parses the token out of the URL (including parameters after the `#`), and `Formio.setToken()` persists the JWT and returns the authenticated user. Clear the stored session with `Formio.setToken(null)` first: with a user already stored in the browser, `setToken` resolves that stored user without asking the server about the new token, so an expired link would look valid. A `null` user afterwards means the link is expired or its recipient was not found. After this runs, the application has a live Form.io session for that user and can route them to the intended page.

### The recipient must already exist for token macro to work

The token macro does not automatically create users that it does not find. The macro only mints a JWT if the search finds a matching record in the referenced Resource. If no record matches the recipient's email, no token is generated and the link cannot authenticate anyone. The recipient (manager, user, etc.) must already exist as a submission in the searched Resource before the email goes out. Below is a common application workflow that is capable of User Creation => Email Verification => Onboarding user flow.

### Typical user onboarding workflow

For many applications, you may wish to accomplish a typical workflow where anyone can create an account, that account is verified with their email, and then they click on a "Magic Link" to complete their user onboarding process. This process uses the email authentication process by using the following process:

- User lands on an application 'register' page, where they see an embedded form with ONLY an email address.
- This is a Form.io form that only contains an Email field.
- This form 'Create Own' permission is set to allow 'Anonymous' submissions.
- This form contains three actions: Save Submission (pointing to User resource), Role Assignment (`association: "new"`, giving the new user their role), and Email
- The User resource has **Self Access** turned on (`{ "type": "self" }` in its `submissionAccess`) and grants the user's role `read_own` / `update_own`, so the user can later set their own password and profile. If the register page instead posts the email address straight to the User resource with `saveSubmission`, the User resource itself must grant Anonymous `create_own` (confirm that grant with the user — it lets anyone create an account), and the Role Assignment and Email actions go on the User resource instead. Neither path sets `owner` — see [`roles-and-permissions.md`](./roles-and-permissions.md) → "Self Access and user onboarding".
- The email action contains the token macro described above, with a callback url navigating to an 'onboarding' page within the application.
- The user clicks on the link, and it navigates them to the onboarding page with the `token=...` set within the url.
- The onboarding page has a controller that reads the token (using `Formio.pageQuery()`) and then authenticates the user (which was created with the 'Save Submission' action on the register form). They are authenticated with `Formio.setToken(token)`, after clearing any stored session with `Formio.setToken(null)` — see "The application link is a callback URL" above.

This onboarding page could then contain whatever content is needed to complete the user registration. This could be to set the 'password' of the user, or complete filling out their profile. This user is now 'verified' since they needed to click on a link within their email in order to complete the registration.

### Password reset

Password reset uses the same pieces: an email-token link signs the user in as their own user record, and Self Access lets them save a new password to that record. Build it from three parts.

**1. The user resource allows users to update themselves.** Turn on Self Access (`{ "type": "self" }` in the user resource's `submissionAccess`) and grant the user's role `read_own` and `update_own`; every user record needs that role from a Role Assignment. This works however the account was created and whatever its `owner` holds — see [`roles-and-permissions.md`](./roles-and-permissions.md) → "Self Access and user onboarding". The planner's canonical `user` resource already carries both.

**2. A "forgot password" form sends the link.** A form (not a resource) with one `email` field and a submit button, whose `submissionAccess` grants Anonymous `create_own` so a signed-out visitor can submit it — confirm that grant with the user, since it lets anyone submit the form. It carries one Email action and no Save Submission action, because the request itself is not worth storing. In a project template:

```jsonc
"forgotPassword:email": {
  "title": "Email",
  "name": "email",
  "form": "forgotPassword",
  "priority": 0,
  "method": ["create"],
  "handler": ["after"],
  "settings": {
    "transport": "default",
    "from": "no-reply@example.com",
    "emails": ["{{ data.email }}"],
    "subject": "Reset your password",
    "message": "<p>If you have an account, use this link to choose a new password:</p><p><a href=\"https://your-app.example.com/reset-password?token=[[token(data.email=user)]]\">Reset password</a></p>"
  }
}
```

- **To** is the address the visitor typed, so the macro mints a token for the `user` record whose `data.email` matches it. Exactly one recipient — the macro is only replaced in a single-recipient email.
- Ask the user which **from** address to use (`formio-actions`' `references/action-types.md` → "From address"); `no-reply@example.com` is the placeholder.
- Add a lifetime if the default 120 minutes is not wanted — `[[token(data.email=user),30]]`; see "Token lifetime" above.
- Replace `https://your-app.example.com/reset-password` with the reset page in the application being built.

The email goes out whether or not an account exists. For an unknown address its link carries `INVALID_TOKEN` and signs no one in. Keep the wording neutral ("If you have an account…") and show the same confirmation in the application either way, so the form does not reveal which addresses have accounts.

**3. The reset page signs the user in and saves the new password.** It reads the token from the URL, signs in with it, asks for the new password (twice, compared in the page), saves it to the signed-in user's own record, and signs out:

```js
import { Formio } from '@formio/js';

// When the page loads: sign in as the user the link was minted for. Clear any
// stored session first — with a user already stored, setToken resolves that
// user without checking the new token.
const { token } = Formio.pageQuery();
await Formio.setToken(null);
const user = token ? await Formio.setToken(token).catch(() => null) : null;
if (!user) {
  // Expired, already used, or INVALID_TOKEN: offer to send a new link, and do
  // not show the password form — setPassword below needs a signed-in user.
}

// When the user submits the new password:
async function setPassword(password) {
  const record = new Formio(`${Formio.getProjectUrl()}/form/${user.form}/submission/${user._id}`);
  const current = await record.loadSubmission();
  await record.saveSubmission({ data: { ...current.data, password } });
  await Formio.logout();
  // Route to the login page.
}
```

- `Formio.setToken()` resolves the signed-in user; `user.form` is the user resource's id, so the code works whatever the resource is named. It asks the server only when no user is stored, so the page clears the stored session first — otherwise a browser already signed in (as anyone) gets that stored user back, and an expired or `INVALID_TOKEN` link passes the check.
- The save sends only `data`, so the record's `owner`, `roles`, and `access` stay as the server holds them. Do not send the loaded record back whole.
- The loaded record does not include the stored password (the field is protected), so the save sends only the new one. The server hashes it.
- Saving a new password ends the user's other sessions — anyone signed in elsewhere with the old password is signed out.
- `Formio.logout()` ends the session the link carried, so the same link cannot be used again. Without it the link keeps working until its lifetime runs out.

The same page completes onboarding: in "Typical user onboarding workflow" above, the first email's link lands here and the user sets their first password.

### Roles and permissions

The recipient authenticates **as their existing Resource record**, carrying whatever role that record already holds. In the tutorial, a **Manager** role is assigned to Manager-Resource records (via a Role Assignment action), and the target form grants that role the access it needs:

- **Create Own** → Authenticated (employees submit).
- **Read All** / **Update All** → Manager (managers review and edit submissions).
- Remove Anonymous access to the form so it requires login.

For the canonical Role Assignment Action JSON shape used to assign a role to a Resource's records, see `../../formio-resource-planner/references/template-json.md`. Design the underlying Resource and role with `formio-resource-planner` if they are not yet in place.

### Security considerations

- The token in the email is a credential. Anyone who reads the email can use the link until the token is no longer valid — treat the inbox as part of the trust boundary.
- The token can ONLY be generated for a user whose email matches the recipient of the email.
- The token will not work if the email is sent to multiple emails.
- Use HTTPS for the callback URL. A token traveling over plaintext is as exposed as a password.
- Restrict what the searched Resource and assigned role can do, so a leaked link grants only the recipient's intended access.
- Consider rate-limiting the form that triggers the email to slow inbox-flood abuse.
- Keep a password-reset link short-lived, and end its session with `Formio.logout()` once the password is saved.

## MCP Tool Preference

- `form_create` / `form_update` — create the triggering form (and, if you model the callback as a Form.io-hosted form, that page too), including their `access` and `submissionAccess` arrays.
- `action_create` — attach the Email action to the triggering form. Run `action_type_get` on the `email` action type first to inspect its current `settings` schema.
- `action_list` / `action_update` — adjust transport, To, or Message after the fact.
- `role_create` / `role_list` — for the role assigned to the searched Resource's records.

For Email Transport secrets (host, port, credentials), use the Form.io project portal — those values are not exposed as MCP tools today.

## See also

- `formio-resource-planner` — owns the canonical Role Assignment Action shape and the underlying Resource model. See `../../formio-resource-planner/references/template-json.md`.
- [`resource-auth.md`](./resource-auth.md) — the underlying Form.io auth flow that email-token auth slots into.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the JWT the token resolves to and how sessions / logout work after `setToken`.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — what the recipient's role can do once authenticated.
