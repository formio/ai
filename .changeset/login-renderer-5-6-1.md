---
'@formio/mcp': patch
'@formio/ai': patch
---

Move the portal-login page's renderer to `@formio/js` 5.6.1 and take the minor releases of the MCP SDK (1.30) and zod (4.6).

The login page's Subresource Integrity digests were re-derived with `pnpm sync:sri` from the bytes jsDelivr serves. `formio-form`'s CDN example carried its own hand-copied digests, which a URL bump alone would have left stale — and a stale digest makes the browser block the renderer outright — so it moves to 5.6.1 with the same digests, and a test now holds every documented digest to the one `auth.ts` verifies.
