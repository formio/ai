---
'@formio/ai': minor
---

Add the `formio-uag` skill: agentic forms with the Form.io Universal Agent Gateway (UAG) 2.0.

- Make forms agent-ready: the `uag` tag, tasks (criteria, input, decision and value fields) and every `uag*` custom property.
- Deploy the UAG and its model engines on Form.io Open Source, self-hosted Enterprise or a hosted project, with the license each surface needs.
- Wire applications to its four surfaces: conversation forms over the UAG's MCP endpoint (Claude Desktop, claude.ai, your own client), the chat widget (`Formio.createChat`), Agentic Formflow (the Agent API and Agent Input from `@formio/uag-js`), and agentic workflows with the "Agent: Run task" action.
- `formio-actions` and `formio-form` hand UAG work to the new skill.
- Every skill description is shorter (the library's combined listing drops from about 12,900 to 9,200 characters) so it stays near Claude Code's skill-listing budget; triggers and handoffs are unchanged, and the routing eval passes 41/41.
