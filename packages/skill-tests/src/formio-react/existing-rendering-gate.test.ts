// A Next.js application, or one on React Router framework mode, lists `react` and
// so reaches the existing-application branch. Its routes are declared by the
// framework, so the generated data-router resources have nowhere to mount, and the
// only gate it used to meet offered a createBrowserRouter migration — a framework
// replacement. EXISTING.md checks rendering mode first.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const existing = (): string =>
  readFileSync(join(repoRoot, 'plugin/skills/formio-react/EXISTING.md'), 'utf8');

describe('formio-react EXISTING rendering-mode gate', () => {
  it('comes before the data-router gate', () => {
    const text = existing();
    const rendering = text.indexOf('## 2. The rendering-mode gate');
    const dataRouter = text.indexOf('The data-router gate');
    expect(rendering).toBeGreaterThan(-1);
    expect(dataRouter).toBeGreaterThan(rendering);
  });

  it('detects Next.js and React Router framework mode', () => {
    const text = existing();
    expect(text).toContain('`next`');
    expect(text).toContain('`next.config.*`');
    expect(text).toContain('`@react-router/dev`');
    expect(text).toContain('`react-router.config.*`');
    expect(text).toContain('`@remix-run/*`');
  });

  it('stops, offers the embed branch, and never offers a conversion', () => {
    const gate = existing().slice(
      existing().indexOf('## 2. The rendering-mode gate'),
      existing().indexOf('## 3.')
    );
    expect(gate).toMatch(/out of scope/);
    expect(gate).toMatch(/embed branch/);
    expect(gate).toMatch(/Never offer to convert/);
    expect(gate.toLowerCase()).toContain('before writing any file');
  });
});
