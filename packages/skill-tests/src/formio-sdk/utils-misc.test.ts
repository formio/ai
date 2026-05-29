// @ts-nocheck — see utils-evaluator.test.ts for rationale.
// Mirrors every example in
// `plugin/skills/formio-sdk/references/utils-misc.md`.

import { beforeAll, describe, expect, it } from 'vitest';
import { Utils } from '@formio/js/utils';
import { I18n, unwind, override } from '@formio/core';
import { Formio } from '@formio/js';

beforeAll(() => {
  Formio.setBaseUrl('https://forms.mysite.com');
  Formio.setProjectUrl('https://forms.mysite.com/myproject');
});

describe('utils-misc.md examples', () => {
  it('Utils.fastCloneDeep clones nested submission data', () => {
    expect(typeof Utils.fastCloneDeep).toBe('function');
    const submission = { data: { firstName: 'Ada' } };
    const draft = Utils.fastCloneDeep(submission) as typeof submission;
    expect(draft).not.toBe(submission);
    expect(draft.data.firstName).toBe('Ada');
    draft.data.firstName = 'Edited';
    expect(submission.data.firstName).toBe('Ada');
  });

  it("Formio.getToken({ decode: true }) decodes the SDK's cached JWT", async () => {
    // {"sub":"abc","name":"Ada","exp":9999999999} — unsigned test payload.
    // setToken always tries to fetch /current to populate the cached user;
    // that fetch fails offline, but the token cache mutation runs first.
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMiLCJuYW1lIjoiQWRhIiwiZXhwIjo5OTk5OTk5OTk5fQ.sig';
    await Formio.setToken(token).catch(() => undefined);
    const claims = Formio.getToken({ decode: true }) as Record<string, unknown>;
    expect(claims).toBeTruthy();
    expect(claims.sub).toBe('abc');
    expect(claims.name).toBe('Ada');
    await Formio.setToken(null).catch(() => undefined);
  });

  it('Utils.convertFormatToMoment translates Angular date tokens', () => {
    const momentFormat = Utils.convertFormatToMoment('MM/dd/yyyy h:mm a');
    expect(momentFormat).toBe('MM/DD/YYYY h:mm A');
  });

  it('Utils.moment + Utils.currentTimezone format the current time', () => {
    expect(typeof Utils.moment).toBe('function');
    expect(typeof Utils.currentTimezone).toBe('function');
    const tz = Utils.currentTimezone();
    expect(typeof tz).toBe('string');
    const out = Utils.moment().tz(tz).format('YYYY-MM-DD HH:mm');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('I18n switches language at runtime (from @formio/core)', () => {
    expect(typeof I18n).toBe('function');
    const i18n = new I18n();
    i18n.setLanguages({
      en: { hello: 'Hello' },
      fr: { hello: 'Bonjour' },
    });
    i18n.changeLanguage('fr');
    expect(i18n.t('hello')).toBe('Bonjour');
  });

  it('unwind explodes a submission with a datagrid (from @formio/core)', () => {
    expect(typeof unwind).toBe('function');
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
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('override replaces a method on a class prototype (from @formio/core)', () => {
    expect(typeof override).toBe('function');
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
    expect(new TextFieldStub().getValue()).toBe('raw');
  });
});
