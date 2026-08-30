---
'@formio/ai': patch
---

**The preflight is one check again: is `form_list` callable?** Each of the eleven gated skills carried a ~4KB preflight that had accreted into four subjects under a heading naming one — what the check is, when to run it, what to do if it fails, a ban on hand-rolled HTTP, and the whole project-resolution contract. Its opening paragraph alone had reached 1266 characters. The server-side half is now two paragraphs: the check and its one remedy, then the reminder that everything before that call needs no server. The ban on raw HTTP and the project-resolution contract keep their text but move to headings of their own, because neither is a preflight.

**The check names one concrete tool, under whatever name the client exposes it.** The namespacing clause matters: a client may expose the tool as `mcp__formio-mcp__form_list`, and a probe read literally against the bare name would miss it. It used to ask, abstractly, whether "the Form.io tools" were callable, and abstraction invites an agent to reason about whether they are present but not yet usable. `form_list` admits no such reading, and everything written to argue against it is gone.

**Authentication is no longer discussed before it happens.** The rules forbidding a pre-announced authentication step, an "installed but not authenticated" report, a client menu, a slash command, and an authorize-in-the-browser step are all removed. They described a state this server does not have: measured against the built server over stdio with a clean `HOME`, `tools/list` returns all 21 tools, `form_list` among them, before any authentication and without writing a token cache — auth moved off startup in `lazy-auth-on-first-tool-call` and fires at the first API call. `form_list` is therefore callable exactly when the server is connected. An unauthenticated call returns an actionable error and the agent decides from that.

**And the fallback for "the setup skill is not installed either" is gone.** `npx skills add formio/ai` installs the library as a unit, so a gated skill that is present never has `formio-mcp-setup` missing beside it.

The test that pinned the removed prose is deleted, along with the assertions in `preflight-blocking-scope.test.ts` that guarded the removed rules. What still holds: the check names `form_list`, it happens at the first tool call rather than at activation, `formio-mcp-setup` is the only remedy, and `shared-prose-stays-identical` still requires all eleven copies to be byte-identical.
