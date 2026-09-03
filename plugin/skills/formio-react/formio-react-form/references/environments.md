# Build environments

Two environments need setup beyond installing the package. Most do not.

## Vite

The React plugin must be configured — particularly on React 18 and 19. A Vite workspace that already renders JSX has it (`@vitejs/plugin-react` or `@vitejs/plugin-react-swc` in `devDependencies`, and in `vite.config.ts`'s `plugins`), and the `react-ts` template `BOOTSTRAP.md` scaffolds ships it. **Confirm before installing**: check `package.json` and `vite.config.ts` first, and add the plugin only when it is genuinely absent — with the workspace's own package manager, and by adding `react()` to the existing `plugins` array rather than replacing a `vite.config.ts` that may carry aliases, proxies, or other plugins.

Only when it is missing:

```bash
<package manager> add -D @vitejs/plugin-react
```

```ts
// vite.config.ts — add to the existing plugins array
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
```

## Next.js

`@formio/js` depends on `window` and other browser globals, and Next.js has a server-rendering pass.

**Marking the file a client component is not sufficient.** This is the assumption most readers arrive with, and it is wrong: `'use client'` governs hydration and interactivity, not whether the module is evaluated during the server render. The import still runs on the server, and it still reaches for `window`.

Import the component dynamically with server rendering disabled:

```tsx
'use client';
import { useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Webform } from '@formio/js';

const Form = dynamic(() => import('@formio/react').then((m) => m.Form), { ssr: false });

export default function Page() {
  const instance = useRef<Webform | null>(null);
  return (
    <Form
      src="https://yourproject.form.io/yourform"
      onFormReady={(i) => { instance.current = i; }}
    />
  );
}
```

## Everything else

Create React App, Parcel, Webpack, and similar bundlers need no extra configuration. Do not go looking for it.

## A note on server rendering generally

The renderer is DOM-only. Any framework that renders your component tree on the server needs the same treatment as Next.js: keep the form out of the server pass. This is also why `formio-react`'s CRUD branches target client-rendered applications only.
