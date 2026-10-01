---
'@formio/mcp': patch
---

Open the portal-login and revisions-consent pages in the browser on Windows. Both pages were launched with `exec('start "<url>"')`, and `start` reads its first quoted argument as a window title, so Windows opened an empty console window titled with the URL and no browser — the tool call then waited out the login timeout with no page in front of the user. Both pages now go through one launcher that runs no shell: `open` on macOS, `xdg-open` on Linux, and `rundll32 url.dll,FileProtocolHandler` on Windows, each handed the URL as its own argument. The consent page also now reports a failed launch on stderr with its URL, as the login page already did, instead of ignoring it.
