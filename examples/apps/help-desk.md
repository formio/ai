# Help desk

A support ticket system with two user populations (customers and agents) and an email notification. Exercises the Resource-vs-Form decision (the ticket intake is form-like but ticket is a Resource), role-differentiated access, an Email Action, and — because of the SSO line — the orchestrator's Step 5.5 handoff to `formio-auth` after import.

## Prompt

```
/formio-application Stand up a help desk for our software product. Customers submit support tickets (subject, description, severity: low / normal / high / urgent, product area, and optional file attachments). Our support agents pick up tickets, set the status (new, in progress, waiting on customer, resolved), assign a priority, and add internal notes customers can't see. Customers should only see their own tickets; agents see all of them. When a ticket is created, email our support inbox. Our agents sign in with our company's Okta (OIDC), but customers just register with email and password. Put the app in examples/help-desk-app.
```

## What to look for

- Ticket as a Resource with owner-scoped customer access and role-scoped agent access; internal notes either a separate agent-only resource or a field with restricted access — the planner should ask rather than guess.
- The Email Action on ticket creation should appear in the planner's actions with the support-inbox recipient.
- The Okta/OIDC line means the Resource Map's `Users & Auth` section emits a non-`none` SSO field — after import, the orchestrator must invoke `formio-auth` (Step 5.5) before framework routing. If it routes straight to Angular, the auth handoff regressed.
- Two registration paths (SSO agents vs email/password customers) should NOT collapse into one login form.
