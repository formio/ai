// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-mask-sanitize.md`.

import { describe, expect, it } from 'vitest';
import { Utils as TypedUtils } from '@formio/js/utils';
import { dom } from '@formio/core';

// The published TS types for `getInputMask` / `matchInputMask` are stricter
// than the runtime — the references and the actual SDK accept the looser
// signatures used below. Cast through `any` so the tests exercise the
// documented call shape exactly.
const Utils = TypedUtils as unknown as {
  getInputMask: (mask: string, placeholderChar?: string) => unknown[];
  matchInputMask: (value: string, mask: unknown[]) => boolean;
  sanitize: (html: string, options: Record<string, unknown>) => unknown;
};

describe('utils-mask-sanitize.md examples', () => {
  it('Build a phone-number mask', () => {
    const mask = Utils.getInputMask('(999) 999-9999');
    expect(Array.isArray(mask)).toBe(true);
    expect(Utils.matchInputMask('(415) 555-1212', mask)).toBe(true);
    expect(Utils.matchInputMask('415-555-1212', mask)).toBe(false);
  });

  it('Mask a SKU (A token is case-insensitive)', () => {
    const mask = Utils.getInputMask('AAA-999');
    expect(Utils.matchInputMask('ACM-001', mask)).toBe(true);
    expect(Utils.matchInputMask('acm-001', mask)).toBe(true);
    expect(Utils.matchInputMask('A1M-001', mask)).toBe(false);
  });

  it('Sanitize HTML before rendering — strips <script>', () => {
    const safe = Utils.sanitize('<p>Hello <script>alert(1)</script><b>world</b></p>', {});
    const html = safe.toString();
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).toContain('<b>world</b>');
  });

  it('Allow extra tags / attributes', () => {
    const safe = Utils.sanitize('<article data-tag="news">Hi</article>', {
      addTags: ['article'],
      addAttr: ['data-tag'],
    });
    const html = safe.toString();
    expect(html).toContain('<article');
    expect(html).toContain('data-tag="news"');
  });

  it('dom helpers are exposed via @formio/core', () => {
    expect(dom).toBeTruthy();
    expect(typeof dom.appendTo).toBe('function');
    expect(typeof dom.prependTo).toBe('function');
    expect(typeof dom.removeChildFrom).toBe('function');
  });

  it('Manipulate the DOM via @formio/core dom helpers', () => {
    const host = document.createElement('div');
    host.id = 'formio';
    document.body.appendChild(host);

    const banner = document.createElement('div');
    banner.className = 'banner';
    banner.textContent = 'Saved!';
    dom.prependTo(banner, host);
    expect(host.firstElementChild).toBe(banner);

    dom.removeChildFrom(banner, host);
    expect(host.contains(banner)).toBe(false);

    document.body.removeChild(host);
  });
});
