---
'@formio/ai': minor
---

`formio-angular` skill: generate deterministic Angular apps under modern change detection.

- The skill now always targets the latest Angular `@formio/angular` supports and **pins zoneless change detection explicitly** (`provideZonelessChangeDetection()`, no `zone.js`) in BOOTSTRAP Step 6, instead of force-re-adding `zone.js` and inheriting the CLI's drifting default. No specific Angular version is named in the skill.
- CONFIG/AUTH/app-integration keep the simple `{ provide: FormioAppConfig, useValue: AppConfig }` provider — no app-level wiring change is needed because `@formio/angular` reads that config in the `FormioModule` constructor and configures the SDK (`Formio.setBaseUrl`/`setProjectUrl`) at bootstrap.
- BOOTSTRAP notes one Form.io-specific caveat for zoneless apps (the SDK's promises resolve outside Angular's zone, so refresh views with signals/`markForCheck`, not `NgZone.run`).
- Corrected stale guidance that claimed zone-based CD was required.
