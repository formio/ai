---
'@formio/mcp': patch
---

Stop declaring the project URL as required configuration.

The server starts with an empty environment, serves its full tool list, and answers `hello` without any configuration; the tools that read or write Form.io data raise an actionable error when called without a project. Declaring `FORMIO_PROJECT_URL` required told hosts to block installation on a value the server runs fine without, which made it harder to try than it actually is. The field description now says plainly that a useful install sets it.
