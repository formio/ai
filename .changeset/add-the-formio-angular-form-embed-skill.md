---
'@formio/ai': minor
---

Add the `formio-angular-form` embedding sub-skill, and turn `formio-angular` into a two-branch router.

Angular now has the embedding coverage React had: `formio-angular` dispatches between an application build (its five gated phases) and a single-form embed, and the embed branch loads `formio-angular-form`. Its eight references cover mounting, the event surface and the live `Webform` instance, the lifecycle contract, change detection under `zone.js` and zoneless, project URLs and `FormioAppConfig`, server-rendering limits, stylesheets, and mounting the renderer directly. Definition-level behaviour stays with `formio-form`, which now hands an Angular workspace over instead of reporting that no Angular embedding skill exists.

The skill documents `@formio/angular`'s `<formio>` component and nothing else — the same component `@formio/angular/resource`'s CRUD screens mount, so an embed added today survives the application later gaining those screens.

The second path is `Formio.createForm` in a component, which is honest about what it hands over: `references/renderer-directly.md` names the three cases that warrant it and states the four obligations as its price — `destroy(true)` in `ngOnDestroy`, a destroyed-mid-build guard, a submit latch in a plain field, and publishing renderer callbacks with a `signal()` write or `markForCheck` rather than `NgZone.run`, which is a no-op under zoneless.
