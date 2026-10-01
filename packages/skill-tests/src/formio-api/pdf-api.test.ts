// pdf-api.md and the schema references must describe the PDF routes and shapes a
// deployment actually serves: the routes below were each checked against one.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const skillsRoot = join(repoRoot, 'plugin/skills');
const read = (rel: string) => readFileSync(join(skillsRoot, rel), 'utf8');

function markdown(dir = skillsRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

describe('PDF routes across the skills', () => {
  it.each(['pdf-proxy/upload', 'pdf-proxy/form', 'pdf-proxy/token'])(
    'no skill document names the unrouted %s',
    (route) => {
      const offenders = markdown().filter((path) => readFileSync(path, 'utf8').includes(route));
      expect(offenders).toEqual([]);
    }
  );
});

describe('pdf-api.md', () => {
  const doc = () => read('formio-api/references/pdf-api.md');

  it('documents the working project routes and the conversion flag', () => {
    for (const token of [
      '{projectUrl}/upload',
      '{projectUrl}/token',
      'nonFillableConversionUsed',
    ]) {
      expect(doc()).toContain(token);
    }
  });

  it('names the download parameters as the server reads them', () => {
    expect(doc()).toContain('`margin`');
    expect(doc()).not.toContain('`margins`');
  });

  it('never points settings.pdf.src at the PDF server itself', () => {
    expect(doc()).not.toContain('https://pdf.form.io');
  });

  it('names pdf_upload in its MCP Tool Preference', () => {
    const section = doc().slice(
      doc().indexOf('## MCP Tool Preference'),
      doc().indexOf('## Endpoints')
    );
    expect(section).toContain('`pdf_upload`');
  });

  it('describes the non-PDF and missing-file errors as the server returns them', () => {
    expect(doc()).toMatch(/`500`[^.]*HTML/);
  });
});

describe('formio-api router', () => {
  it('does not root the PDF scope at /pdf-proxy', () => {
    expect(read('formio-api/SKILL.md')).not.toMatch(/PDF scope — `\{projectUrl\}\/pdf-proxy\/`/);
  });
});

describe('formio-schema PDF shapes', () => {
  it('documents overlay with its page', () => {
    const base = read('formio-schema/references/form/base-component.md');
    expect(base).toMatch(/`overlay`[^\n]*`page`/);
    expect(base).toContain('`formio-pdf-form`');
  });

  it('documents settings.pdf and the pdfComponents template contract', () => {
    const def = read('formio-schema/references/form/form-definition.md');
    expect(def).toContain('`pdfComponents`');
    for (const prop of ['labelPosition', 'hideLabel', 'labelWidth', 'labelMargin']) {
      expect(def).toContain(`\`${prop}\``);
    }
    expect(def).toMatch(/`pdf_upload`/);
  });
});
