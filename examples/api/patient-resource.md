# Create a Patient resource via the REST API

A direct REST-surface exercise. Activates the `formio-api` skill to create a new Resource in the target project — the skill should prefer the MCP server's first-party tools (`form_create`) where they cover the operation, falling back to raw endpoints only where they don't.

## Prompt

```
/formio-api I would like to create a new Patient resource within my Form.io deployment.
```

## What to look for

- The skill should interview for the Patient fields (or propose a sensible clinical starter set) rather than creating an empty resource.
- Creation should go through the MCP `form_create` tool with `type: "resource"` — not a hand-rolled `curl`.
- Authentication should be implicit: the first authenticated call triggers the browser portal-login flow on a JWT cache miss.
