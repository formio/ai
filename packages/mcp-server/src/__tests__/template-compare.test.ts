import { describe, expect, it } from 'vitest';
import { compareTemplates } from '../project-versions/template-compare.js';

const form = (overrides: Record<string, unknown> = {}) => ({
  title: 'Order',
  name: 'order',
  path: 'order',
  components: [{ type: 'textfield', key: 'item' }],
  ...overrides,
});

describe('compareTemplates', () => {
  it('reports nothing for identical templates', () => {
    const template = { roles: { admin: { title: 'Admin' } }, forms: { order: form() } };
    expect(compareTemplates({ current: template, tagged: template })).toEqual({
      roles: { added: [], removed: [], changed: [] },
      resources: { added: [], removed: [], changed: [] },
      forms: { added: [], removed: [], changed: [] },
      actions: { added: [], removed: [], changed: [] },
    });
  });

  it('reports added, removed, and changed entities by machine name', () => {
    const tagged = {
      forms: { order: form(), invoice: form({ name: 'invoice', path: 'invoice' }) },
      resources: { user: { title: 'User', name: 'user', components: [] } },
    };
    const current = {
      forms: {
        order: form({
          components: [
            { type: 'textfield', key: 'item' },
            { type: 'number', key: 'qty' },
          ],
        }),
        vendor: form({ name: 'vendor', path: 'vendor' }),
      },
      resources: { user: { title: 'User', name: 'user', components: [] } },
    };

    const result = compareTemplates({ current, tagged });

    expect(result.forms).toEqual({ added: ['vendor'], removed: ['invoice'], changed: ['order'] });
    expect(result.resources).toEqual({ added: [], removed: [], changed: [] });
  });

  it('ignores key order', () => {
    const tagged = { roles: { admin: { title: 'Admin', admin: true } } };
    const current = { roles: { admin: { admin: true, title: 'Admin' } } };
    expect(compareTemplates({ current, tagged }).roles.changed).toEqual([]);
  });

  it('compares actions by their template key', () => {
    const tagged = { actions: { 'order:save': { name: 'save', form: 'order', priority: 10 } } };
    const current = {
      actions: {
        'order:save': { name: 'save', form: 'order', priority: 11 },
        'order:email': { name: 'email', form: 'order' },
      },
    };
    expect(compareTemplates({ current, tagged }).actions).toEqual({
      added: ['order:email'],
      removed: [],
      changed: ['order:save'],
    });
  });

  it('treats a missing section as empty', () => {
    expect(compareTemplates({ current: { roles: { a: {} } }, tagged: {} }).roles.added).toEqual([
      'a',
    ]);
  });
});
