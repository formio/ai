# A chat that files service requests

A conversation form with no license. Exercises the `formio-uag` skill: tagging a form `uag`, writing its fields for a model, the chat widget, anonymous use with rate limits, and a Compose stack for Form.io Open Source.

See it running at https://ai.form.io/examples/conversation (source: https://github.com/formio/uag/tree/main/demo).

## Prompt

```
/formio-uag Put a chat on our public support page where customers describe their problem and it fills in our "serviceRequest" form for them, then submits it once they confirm. Visitors are not signed in. We run Form.io Open Source in Docker and want Claude to power the chat.
```

## What to look for

- The form is tagged `uag`, gets a `properties.description`, and its field descriptions are written for a model; no task is required for a chat.
- `uagAnonymous: "true"` and the Anonymous role's create access are named on their own at the approval gate, with the cost of anonymous turns, the anonymous rate limits and a provider spend limit.
- The page calls `Formio.createChat` after `Formio.use(UAG(...))`, and no project or admin key appears in browser code.
- The UAG service in Compose enables an agent engine (`UAG_ENGINES=claude`) and restricts `CORS` to the page's origin; the skill says the chat needs no Agentic Formflow license on Open Source.
