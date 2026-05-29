# Project Settings Reference

`settings` is the bag of project-level configuration covering API exposure (keys, CORS, CSP), public configuration, custom JS/CSS, third-party integrations (email, captcha, e-sign, file storage, SQL connector, Google Drive, Kickbox), and authorization providers (OAuth, LDAP, SAML).

## Encryption at rest

The entire `settings` object is **encrypted at rest** in MongoDB. The server's Mongoose schema installs the `EncryptedProperty` plugin against `settings` (`plugins/EncryptedProperty`, `plainName: 'settings'`). The round-trip works like this:

1. Consumers send **plaintext** `settings` JSON over the API on create / update.
2. The server **encrypts** the bag before persisting it to MongoDB.
3. On read, the server **decrypts** the bag and returns plaintext to authorized callers.
4. Direct database access (mongosh, backup files, replica reads) sees **ciphertext** only.

This matters when you're reading project documents out-of-band (e.g., from a database backup) — the settings will be opaque without the server's encryption key. It also means that anything you put in `settings` is treated as sensitive by the platform — use it for secrets (SMTP credentials, OAuth client secrets, API keys), not for non-sensitive configuration that consumers should see directly.

## ProjectSettings keys

| Key                  | Type                       | Role                                                                                                          |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `appOrigin`          | `string`                   | The project's canonical application origin (`https://app.example.com`).                                       |
| `keys`               | `Array<{ key: string }>`   | API key entries used for server-to-server / API-key authentication mode.                                      |
| `cors`               | `string`                   | CORS allowed-origins value the server returns. `"*"` for permissive; comma-separated for explicit allowlist.  |
| `csp`                | `string`                   | Content-Security-Policy header value the server attaches to project responses.                                |
| `secret`             | `string`                   | Project-level shared secret used by signing flows.                                                            |
| `remoteSecret`       | `string`                   | Secret set after this project is connected to a remote stage. It is the PORTAL_SECRET of the remove env.      |
| `pdfserver`          | `string`                   | URL of the PDF server this project routes PDF operations to.                                                  |
| `filetoken`          | `string`                   | Signing token used by the file upload / download flow.                                                        |
| `allowConfig`        | `boolean`                  | Surface `config` to portal UI callers.                                                                        |
| `allowConfigToForms` | `boolean`                  | Surface `config` to form renderers (forms can read public config values).                                     |
| `custom`             | `{ css?, js? }`            | Custom global CSS / JS injected into project-rendered forms.                                                  |
| `formModule`         | `string`                   | URL or module identifier for a custom form-module bundle to load.                                             |
| `email`              | `ProjectEmailConfig`       | Email provider config — one of `smtp`, `sendgrid`, `mailgun`. See `integrations/email.ts` upstream.           |
| `captcha`            | `ProjectCaptchaConfig`     | reCAPTCHA / Cloudflare Turnstile config — `{ siteKey, secretKey }`.                                                       |
| `recaptcha`          | `ProjectCaptchaConfig`     | Legacy reCAPTCHA configuration alongside `captcha`. Same shape.                                               |
| `esign`              | `ProjectESignConfig`       | Box e-sign configuration including enterprise ID and Box app credentials. See `integrations/eSign.ts`.        |
| `google`             | `ProjectGoogleDriveConfig` | Google Drive integration — `{ clientId, cskey, refreshtoken }`. See `integrations/dataConnections.ts`.        |
| `kickbox`            | `ProjectKickboxConfig`     | Kickbox email-verification API key — `{ apikey }`.                                                            |
| `sqlconnector`       | `ProjectSQLConnectorConfig`| SQL Connector config — `{ host, password, type: 'mysql'\|'mssql'\|'postgres', user }`.                        |
| `storage`            | `ProjectFileStorageConfig` | File-storage provider config — one of `azure`, `s3` (or MinIO), `dropbox`, `google`. See `integrations/fileStorage.ts`. |
| `tokenParse`         | `string`                   | Custom JWT-claim parser expression for resolving the authenticated user.                                      |
| `oauth`              | `ProjectOauthConfig`       | OAuth providers — one or more of `openid`, `github`, `google`. See `authorization/oauth.ts` for per-provider shape. |
| `ldap`               | `ProjectLdapConfig`        | LDAP bind / search config — `{ bindDn, bindCredentials, searchBase, searchFilter, url }`. See `authorization/ldap.ts`. |
| `saml`               | `ProjectSamlConfig`        | SAML IdP / SP configuration including `idp`, `issuer`, `callbackUrl`, roles mapping. See `authorization/saml.ts`. |

## Integration and authorization details

Each integration / authorization block is its own sub-type with its own field set. Documenting every provider's full shape here would duplicate the upstream type files and balloon this reference. Instead:

- For runtime behavior of these providers (how the server authenticates against them, what endpoints they expose), see the `formio-api` skill's `runtime-auth`, `platform-auth`, and `project-auth` references.

## See also

- `project-definition.md` — where `settings` sits on the Project envelope.
- `project-access.md` — for project-level access entries (separate from settings).
- The `formio-api` skill's `platform-projects` reference for project endpoint contract.
