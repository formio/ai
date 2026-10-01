import camelCase from 'lodash/camelCase.js';
import {
  AcroFieldFlags,
  PDFAcroTerminal,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
} from 'pdf-lib';

export interface AcroformField {
  name: string;
  tooltip: string | null;
  required: boolean;
  readOnly: boolean;
  componentKeys: string[];
}

export type AcroformReport =
  { acroform: { fields: AcroformField[] } } | { acroform: null; acroformError: string };

// The PDF server's key for a widget: its terminal field's partial name, camel-cased
// with lodash and kept from starting with a digit (`component.js` on nirvana main).
function serverKey(partialName: string): string {
  const key = camelCase(partialName);
  return /^\d/.test(partialName) ? `_${key}` : key;
}

function tooltipOf(field: PDFAcroTerminal): string | null {
  const tooltip = field.dict.lookup(PDFName.of('TU'));
  return tooltip instanceof PDFString || tooltip instanceof PDFHexString
    ? tooltip.decodeText() || null
    : null;
}

// Widgets in the order the server's extractor visits them: page by page, each page's
// /Annots in order. Repeated keys are numbered in that order (`converter.js`).
function widgetOwnersInPageOrder(
  doc: PDFDocument,
  terminals: PDFAcroTerminal[]
): PDFAcroTerminal[] {
  const ownerOf = new Map<PDFDict, PDFAcroTerminal>(
    terminals.flatMap((field) => field.getWidgets().map((widget) => [widget.dict, field] as const))
  );
  return doc.getPages().flatMap((page) => {
    const annots = page.node.Annots();
    if (!(annots instanceof PDFArray)) return [];
    return Array.from({ length: annots.size() }, (_, index) => annots.lookup(index))
      .filter((annot): annot is PDFDict => annot instanceof PDFDict)
      .flatMap((annot) => {
        const owner = ownerOf.get(annot);
        return owner ? [owner] : [];
      });
  });
}

function keysByField(widgets: PDFAcroTerminal[]): Map<PDFAcroTerminal, string[]> {
  const seen = new Map<string, number>();
  const keys = new Map<PDFAcroTerminal, string[]>();
  for (const field of widgets) {
    const base = serverKey(field.getPartialName() ?? '');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    keys.set(field, [...(keys.get(field) ?? []), count === 0 ? base : `${base}_${count}`]);
  }
  return keys;
}

function fieldsOf(doc: PDFDocument, components: ReadonlyArray<{ key?: unknown }>): AcroformField[] {
  // The catalog's AcroForm rather than doc.getForm(), which strips XFA from hybrids.
  const terminals = (doc.catalog.getAcroForm()?.getAllFields() ?? [])
    .map(([field]) => field)
    .filter((field): field is PDFAcroTerminal => field instanceof PDFAcroTerminal);
  const derived = keysByField(widgetOwnersInPageOrder(doc, terminals));
  const returned = new Set(components.map((component) => component.key));

  return terminals.map((field) => ({
    name: field.getFullyQualifiedName() ?? field.getPartialName() ?? '',
    tooltip: tooltipOf(field),
    required: field.hasFlag(AcroFieldFlags.Required),
    readOnly: field.hasFlag(AcroFieldFlags.ReadOnly),
    componentKeys: (derived.get(field) ?? []).filter((key) => returned.has(key)),
  }));
}

/**
 * Each AcroForm field's tooltip and flags, tied to the conversion components the
 * PDF server produced for it. Released PDF servers drop both, so this is how a
 * label and a required flag survive the upload. Positions are deliberately not
 * reported: overlays come from the server's conversion only.
 */
export async function readAcroformFields({
  bytes,
  components,
}: {
  bytes: Uint8Array;
  components: ReadonlyArray<{ key?: unknown }>;
}): Promise<AcroformReport> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    // pdf-lib does not decrypt strings, so an encrypted document's tooltips would be
    // ciphertext.
    if (doc.isEncrypted) {
      return {
        acroform: null,
        acroformError: 'The PDF is encrypted; its form fields were not read.',
      };
    }
    return { acroform: { fields: fieldsOf(doc, components) } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { acroform: null, acroformError: `Could not read the PDF's form fields: ${reason}` };
  }
}
