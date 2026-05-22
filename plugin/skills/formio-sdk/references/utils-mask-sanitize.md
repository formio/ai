## Overview

Input masks, HTML sanitization, and DOM helpers. Sourced from `packages/core/src/utils/mask.ts`, `packages/core/src/utils/sanitize.ts`, and `packages/core/src/utils/dom.ts` in the Form.io source code.

## Imports

```ts
import { Utils } from '@formio/js/utils';
```

## API

Input masks (`Utils.getInputMask`, `Utils.matchInputMask`):

- `Utils.getInputMask(mask: string | any[], placeholderChar?: string): any[]` — convert a Form.io mask string into the array shape `text-mask` consumes. Token meanings:
  - `9` → digit (`0-9`)
  - `A` → uppercase letter (`A-Z`)
  - `a` → lowercase letter (`a-z`)
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

DOM helpers (`Utils.dom`):

- `Utils.dom.appendTo(element, container): void` — append `element` to `container` if both exist.
- `Utils.dom.prependTo(element, container): void` — insert `element` as the first child of `container`.
- `Utils.dom.removeChildFrom(element, container): void` — remove `element` from `container` if it is a child.

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
console.log(Utils.matchInputMask('acm-001', mask)); // false
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

### Manipulate the DOM via helpers

```ts
import { Utils } from '@formio/js/utils';

const banner = document.createElement('div');
banner.className = 'banner';
banner.textContent = 'Saved!';
Utils.dom.prependTo(banner, document.getElementById('formio')!);

setTimeout(() => {
  Utils.dom.removeChildFrom(banner, document.getElementById('formio')!);
}, 2000);
```
