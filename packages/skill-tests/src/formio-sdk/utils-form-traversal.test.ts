// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-form-traversal.md` against a
// synthetic Form.io form definition. Pure logic — no network, no DOM.

import { describe, expect, it } from 'vitest';
import { Utils } from '@formio/js/utils';

const form = {
  display: 'form',
  components: [
    { type: 'textfield', key: 'firstName', label: 'First Name', input: true },
    {
      type: 'email',
      key: 'email',
      label: 'Email',
      input: true,
      validate: { required: true },
    },
    {
      type: 'container',
      key: 'address',
      input: true,
      components: [
        {
          type: 'textfield',
          key: 'line1',
          label: 'Line 1',
          input: true,
          validate: { required: true },
        },
        { type: 'textfield', key: 'city', label: 'City', input: true },
      ],
    },
    {
      type: 'panel',
      key: 'hiddenPanel',
      hidden: true,
      components: [{ type: 'textfield', key: 'secret', label: 'Secret', input: true }],
    },
    { type: 'select', key: 'country', label: 'Country', input: true, data: {} },
  ],
};

const submission = {
  data: {
    firstName: 'Ada',
    email: 'ada@example.com',
    address: { line1: '1 Park Ave', city: 'NYC' },
    secret: 'should-not-see',
    country: 'US',
  },
};

describe('utils-form-traversal.md examples', () => {
  it('Walk every component', () => {
    const seen: string[] = [];
    Utils.eachComponent(form.components, (component, path) => {
      seen.push(`${path}:${component.type}`);
    });
    expect(seen).toEqual(
      expect.arrayContaining([
        'firstName:textfield',
        'email:email',
        'address:container',
        'address.line1:textfield',
        'address.city:textfield',
        'country:select',
      ])
    );
  });

  it('Walk components alongside their data', () => {
    const collected: Record<string, unknown> = {};
    Utils.eachComponentData(form.components, submission.data, (component, _data, row) => {
      if (component.input) {
        collected[component.key] = (row as Record<string, unknown>)[component.key];
      }
    });
    expect(collected.firstName).toBe('Ada');
    expect(collected.email).toBe('ada@example.com');
    expect(collected.line1).toBe('1 Park Ave');
  });

  it('Find a component by key', () => {
    const email = Utils.getComponent(form.components, 'email');
    expect(email).toBeTruthy();
    expect(email?.type).toBe('email');
    if (email) email.label = 'Work Email';
    expect(Utils.getComponent(form.components, 'email')?.label).toBe('Work Email');
  });

  it('Query components by attribute', () => {
    const required = Utils.searchComponents(form.components, {
      'validate.required': true,
    });
    const keys = required.map((c) => c.key).sort();
    expect(keys).toEqual(['email', 'line1']);
  });

  it('Flatten to a path map', () => {
    const map = Utils.flattenComponents(form.components);
    const keys = Object.keys(map);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toEqual(expect.arrayContaining(['firstName', 'email']));
  });

  it('Read a value at a deep path', () => {
    const value = Utils.getComponentValue(form, submission.data, 'address.line1');
    expect(value).toBe('1 Park Ave');
  });

  it('Async traversal with side effects', async () => {
    const visited: string[] = [];
    await Utils.eachComponentAsync(form.components, async (component) => {
      visited.push(component.key);
    });
    expect(visited).toEqual(expect.arrayContaining(['firstName', 'email', 'country']));
  });

  it('Stop descent into hidden containers (includeAll + return true)', () => {
    const reached: string[] = [];
    Utils.eachComponent(
      form.components,
      (component) => {
        reached.push(component.key);
        if (component.hidden) return true;
        return undefined;
      },
      true
    );
    // The hidden panel itself is visited, but its children are not.
    expect(reached).toContain('hiddenPanel');
    expect(reached).not.toContain('secret');
  });
});
