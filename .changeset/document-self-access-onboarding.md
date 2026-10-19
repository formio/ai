---
'@formio/ai': patch
---

Document Self Access for applications that onboard users or create accounts on a user's behalf.

- `formio-auth`: Self Access is the `{ "type": "self" }` entry in the user resource's `submissionAccess`; with it, a user signed in as a record can read and update that record whatever its `owner` holds, provided the record's role grants `read_own` / `update_own`. The email-token onboarding workflow adds Self Access and a Role Assignment.
- `formio-resource-planner`: the canonical `user` resource and the example templates carry Self Access; a plan that creates users directly on the user resource also gives it a `user:role` Role Assignment.
- `formio-schema`: the `self` access type is described.
