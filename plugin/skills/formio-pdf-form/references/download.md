# Downloading a submission as PDF

This reference is loaded by the parent `formio-pdf-form` skill when an application should give its users their submission as a PDF. It is not a standalone skill.

Downloading happens in the user's application, at runtime, when a person asks for their PDF. It is not a build-time call this session makes; the code you write calls it.

## The URL

In the application, the SDK builds it: `getDownloadUrl` on a submission instance — see [`formio-sdk`'s submissions reference](../../formio-sdk/references/submissions.md). It mints a temporary token that lasts an hour and returns the submission's download URL carrying it, which opens the PDF without the user's own session token. If minting fails it returns the URL without a token, which then answers 401 — check for that rather than handing it on. The endpoint shapes, including the token request, are in [`pdf-api.md`](../../formio-api/references/pdf-api.md).

## What it prints

- A PDF form prints its data over its own PDF.
- A webform with a saved `pdfComponents` template prints through that template.
- Any other webform prints its own layout.

## Query parameters

The download accepts, among others: `format` (`pdf`, or `html` to see the page it prints from), `pageSize`, `orientation`, `margin` (four comma-separated values: top, right, bottom, left), and `language`. Append them to the URL the SDK returns.

## The token

The token opens one submission's PDF and expires. Mint it per request, when the user asks for the file; never store it, log it, or put the URL somewhere a third party can read it.
