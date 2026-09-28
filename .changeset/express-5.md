---
'@formio/mcp': patch
---

Move the portal-login and revisions-consent servers to Express 5, and handle the two edges it changed.

A login port that is already taken — a fixed `FORMIO_AUTH_PORT` in use by something else — now fails `authenticate` at once with an error naming the host and port. Express 5 hands the bind failure to `app.listen`'s callback, which used to ignore it, so the call would have sat on a blank wait until the login timeout. A callback POST that is not JSON is answered 400 on the login page and treated as no choice on the consent page, instead of reading a property off the `req.body` Express 5 no longer defaults to `{}` and failing with a 500. Express 4 also no longer ships alongside the MCP SDK's own Express 5.
