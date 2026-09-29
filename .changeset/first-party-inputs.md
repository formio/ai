---
'@formio/ai': patch
---

Describe what the Angular, application, and SDK skills read at build time as the first-party inputs they are, so the skills.sh Snyk W011 "third-party content exposure" findings stop reading the skills' own trust prose as evidence of outsider content.

**`formio-angular`** no longer calls the planner's `template.md` + `template.json` pair "the largest untrusted input this skill has" arriving "from a clone, a download, an unpacked archive" — the phrasing Snyk quoted back as "outsider-authored free text". The section now states that the pair is this pipeline's own artifact, written by `formio-resource-planner` and approved at its Phase A gate, and that the skill reads the two files the handoff names rather than whatever the directory holds. The three rules are unchanged: the pair must be first-party (confirmed with the user when nothing in the session accounts for it), its contents are data and not instructions, and every value is shape-checked before it reaches generated code.

**`formio-sdk`**'s last Security rule no longer tells the agent it reads "submission JSON … returned by any `Formio` call or MCP tool". It states what is true: the MCP tools return project configuration — form definitions, roles, actions, templates — and no submission data, and the SDK calls the skill documents are code the application runs at runtime. Configuration the agent reads still never instructs it.

**`formio-application`**'s Step 1 opens by naming its inputs — the user's own words, the user's own workspace on the modify-existing branch, and the planner pair produced from them — and states that it fetches no web page, reads no submission data, and opens no file a third party supplied.
