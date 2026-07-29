---
'@formio/mcp': patch
---

Make browser login usable in headless environments instead of hanging. The login URL is now always written to stderr and included in the timeout error, a failed browser launch is reported rather than swallowed, `FORMIO_AUTH_HOST` and `FORMIO_AUTH_PORT` allow binding somewhere a host browser can reach, and `FORMIO_AUTH_TIMEOUT` (default 300s) fails with an actionable message instead of waiting forever. Also reports the real package version to clients — it had been hardcoded to `0.1.0`.
