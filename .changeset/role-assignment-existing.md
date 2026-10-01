---
'@formio/ai': patch
---

Document how to configure a Role Assignment action with `association: "existing"`. The `formio-actions` reference used to describe the target only as "a component whose value is the target resource's submission ID", which reads as though any key will do; it now states that the target component's key must be exactly `submission`. The same guidance recommends setting `settings.role` explicitly and granting create access on such a form to administrator roles only. `formio-resource-planner`'s `template-json.md` carries the same rules for any `existing` action it emits, and a new skill test keeps every description of the association naming the `submission` key.
