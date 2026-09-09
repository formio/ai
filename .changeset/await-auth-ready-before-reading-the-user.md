---
'@formio/ai': patch
---

`formio-angular` AUTH now requires awaiting `auth.ready` before reading `auth.user` or `auth.authenticated`. Both are resolved outside Angular's zone, so on a cold session — straight after registering, a hard reload, or a deep link — either can still be empty when generated code reads it, and the code then takes a silent wrong branch: a signed-in user is treated as anonymous, or a record is written without the user it needed. Observed in a generated group-creation flow that saved the group, skipped the creator's membership row because the user id had not resolved yet, and left every later create scoped to that group returning `Unauthorized`. The rule is general rather than group-specific, so it sits beside the existing `ready` bullet in the event-surface section and states that a still-missing user is a real failure rather than a default to fall through to.
