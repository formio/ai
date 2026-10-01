// Content contract for the existing-form, PDF template, render, and download lanes.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const refs = join(repoRoot, 'plugin/skills/formio-pdf-form/references');
const read = (name: string) => readFileSync(join(refs, name), 'utf8');

function resolves(doc: string, link: string): boolean {
  return read(doc).includes(link) && existsSync(join(refs, link));
}

describe('existing-form lane', () => {
  const text = () => read('existing-form.md');

  it('scripts both the enrich and the replace-the-PDF variants', () => {
    expect(text()).toMatch(/^## Enrich a saved PDF form/m);
    expect(text()).toMatch(/^## Replace the PDF behind a form/m);
    expect(text()).toContain('`form_get`');
    expect(text()).toContain('`form_update`');
    expect(text()).toContain('`pdf_upload`');
  });

  it('keeps keys by default', () => {
    expect(text()).toMatch(/keys are kept/i);
  });

  it("takes the new conversion's overlays and the new settings.pdf on a replace", () => {
    expect(text()).toMatch(/new conversion's `overlay`/);
    expect(text()).toMatch(/`settings\.pdf` set to the new upload's derived `pdf` object/);
  });

  it('makes the user resolve every unmatched existing component', () => {
    expect(text()).toMatch(/remove it or keep it as `hidden`/);
  });

  it('states that a portal re-upload does not remap overlays', () => {
    expect(text()).toMatch(/portal[^.]*keeps[^.]*old positions/i);
  });
});

describe('PDF template lane', () => {
  const text = () => read('pdf-template.md');

  it('targets only non-PDF forms that carry no settings.pdf', () => {
    expect(text()).toMatch(/`display` is not `pdf`/);
    expect(text()).toMatch(/no `settings\.pdf`/);
  });

  it('writes pdfComponents and leaves components untouched', () => {
    expect(text()).toContain('`pdfComponents`');
    expect(text()).toMatch(/`components` untouched/);
  });

  it('applies the skip-list and the data-component rule', () => {
    for (const type of ['button', 'hidden', 'recaptcha', 'datasource']) {
      expect(text()).toContain(`\`${type}\``);
    }
    for (const type of ['tree', 'editgrid', 'datatable', 'datagrid', 'container']) {
      expect(text()).toContain(`\`${type}\``);
    }
  });

  it('prunes each reference to the eight properties, and says why', () => {
    for (const prop of [
      'key',
      'type',
      'label',
      'labelPosition',
      'hideLabel',
      'labelWidth',
      'labelMargin',
      'components',
    ]) {
      expect(text()).toContain(`\`${prop}\``);
    }
    expect(text()).toMatch(/from the live component of the same key/);
  });

  it('says a saved template changes every download immediately, and how to preview', () => {
    expect(text()).toMatch(/every PDF download of the form immediately/);
    expect(text()).toContain('format=html');
  });
});

describe('render lane', () => {
  const text = () => read('render.md');

  it('links formio-form for mounting', () => {
    expect(resolves('render.md', '../../formio-form/references/rendering.md')).toBe(true);
  });

  it('documents the iframe, zoom, readOnly, the submit button, and the message origin', () => {
    expect(text()).toMatch(/`settings\.pdf\.src` with `\.html` appended/);
    expect(text()).toContain('`zoom`');
    expect(text()).toContain('`readOnly`');
    expect(text()).toMatch(/its own submit button/);
    expect(text()).toMatch(/only from its own iframe/);
    expect(text()).toMatch(/`hidden`/);
  });
});

describe('download lane', () => {
  const text = () => read('download.md');

  it('frames the download as runtime work in the application', () => {
    expect(text()).toMatch(/at runtime/);
    expect(text()).toMatch(/not a build-time/i);
  });

  it('links the SDK and the API reference instead of restating them', () => {
    expect(resolves('download.md', '../../formio-sdk/references/submissions.md')).toBe(true);
    expect(resolves('download.md', '../../formio-api/references/pdf-api.md')).toBe(true);
  });

  it('names the query parameters as the server reads them', () => {
    for (const param of ['margin', 'pageSize', 'orientation', 'language', 'format']) {
      expect(text()).toContain(`\`${param}\``);
    }
  });

  it('treats the token as a per-request credential', () => {
    expect(text()).toMatch(/mint[^.]*per request/i);
    expect(text()).toMatch(/never store/i);
  });
});
