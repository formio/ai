# Create a form with raw MCP tools

A skills-free form creation — the agent authors the form JSON from its own knowledge and saves it with `form_create`. Useful for verifying the MCP wiring end to end, and for clients where the skill library is not installed. (With the skills installed, the same ask routes through `formio-form-builder`, which encodes the schema conventions the raw run has to get right on its own.)

## Prompt

```
Using the formio-mcp form_create tool, create a new form called "Contact Us" with fields for full name (required), email (required), subject, and message, plus a submit button. Then list the forms in the project to confirm it exists.
```

## What to look for

- One `form_create` call carrying a complete Form.io form definition (`title`, `name`, `path`, `components`) — components should be valid Form.io component JSON (`textfield`, `email`, `textarea`, `button`).
- A follow-up `form_list` confirming the new form's path.
- Authentication implicit on the first call (browser portal login or `FORMIO_API_KEY`).
