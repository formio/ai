import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerPdfUploadTool } = await import('../tools/pdf_upload.js');

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/pdf/${name}`, import.meta.url));
const CONVERSION = JSON.parse(readFileSync(fixture('acroform-fillable.conversion.json'), 'utf8'));

function tempFile(name: string, contents?: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'pdf-upload-')), name);
  if (contents === undefined) {
    copyFileSync(fixture('acroform-fillable.pdf'), path);
  } else {
    writeFileSync(path, contents);
  }
  return path;
}

type Result = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: Record<string, unknown>;
};

describe('pdf_upload tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed with a required filePath, the standard cwd, and a description naming its skill', async () => {
    const { client } = await createTestClient(registerPdfUploadTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'pdf_upload');

    expect(tool).toBeDefined();
    expect(tool!.description).toContain('formio-pdf-form');
    expect(tool!.description).toContain('settings.pdf');
    expect(tool!.inputSchema.required).toEqual(['filePath']);
    expect(Object.keys(tool!.inputSchema.properties ?? {})).toEqual(['cwd', 'filePath']);
  });

  it('posts the file multipart to the project upload route', async () => {
    mockFormioFetch.mockResolvedValue(CONVERSION);
    const { client } = await createTestClient(registerPdfUploadTool);
    const filePath = tempFile('w4.pdf');

    await client.callTool({ name: 'pdf_upload', arguments: { cwd: TEST_CWD, filePath } });

    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    const [path, params, cfg, options] = mockFormioFetch.mock.calls[0];
    expect(path).toBe('upload');
    expect(params).toEqual({});
    expect(cfg).toEqual(TEST_CONFIG);
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    const part = (options.body as FormData).get('file') as File;
    expect(part.name).toBe('w4.pdf');
    expect(part.type).toBe('application/pdf');
    expect(part.size).toBe(statSync(filePath).size);
  });

  it('returns the response verbatim with the derived pdf settings and the acroform report', async () => {
    mockFormioFetch.mockResolvedValue(CONVERSION);
    const { client } = await createTestClient(registerPdfUploadTool);

    const result = (await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: tempFile('w4.pdf') },
    })) as Result;

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent!;
    expect(structured.path).toBe(CONVERSION.path);
    expect(structured.file).toBe(CONVERSION.file);
    expect(structured.formfields).toEqual(CONVERSION.formfields);
    expect(structured.pdf).toEqual({
      id: CONVERSION.file,
      src: `https://formio.invalid/pdf-proxy${CONVERSION.path}`,
    });
    const acroform = structured.acroform as { fields: { name: string; tooltip: string | null }[] };
    expect(acroform.fields.find((field) => field.name === 'f1_01[0]')?.tooltip).toBe('First name');
  });

  it('refuses a missing file without any request', async () => {
    const { client } = await createTestClient(registerPdfUploadTool);
    const filePath = join(tmpdir(), 'definitely-missing-upload.pdf');

    const result = (await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath },
    })) as Result;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(filePath);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a PDF without any request', async () => {
    const { client } = await createTestClient(registerPdfUploadTool);

    const result = (await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: tempFile('notes.pdf', 'not a pdf') },
    })) as Result;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not a PDF/);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('relays a server refusal as an MCP error', async () => {
    mockFormioFetch.mockRejectedValue(
      new Error('Form.io API error: 400 | URL: https://formio.invalid/sub/example/upload')
    );
    const { client } = await createTestClient(registerPdfUploadTool);

    const result = (await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: tempFile('w4.pdf') },
    })) as Result;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('400');
    expect(result.content[0].text).toContain('/upload');
  });
});

describe('the PDF upload route', () => {
  it('no server source names the unrouted pdf-proxy/upload path', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
        return entry.name.endsWith('.ts') ? [full] : [];
      });

    const offenders = sources(root).filter((file) =>
      readFileSync(file, 'utf8').includes('pdf-proxy/upload')
    );
    expect(offenders).toEqual([]);
  });
});
