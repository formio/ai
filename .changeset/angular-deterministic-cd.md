---
'@formio/ai': minor
---

`formio-angular` skill: generate deterministic Angular apps under modern change detection.

- BOOTSTRAP Step 6 now sets an **explicit change-detection mode** instead of force-re-adding `zone.js`: zoneless (`provideZonelessChangeDetection()`, no `zone.js`) for Angular 20+, zoned (`provideZoneChangeDetection()` + `zone.js`) for Angular 17–19. This removes the version-dependent drift where `ng new` could silently produce a zoneless workspace while the skill assumed zoned.
- CONFIG/AUTH/app-integration keep the simple `{ provide: FormioAppConfig, useValue: AppConfig }` provider — no app-level wiring change is needed because `@formio/angular` >= 11.1 reads that config in the `FormioModule` constructor and configures the SDK (`Formio.setBaseUrl`/`setProjectUrl`) at bootstrap.
- BOOTSTRAP notes one Form.io-specific caveat for zoneless apps (the SDK's promises resolve outside Angular's zone, so refresh views with signals/`markForCheck`, not `NgZone.run`).
- Corrected stale guidance that claimed zone-based CD was required.
