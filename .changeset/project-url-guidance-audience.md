---
'@formio/mcp': patch
'@formio/ai': patch
---


**The unconfigured report is written for the person who reads it.** Every skill instructs the agent to relay that report verbatim and ask for the one value it names, so the audience is a human — and a third of what they were handed was prohibitions written to stop an AGENT constructing a URL rather than asking for one: a `*.form.io` host is not a Base URL, `https://api.form.io/<project>` is not a project, never append a project name to a deployment URL. Someone being asked "what is your Project URL?" is going to paste the one they have; those rules read as guardrails built for somebody else, and they turned a three-line question into eight. They are not deleted — `PROJECT_URL_GUIDANCE` keeps them and the server's own instructions carry it, so an agent with no skills installed still meets them at connect time, which is the surface they were written for. The report, the CLI's report, and the error every other tool raises now carry `PROJECT_URL_FOR_A_USER` instead: what a Project URL is, and the shapes it takes. That last error also stops explaining that `FORMIO_PROJECT_URL` is the weakest of the three records — precedence is the agent's business, and it was a third of the length of a message relayed straight to the user.
