# Email-token authentication (SSO Email Token)

## Overview

Email-token authentication (Form.io's "SSO Email Token" workflow) issues a one-time login link via email instead of asking for a password. A form submission triggers a standard **Email action**, and the email body contains a `[[token(...)]]` macro. At send time Form.io resolves that macro by **searching a Resource for the record that matches the recipient's email**, and — if a record is found — mints a JWT for that user and substitutes it into the link. The recipient clicks the link, lands on a page in *your* application (the **callback URL**), and that page exchanges the token for a Form.io session. The result is a regular Form.io session indistinguishable from Resource-backed login or SSO.

## When to use this

Reach for email-token auth when:

- The product wants a passwordless sign-in or "magic link" flow.
- The product needs to 'verify' a users email address before continuing a user onboarding process.
- A workflow needs to email a specific, already-known person an authenticated deep link into the app (e.g. "a manager gets a link to review this submission").
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

Use `action_type_get` on the `email` action type to inspect its current `settings` schema before authoring, since transport and template fields evolve faster than other actions. For general action shape conventions in `template.json`, see `plugin/skills/formio-resource-planner/references/template-json.md`.

### The token macro

The link in the email Message embeds a token macro.

```
https://yourapplication.com/?token=[[token(data.email=manager)]]#/project-domain/expensereport/submission/{{ id }}/edit
```

In this example, `https://yourapplication.com` would be replaced with the URL of the deployed application that the user is developing that contains the 'Magic Link' email login.

Reading the `[[token(data.email=manager)]]` macro.

> the token will then search within the **Manager** resource and try to find a record that matches the **Email** data within the given Resource. If a match is found, a special JWT token will be generated.

So in `[[token(data.email=manager)]]`:

- `data.email` — the email value to look up (here, the `email` field from the triggering submission's data).
- `manager` — the **Resource that gets searched**. Form.io looks in this Resource for a record whose email matches `data.email`.

For a 'default' passwordless **login** flow, the equivalent macro searches the `user` Resource — e.g. `[[token(data.email=user)]]` — where `data.email` is the address the visitor typed into the login form.

`{{ id }}` is the triggering submission's ID, used in the tutorial to deep-link the recipient into that submission in edit mode. It is an ordinary email-template variable, independent of the token.

### The application link is a callback URL

In an application built by the coding agent, the **callback URL** is a page that exists *inside the application the agent is building*. Only the host/path changes; the `?token=[[token(...)]]` macro stays exactly as above. For example:

```
https://your-app.example.com/auth/callback?token=[[token(data.email=user)]]
```

(Append whatever app-specific route or query the page needs to send the user onward after login, e.g. the submission ID to open.)

The callback page is developer-authored. Its job is to read the token off the URL and hand it to the Form.io SDK, which stores it as the active session:

```js
const query = Formio.pageQuery();
if (query.token) {
  const user = await Formio.setToken(query.token);
}
```

`Formio.pageQuery()` parses the token out of the URL (including parameters after the `#`), and `Formio.setToken()` persists the JWT and returns the authenticated user. After this runs, the application has a live Form.io session for that user and can route them to the intended page.

### The recipient must already exist for token macro to work

The token macro does not automatically create users that it does not find. The macro only mints a JWT if the search finds a matching record in the referenced Resource. If no record matches the recipient's email, no token is generated and the link cannot authenticate anyone. The recipient (manager, user, etc.) must already exist as a submission in the searched Resource before the email goes out. Below is a common application workflow that is capable of User Creation => Email Verification => Onboarding user flow.

### Typical user onboarding workflow

For many applications, you may wish to accomplish a typical workflow where anyone can create an account, that account is verified with their email, and then they click on a "Magic Link" to complete their user onboarding process.  This process uses the email authentication process by using the following process:

 - User lands on an application 'register' page, where they see an embedded form with ONLY an email address.
 - This is a Form.io form that only contains an Email field.
 - This form 'Create All' permission is set to allow 'Anonymous' submissions.
 - This form contains two actions:  Save Submission (pointing to User resource) and Email
 - The email action contains the token macro described above, with a callback url navigating to an 'onboarding' page within the application.
 - The user clicks on the lick, and it navigates them to the onboarding page with the `token=...` set within the url.
 - The onboarding page has a controller that reads the token (using `Formio.pageQuery()`) and then authenticates the user (which was created with the 'Save Submission' action on the register form). They are authenticated with `Formio.setToken(token)`. 

This onboarding page could then contain whatever content is needed to complete the user registration. This could be to set the 'password' of the user, or complete filling out their profile. This user is now 'verified' since they needed to click on a link within their email in order to complete the registration.

### Roles and permissions

The recipient authenticates **as their existing Resource record**, carrying whatever role that record already holds. In the tutorial, a **Manager** role is assigned to Manager-Resource records (via a Role Assignment action), and the target form grants that role the access it needs:

- **Create Own** → Authenticated (employees submit).
- **Read All** / **Update All** → Manager (managers review and edit submissions).
- Remove Anonymous access to the form so it requires login.

For the canonical Role Assignment Action JSON shape used to assign a role to a Resource's records, see `plugin/skills/formio-resource-planner/references/template-json.md`. Design the underlying Resource and role with `formio-resource-planner` if they are not yet in place.

### Security considerations

- The token in the email is a credential. Anyone who reads the email can use the link until the token is no longer valid — treat the inbox as part of the trust boundary.
- The token can ONLY be generated for a user whose email matches the recipient of the email.
- The token will not work if the email is sent to multiple emails.
- Use HTTPS for the callback URL. A token traveling over plaintext is as exposed as a password.
- Restrict what the searched Resource and assigned role can do, so a leaked link grants only the recipient's intended access.
- Consider rate-limiting the form that triggers the email to slow inbox-flood abuse.

## MCP Tool Preference

- `form_create` / `form_update` — create the triggering form (and, if you model the callback as a Form.io-hosted form, that page too), including their `access` and `submissionAccess` arrays.
- `action_create` — attach the Email action to the triggering form. Run `action_type_get` on the `email` action type first to inspect its current `settings` schema.
- `action_list` / `action_update` — adjust transport, To, or Message after the fact.
- `role_create` / `role_list` — for the role assigned to the searched Resource's records.

For Email Transport secrets (host, port, credentials), use the Form.io project portal — those values are not exposed as MCP tools today.

## See also

- `formio-resource-planner` — owns the canonical Role Assignment Action shape and the underlying Resource model. See `plugin/skills/formio-resource-planner/references/template-json.md`.
- [`resource-auth.md`](./resource-auth.md) — the underlying Form.io auth flow that email-token auth slots into.
- [`jwt-and-sessions.md`](./jwt-and-sessions.md) — the JWT the token resolves to and how sessions / logout work after `setToken`.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — what the recipient's role can do once authenticated.
