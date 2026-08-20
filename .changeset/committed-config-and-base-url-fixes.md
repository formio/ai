---
'@formio/mcp': patch
---

Fix three ways project configuration answered about a project or deployment that does not govern the directory.

**A `*.form.io` `FORMIO_BASE_URL` is refused for a project whose deployment is underivable.** A path-less project URL on a customer domain (`https://myproject.mysite.com`) names no deployment — that is a sibling sub-domain — so the environment global is all there is, and it was taken unchecked. `https://api.form.io` is the value most likely to be stale in a shell, and taken there it became the portal-login URL and the token-cache key for a deployment the user does not use. It is now ignored with a note, leaving the base URL unresolved so the first call that needs it fails asking for that one value. A global on another customer host is still kept for this shape, because a differing host is exactly what a sibling sub-domain looks like.

**A committed `formio.json` now outranks the mapping in both writers, as it already did at resolve time.** `project_set` and `project set` computed "what this directory resolves to" as mapping-then-committed, the reverse of resolution. With both on record they reported the mapped project as active while every later tool call resolved the committed one, and asked the base-URL derivation questions against the wrong URL. The write still lands — it is the fallback if the committed file goes away — and both writers now name the committed file as the record that governs until it changes.

**`project get`'s documented exit codes include `3`.** Both READMEs enumerated `0` / `1` / `2` and omitted `EXIT_BASE_URL_UNRESOLVED`, so a reader or agent branching on them treated the half-configured directory as an unknown code. They also prescribed `project set --project-url <url> --base-url <url>`, teaching the habit the derivation design exists to remove; the base URL is now shown as the flag to add only when the server says it cannot be determined. A test asserts every `EXIT_*` constant appears in both footnotes.

Also: the unresolved-base-URL error for a revisions write spelled its substitution slot `${baseUrl}`, the form the library's own terminology rule treats as an environment read. It is now `{baseUrl}`.
