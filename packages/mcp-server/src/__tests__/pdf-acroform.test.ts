import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { readAcroformFields, type AcroformField } from '../pdf/acroform.js';

const fixture = (name: string) => new URL(`./fixtures/pdf/${name}`, import.meta.url);

// A hand-built AcroForm PDF and the conversion a live PDF server returned for it
// (a local Enterprise deployment, 1 October 2026): the keys below are the server's, not ours.
const FILLABLE = new Uint8Array(readFileSync(fixture('acroform-fillable.pdf')));
const CONVERSION = JSON.parse(readFileSync(fixture('acroform-fillable.conversion.json'), 'utf8'));
const COMPONENTS = CONVERSION.formfields.components;

function fieldsOf(report: Awaited<ReturnType<typeof readAcroformFields>>): AcroformField[] {
  if (report.acroform === null) {
    throw new Error(`expected fields, got error: ${report.acroformError}`);
  }
  return report.acroform.fields;
}

async function pdfWithTextField(name: string, tooltip?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const field = doc.getForm().createTextField(name);
  field.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
  if (tooltip) {
    field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(tooltip));
  }
  return doc.save();
}

// pdf-lib writes no encryption, so the encrypted case is assembled by hand: a
// one-page document whose trailer names an /Encrypt dictionary.
function encryptedPdf(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    '<< /Filter /Standard /V 1 /R 2 /O (x) /U (y) /P -4 >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R /ID [(a) (a)] >>\n`;
  body += `startxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

describe('readAcroformFields', () => {
  it('recovers tooltip and required flag and maps the field to its server key', async () => {
    const fields = fieldsOf(await readAcroformFields({ bytes: FILLABLE, components: COMPONENTS }));

    expect(fields.find((field) => field.name === 'f1_01[0]')).toEqual({
      name: 'f1_01[0]',
      tooltip: 'First name',
      required: true,
      readOnly: false,
      componentKeys: ['f1010'],
    });
    expect(fields.find((field) => field.name === 'f1_02[0]')).toMatchObject({
      tooltip: null,
      required: false,
      componentKeys: ['f1020'],
    });
    expect(fields.find((field) => field.name === 'state')).toMatchObject({
      tooltip: 'State of residence',
      componentKeys: ['state'],
    });
  });

  it('maps a radio group to the component of every widget', async () => {
    const fields = fieldsOf(await readAcroformFields({ bytes: FILLABLE, components: COMPONENTS }));

    expect(fields.find((field) => field.name === 'contactPref')).toMatchObject({
      tooltip: 'Contact preference',
      componentKeys: ['contactPref', 'contactPref_1'],
    });
  });

  it('every field the server converted is accounted for', async () => {
    const fields = fieldsOf(await readAcroformFields({ bytes: FILLABLE, components: COMPONENTS }));

    expect(fields.flatMap((field) => field.componentKeys).sort()).toEqual(
      COMPONENTS.map((component: { key: string }) => component.key).sort()
    );
  });

  it('keys a nested field by its partial name, as the server does', async () => {
    const bytes = await pdfWithTextField('topmostSubform[0].Page1[0].f1_01[0]', 'Last name');
    const fields = fieldsOf(await readAcroformFields({ bytes, components: [{ key: 'f1010' }] }));

    expect(fields).toEqual([
      {
        name: 'topmostSubform[0].Page1[0].f1_01[0]',
        tooltip: 'Last name',
        required: false,
        readOnly: false,
        componentKeys: ['f1010'],
      },
    ]);
  });

  it('prefixes a key that starts with a digit', async () => {
    const bytes = await pdfWithTextField('1stName');
    const fields = fieldsOf(await readAcroformFields({ bytes, components: [{ key: '_1stName' }] }));

    expect(fields[0].componentKeys).toEqual(['_1stName']);
  });

  it('returns no keys for a field the conversion did not return', async () => {
    const bytes = await pdfWithTextField('orphan');
    const fields = fieldsOf(await readAcroformFields({ bytes, components: [] }));

    expect(fields[0].componentKeys).toEqual([]);
  });

  it('carries no geometry', async () => {
    const fields = fieldsOf(await readAcroformFields({ bytes: FILLABLE, components: COMPONENTS }));

    for (const field of fields) {
      expect(Object.keys(field).sort()).toEqual(
        ['componentKeys', 'name', 'readOnly', 'required', 'tooltip'].sort()
      );
    }
  });

  it('reports an encrypted document instead of reading ciphertext', async () => {
    const report = await readAcroformFields({ bytes: encryptedPdf(), components: [] });

    expect(report.acroform).toBeNull();
    expect('acroformError' in report && report.acroformError).toMatch(/encrypted/i);
  });

  it('reports a document it cannot parse instead of throwing', async () => {
    const report = await readAcroformFields({
      bytes: new TextEncoder().encode('%PDF-1.7 truncated'),
      components: [],
    });

    expect(report.acroform).toBeNull();
    expect('acroformError' in report && report.acroformError).toBeTruthy();
  });
});
