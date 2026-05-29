## Overview

Input masks, HTML sanitization, and DOM helpers. Sourced from `packages/core/src/utils/mask.ts`, `packages/core/src/utils/sanitize.ts`, and `packages/core/src/utils/dom.ts` in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
import { dom } from '@formio/core'; // for the DOM helpers below
```

`Utils.getInputMask`, `Utils.matchInputMask`, and `Utils.sanitize` are exposed by `@formio/js/utils`. The DOM helpers (`dom.appendTo`, `dom.prependTo`, `dom.removeChildFrom`) are exposed by `@formio/core` — the renderer does not re-export them.

## API

Input masks (`Utils.getInputMask`, `Utils.matchInputMask`):

- `Utils.getInputMask(mask: string | any[], placeholderChar?: string): any[]` — convert a Form.io mask string into the array shape `text-mask` consumes. Token meanings:
  - `9` → digit (`0-9`)
  - `A` → letter, **case-insensitive** (`A-Z`/`a-z` — the SDK compiles both `A` and `a` to `/[a-zA-Z]/`)
  - `a` → letter, **case-insensitive** (same regex as `A`)
  - `*` → alphanumeric
  - Any other character (`-`, `(`, ` `, …) becomes a literal in the mask.
- `Utils.matchInputMask(value: string, inputMask: any[]): boolean` — return `true` if `value` conforms to the mask returned by `getInputMask`.

HTML sanitization (`Utils.sanitize`):

- `Utils.sanitize(html: string, options: SanitizeOptions): TrustedHTML | string` — pass user-provided HTML through DOMPurify with Form.io's defaults. Options:
  - `addAttr: string[]` — additional safe attributes.
  - `addTags: string[]` — additional safe tags.
  - `allowedTags: string[]` — exact tag whitelist (overrides defaults).
  - `allowedAttrs: string[]` — exact attribute whitelist.
  - `sanitizeConfig: DOMPurify.Config` — escape hatch for the raw DOMPurify config.

DOM helpers (`dom` from `@formio/core`):

- `dom.appendTo(element, container): void` — append `element` to `container` if both exist.
- `dom.prependTo(element, container): void` — insert `element` as the first child of `container`.
- `dom.removeChildFrom(element, container): void` — remove `element` from `container` if it is a child.
- `dom.empty(element): void` — remove every child of `element`.

## Examples

### Build a phone-number mask

```ts
import { Utils } from '@formio/js/utils';

const mask = Utils.getInputMask('(999) 999-9999');
console.log(mask);
// ['(', /\d/, /\d/, /\d/, ')', ' ', /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/]

console.log(Utils.matchInputMask('(415) 555-1212', mask)); // true
console.log(Utils.matchInputMask('415-555-1212', mask)); // false
```

### Mask a SKU

```ts
import { Utils } from '@formio/js/utils';

const mask = Utils.getInputMask('AAA-999');
console.log(Utils.matchInputMask('ACM-001', mask)); // true
console.log(Utils.matchInputMask('acm-001', mask)); // true — `A` is case-insensitive
console.log(Utils.matchInputMask('A1M-001', mask)); // false — digit where letter expected
```

### Sanitize HTML before rendering

```ts
import { Utils } from '@formio/js/utils';

const safe = Utils.sanitize('<p>Hello <script>alert(1)</script><b>world</b></p>', {});
console.log(safe.toString()); // "<p>Hello <b>world</b></p>"
```

### Allow extra tags / attributes

```ts
import { Utils } from '@formio/js/utils';

const safe = Utils.sanitize('<article data-tag="news">Hi</article>', {
  addTags: ['article'],
  addAttr: ['data-tag'],
});
```

### Manipulate the DOM via helpers (from `@formio/core`)

```ts
import { dom } from '@formio/core';

const banner = document.createElement('div');
banner.className = 'banner';
banner.textContent = 'Saved!';
dom.prependTo(banner, document.getElementById('formio')!);

setTimeout(() => {
  dom.removeChildFrom(banner, document.getElementById('formio')!);
}, 2000);
```
