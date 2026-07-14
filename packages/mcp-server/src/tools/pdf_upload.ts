import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FormioConfig } from '../config.js';
import { formioFetch } from '../formio-client.js';
import { toMcpTextResult, toMcpError } from '../mcp-responses.js';
import { cwdSchema, resolveProjectConfig } from '../project-resolver.js';

export function registerPdfUploadTool(server: McpServer, config: FormioConfig) {
  server.tool(
    'pdf_upload',
    "Upload a local PDF template to the Form.io project's PDF server (POST pdf-proxy/upload). The server parses the PDF's AcroForm fields and returns `path`, `file` (the PDF UUID for `settings.pdf`), and `formfields.components` — a RAW auto-converted component skeleton with machine labels and overlay geometry. Do not save that skeleton as-is: follow the formio-form-builder skill's PDF flow to enrich the components (human labels, validations, conditionals from the PDF's own language) before creating the form with form_create.",
    {
      cwd: cwdSchema,
      filePath: z.string().describe('Absolute path to the PDF file on the local filesystem'),
    },
    async ({ cwd, filePath }) => {
      try {
        const cfg = resolveProjectConfig(cwd, config);
        let pdfBytes: Buffer;
        try {
          pdfBytes = await readFile(filePath);
        } catch {
          return toMcpError(new Error(`Cannot read PDF file at ${filePath}`));
        }
        const formData = new FormData();
        formData.set(
          'file',
          new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
          basename(filePath)
        );
        const uploaded = await formioFetch('pdf-proxy/upload', {}, cfg, {
          method: 'POST',
          body: formData,
        });
        return toMcpTextResult(uploaded);
      } catch (error) {
        return toMcpError(error);
      }
    }
  );
}
