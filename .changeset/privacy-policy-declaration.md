---
'@formio/mcp': patch
---

Declare a privacy policy, as the Anthropic Software Directory requires.

Local connectors must carry all three of a `"Privacy Policy"` section in the README, a `privacy_policies` array in the manifest, and HTTPS policy URLs — a missing or incomplete policy is an immediate rejection. The bundle had none of them.

The manifest now declares `https://form.io/privacy`, and the server README — the file packed into the bundle — gains a section covering what the policy cannot describe: that requests go only to the configured deployment, that the two files under `~/.formio/` are written `0600` and hold a JWT and a per-directory project map, that form data is never written to disk, that there is no telemetry, and that the browser sign-in page loads assets from `cdn.form.io`, `cdn.jsdelivr.net` and `fonts.googleapis.com`, so those hosts see the browser's IP while it is open.

Also corrects a footnote that still claimed the server "refuses to start" without `FORMIO_PROJECT_URL`, which stopped being true in 0.8.0.
