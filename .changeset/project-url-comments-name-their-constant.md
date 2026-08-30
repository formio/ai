---
'@formio/mcp': patch
---

**The rationale comments on the two project-URL constants now describe the constant they sit above.** Splitting the guidance into a user-facing text and an agent-facing one left one block of reasoning stranded over the wrong constant: it claimed the server's own instructions carry `PROJECT_URL_FOR_A_USER`, which is exactly what the split stopped them doing, while `PROJECT_URL_GUIDANCE` lost the note explaining why neither text mentions the Base URL. As the code actually stands, `PROJECT_URL_GUIDANCE` is imported only by `server.ts` — the instructions an agent reads at connect time — and `PROJECT_URL_FOR_A_USER` only by `project-report.ts` and `project-resolver.ts`, the reports a person reads. Each comment now says so.

Source comments only, with no behavior change — but this package compiles `dist/` from `src/` without `removeComments`, so the emitted JavaScript carries them and the published artifact really does differ. Hence the bump.
