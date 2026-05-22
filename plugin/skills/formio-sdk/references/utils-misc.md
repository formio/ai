## Overview

Miscellaneous helpers exported from `@formio/js/utils`: date utilities, i18n, JWT decode, submission unwind/rewind, deep clone, and class override. Sourced from `packages/core/src/utils/date.ts`, `packages/core/src/utils/i18n.ts`, `packages/core/src/utils/jwtDecode.ts`, `packages/core/src/utils/unwind.ts`, `packages/core/src/utils/fastCloneDeep.ts`, `packages/core/src/utils/override.ts`, and `packages/formio.js/src/utils/i18n.js` in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
```

## API

Date (`Utils.date`):

- `Utils.date.dayjs` — the `dayjs` instance with `utc`, `timezone`, `advancedFormat`, and `customParseFormat` plugins pre-loaded.
- `Utils.date.currentTimezone(): string` — browser/Node timezone via `dayjs.tz.guess()`.
- `Utils.date.convertFormatToMoment(format: string): string` — translate Angular date format tokens (`MM/dd/yyyy`) into moment/dayjs tokens (`MM/DD/YYYY`).

i18n (`Utils.i18n`):

- `Utils.i18n.t(key: string, options?): string` — translation marker used by Form.io's translation tooling; in the renderer the live translator is exposed on the `Form` instance as `form.i18next`.
- `Utils.i18n.i18nConfig` — default i18n configuration (separators, default language, baseline resources).
- `Utils.i18n.coreEnTranslation` — the English translation dictionary shipped with `@formio/core`.

The renderer also exports the `I18n` class (`packages/formio.js/src/utils/i18n.js`):

- `new I18n(languages?: object)` — manage a language dictionary at runtime.
- `setLanguages(languages)` / `changeLanguage(language)` / `t(key, defaultValue?)`.

JWT (`Utils.jwtDecode`):

- `Utils.jwtDecode(token: string, options?: { header?: boolean }): object` — decode the payload (default) or the header (`{ header: true }`).

Submission unwind / rewind (`Utils.unwind`, `Utils.rewind`) — deprecated but still exported:

- `Utils.unwind(form, submission): Submission[]` — explode nested array data into one submission per row.
- `Utils.rewind(submissions): Submission` — fold rows back into a nested submission.

Cloning and override:

- `Utils.fastCloneDeep(obj: any): any` — `JSON.parse(JSON.stringify(obj))` with error handling; returns `null` on failure.
- `Utils.override(classObj: any, extenders: any): void` — replace prototype methods/properties on a class. Each entry in `extenders` is either a function (replaces the method) or a property descriptor.

## Examples

### Decode a JWT payload

```ts
import { Utils } from '@formio/js/utils';

const claims = Utils.jwtDecode(localStorage.getItem('myapp.jwt') ?? '');
console.log(claims.user, claims.exp);
```

### Translate an Angular date format

```ts
import { Utils } from '@formio/js/utils';

const dayjsFormat = Utils.date.convertFormatToMoment('MM/dd/yyyy h:mm a');
console.log(dayjsFormat); // "MM/DD/YYYY h:mm a"
```

### Format the current time in the browser's timezone

```ts
import { Utils } from '@formio/js/utils';

const now = Utils.date.dayjs().tz(Utils.date.currentTimezone()).format('YYYY-MM-DD HH:mm z');
console.log(now);
```

### Switch language at runtime via the renderer's I18n

```ts
import { Utils } from '@formio/js/utils';

const i18n = new Utils.I18n({
  en: { hello: 'Hello' },
  fr: { hello: 'Bonjour' },
});
i18n.changeLanguage('fr');
console.log(i18n.t('hello')); // "Bonjour"
```

### Deep-clone a submission safely

```ts
import { Utils } from '@formio/js/utils';

const draft = Utils.fastCloneDeep(submission);
if (draft) {
  draft.data.firstName = 'Edited';
}
```

### Override a component class method

```ts
import { Utils } from '@formio/js/utils';
import { Formio } from '@formio/js';

const TextField = Formio.Components.components.textfield;

Utils.override(TextField, {
  getValue(this: any) {
    const v = this._origGetValue();
    return typeof v === 'string' ? v.trim() : v;
  },
  _origGetValue: TextField.prototype.getValue,
});
```

### Unwind a submission with a nested array

```ts
import { Utils } from '@formio/js/utils';

const submission = {
  data: {
    customer: 'Acme',
    items: [
      { sku: 'A1', qty: 2 },
      { sku: 'B2', qty: 5 },
    ],
  },
};

const rows = Utils.unwind(form, submission);
console.log(rows.length); // 2 (one per item)
```
