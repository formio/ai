import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpStructuredResult, toMcpError } from '../mcp-responses.js';
import { pdfUploadShape } from '../output-schemas.js';
import { creates } from '../tool-annotations.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';
import { readAcroformFields } from '../pdf/acroform.js';
import { derivePdfSettings, type UploadResponse } from '../pdf/pdf-settings.js';

// A PDF may carry bytes before its header; readers accept one within the first KB.
function hasPdfHeader(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, 1024)).includes('%PDF-');
}

export function registerPdfUploadTool(server: McpServer, config: FormioConfig) {
  server.registerTool(
    'pdf_upload',
    {
      description:
        "Upload a local PDF to the PDF server of the Form.io project mapped to the user's current working directory. Returns the server's response verbatim — `path`, `file`, and `formfields.components`, the fields it converted from the PDF with their overlay positions — plus `pdf`, the exact value for the form's `settings.pdf`, and `acroform`, each AcroForm field's tooltip and required/read-only flags keyed to those components. The converted components are a raw skeleton with machine labels: follow the formio-pdf-form skill to enrich them (labels, validation, conditionals) and get approval before creating the form with form_create. Never edit the overlays.",
      inputSchema: {
        cwd: cwdSchema,
        filePath: z.string().describe('Absolute path to the PDF file on the local filesystem'),
      },
      outputSchema: pdfUploadShape,
      annotations: creates('Upload a PDF'),
    },
    async ({ cwd, filePath }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        let bytes: Uint8Array<ArrayBuffer>;
        try {
          bytes = new Uint8Array(await readFile(filePath));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          return toMcpError(new Error(`Cannot read the PDF at ${filePath}: ${reason}`));
        }
        if (!hasPdfHeader(bytes)) {
          return toMcpError(new Error(`${filePath} is not a PDF: it has no %PDF- header.`));
        }

        const body = new FormData();
        body.set('file', new Blob([bytes], { type: 'application/pdf' }), basename(filePath));
        const response = (await formioFetch('upload', {}, cfg, {
          method: 'POST',
          body,
        })) as UploadResponse & { formfields?: { components?: Array<{ key?: unknown }> } };

        const report = await readAcroformFields({
          bytes,
          components: response.formfields?.components ?? [],
        });
        return toMcpStructuredResult({
          ...response,
          pdf: derivePdfSettings({ projectUrl: cfg.projectUrl, response }),
          ...report,
        });
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
