# @formio/ai

## 0.7.0

### Minor Changes

- e620bdb: Fixed login action and email action related issues.

## 0.6.0

### Minor Changes

- 231c3bf: Fixed issues where "admin" applications would pick "user" for Login actions instead of "admin"

## 0.5.0

### Minor Changes

- 49c727b: `formio-angular` skill: generate deterministic Angular apps under modern change detection.
  - The skill now always targets the latest Angular `@formio/angular` supports and **pins zoneless change detection explicitly** (`provideZonelessChangeDetection()`, no `zone.js`) in BOOTSTRAP Step 6, instead of force-re-adding `zone.js` and inheriting the CLI's drifting default. No specific Angular version is named in the skill.
  - CONFIG/AUTH/app-integration keep the simple `{ provide: FormioAppConfig, useValue: AppConfig }` provider — no app-level wiring change is needed because `@formio/angular` reads that config in the `FormioModule` constructor and configures the SDK (`Formio.setBaseUrl`/`setProjectUrl`) at bootstrap.
  - BOOTSTRAP notes one Form.io-specific caveat for zoneless apps (the SDK's promises resolve outside Angular's zone, so refresh views with signals/`markForCheck`, not `NgZone.run`).
  - Corrected stale guidance that claimed zone-based CD was required.

## 0.4.1

### Patch Changes

- ae993dc: Fixed issues with baseURL not getting set correctly.
- 4237e6c: Check cached JWT expiry locally before use. The MCP server now decodes a cached
  token's `exp` claim and clears expired tokens — both from the on-disk cache and
  the in-process cache — before attempting any request, triggering re-auth instead
  of thrashing on failing calls with a known-dead token.

## 0.4.0

### Minor Changes

- f75be94: Added authenticated route guards to the angular skill.

## 0.3.0

### Minor Changes

- 736278e: Added better authentication indication in login page. Improved formio-angular for correct Auth module use. Encourage the use of frontend-design skill when building applications.

## 0.2.0

### Minor Changes

- d98a326: Added formio-auth, formio-schema, form revision support, and many improvements to the skills.
