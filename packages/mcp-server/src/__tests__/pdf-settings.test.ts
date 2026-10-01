import { describe, expect, it } from 'vitest';
import { derivePdfSettings } from '../pdf/pdf-settings.js';

const response = { path: '/pdf/p1/file/f1', file: 'f1' };

describe('derivePdfSettings', () => {
  it('uses the Project URL origin plus /pdf-proxy for a hosted project', () => {
    expect(derivePdfSettings({ projectUrl: 'https://examples.form.io', response })).toEqual({
      id: 'f1',
      src: 'https://examples.form.io/pdf-proxy/pdf/p1/file/f1',
    });
  });

  it('drops the project path segment for a sub-directory deployment', () => {
    expect(
      derivePdfSettings({ projectUrl: 'https://forms.mysite.com/myproject', response }).src
    ).toBe('https://forms.mysite.com/pdf-proxy/pdf/p1/file/f1');
  });

  it('prefers a files server named by the response', () => {
    expect(
      derivePdfSettings({
        projectUrl: 'https://forms.mysite.com/myproject',
        response: { ...response, filesServer: 'https://files.mysite.com' },
      }).src
    ).toBe('https://files.mysite.com/pdf/p1/file/f1');
  });
});
