---
'@formio/ai': patch
---

Stop the skill library from emitting `persistent: false` on credential fields, which produced user records with no email or password and no way to log in.

**The `task-manager` planner example was the source.** Its `userLogin` form shipped both `email` and `password` with `persistent: false`, while the `complex-crm-transitive` example and the canonical component snippets in `references/template-json.md` used `persistent: true` for the same two fields. An agent reading the library got contradictory guidance depending on which example it landed on, and carrying the `false` block onto a form that writes into the `user` Resource — a registration form, or a combined login/register form — meant the server stripped both fields before the save. The user row was created without credentials, so login was permanently impossible. Both fields are now `persistent: true` in that example and in the matching eval fixture, aligning with Form.io's default `userLogin` form.

**`formio-auth` no longer teaches `persistent: false` as a way to avoid storing credentials.** `references/login-forms.md` and `references/resource-auth.md` both specified `persistent: false` on the login form's `password`. A login form stores nothing because it carries no Save Submission Action — only a Login Action — not because of `persistent`; `persistent: false` is a submission-stripping flag whose only effect is to destroy data on forms that do save. Both references now specify `persistent: true` plus `protected: true`, and `login-forms.md` carries the explicit prohibition and explains the failure mode.

**The rule is now stated where the planner and schema references will hit it.** `formio-resource-planner`'s `references/planning-rules.md` gains a "Credential fields are always `persistent: true`" rule covering the identifier (`email`, `username`, `userId`) and the secret on the user Resource and on every login and registration form, and `formio-schema`'s `references/form/base-component.md` documents the prohibition on the `persistent` row itself.
