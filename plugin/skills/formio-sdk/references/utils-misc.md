## Overview

Miscellaneous helpers — date utilities, i18n, JWT decode, submission unwind, deep clone, and class override. Sourced from `packages/core/src/utils/date.ts`, `packages/core/src/utils/i18n.ts`, `packages/core/src/utils/jwtDecode.ts`, `packages/core/src/utils/unwind.ts`, `packages/core/src/utils/fastCloneDeep.ts`, `packages/core/src/utils/override.ts`, and `packages/formio.js/src/utils/i18n.js` in the Form.io source code.

`@formio/js/utils` re-exports the date helpers and `fastCloneDeep` flat on `Utils`. The renderer does **not** re-export `I18n`, `unwind`, or `override` — import those from `@formio/core`. There is no `jwtDecode` helper on either entry point: use `Formio.getToken({ decode: true })` to read the cached SDK JWT, or pull a standalone decoder for arbitrary tokens.

## Imports

```ts
import { Utils } from '@formio/js/utils'; // date helpers, fastCloneDeep
import { I18n, unwind, override } from '@formio/core'; // not exposed by @formio/js
import { Formio } from '@formio/js'; // for JWT decode via getToken({ decode: true })
```

## API

Date (flat on `Utils`):

- `Utils.moment` — the bundled `moment` instance with `moment-timezone` loaded (`.tz()` is available).
- `Utils.momentDate(date, format?, timezone?): moment.Moment` — convenience constructor that respects a timezone string.
- `Utils.currentTimezone(): string` — browser/Node timezone via `moment.tz.guess()`.
- `Utils.convertFormatToMoment(format: string): string` — translate Angular date format tokens (`MM/dd/yyyy`) into moment tokens (`MM/DD/YYYY`).
- `Utils.formatDate(value, format, timezone?): string` — high-level formatter used by Form.io's Date/Time component.
- `Utils.isValidDate(value): boolean`, `Utils.offsetDate(date, timezone?)`, `Utils.getLocaleDateFormatInfo(locale?)`, `Utils.getDateSetting(value)` — additional helpers re-exported flat on `Utils`.

i18n (`I18n` class from `@formio/core`):

- `new I18n(languages?: Record<string, Record<string, string>>)` — manage a language dictionary at runtime.
- `setLanguages(languages)` — install or replace dictionaries.
- `changeLanguage(language)` — switch active language.
- `t(key, defaultValue?)` — translate a key under the active language.

In the renderer, the live translator is exposed on the `Form` instance as `form.i18next` (i18next-backed); the `I18n` class is the standalone dictionary helper used outside the renderer.

JWT decode:

- `Formio.getToken({ decode: true })` — read **and** decode the SDK's currently-cached JWT in one call. Returns the decoded payload (`{ user, form, project, exp, iat, … }`).
- For decoding arbitrary JWTs (not the SDK's cached one), pull a standalone decoder such as the `jwt-decode` npm package. `@formio/core` ships an internal `jwtDecode` but does not re-export it from any public entry point.

Submission unwind (`unwind` from `@formio/core`):

- `unwind(form, submission): Submission[]` — explode nested array data into one submission per row. Useful for exporting datagrid/editgrid rows as flat records. `rewind` is **not** part of the public surface; use a manual fold or `lodash.merge` to reassemble.

Cloning and override (mixed):

- `Utils.fastCloneDeep(obj: any): any` — `JSON.parse(JSON.stringify(obj))` with error handling; returns `null` on failure.
- `override(classObj: any, extenders: any): void` (from `@formio/core`) — replace prototype methods/properties on a class. Each entry in `extenders` is either a function (replaces the method) or a property descriptor.

## Examples

### Decode the SDK's cached JWT

```ts
import { Formio } from '@formio/js';

const claims = Formio.getToken({ decode: true });
if (claims && claims.user) {
  console.log('logged in as', claims.user._id, 'expires', claims.exp);
}
```

### Translate an Angular date format

```ts
import { Utils } from '@formio/js/utils';

const momentFormat = Utils.convertFormatToMoment('MM/dd/yyyy h:mm a');
console.log(momentFormat); // "MM/DD/YYYY h:mm A"
```

### Format the current time in the browser's timezone

```ts
import { Utils } from '@formio/js/utils';

const now = Utils.moment().tz(Utils.currentTimezone()).format('YYYY-MM-DD HH:mm');
console.log(now);
```

### Switch language at runtime via `I18n` (from `@formio/core`)

```ts
import { I18n } from '@formio/core';

const i18n = new I18n();
i18n.setLanguages({
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

### Override a component class method (`override` from `@formio/core`)

```ts
import { override } from '@formio/core';

class TextFieldStub {
  rawValue = 'raw  ';
  getValue() {
    return this.rawValue;
  }
}

override(TextFieldStub, {
  getValue(this: TextFieldStub) {
    const v = (this as unknown as { _origGetValue: () => string })._origGetValue();
    return typeof v === 'string' ? v.trim() : v;
  },
  _origGetValue: TextFieldStub.prototype.getValue,
});

console.log(new TextFieldStub().getValue()); // "raw"
```

### Unwind a submission with a nested array (`unwind` from `@formio/core`)

```ts
import { unwind } from '@formio/core';

const form = {
  components: [
    { type: 'textfield', key: 'customer', input: true },
    {
      type: 'datagrid',
      key: 'items',
      input: true,
      components: [
        { type: 'textfield', key: 'sku', input: true },
        { type: 'number', key: 'qty', input: true },
      ],
    },
  ],
};

const submission = {
  data: {
    customer: 'Acme',
    items: [
      { sku: 'A1', qty: 2 },
      { sku: 'B2', qty: 5 },
    ],
  },
};

const rows = unwind(form, submission);
console.log(rows.length); // one submission per top-level row in the unwound output
```
