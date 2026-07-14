import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestClient, TEST_CONFIG, TEST_CWD } from './test-helpers.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', () => ({
  formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
}));

const { registerPdfUploadTool } = await import('../tools/pdf_upload.js');

const tempDir = mkdtempSync(join(tmpdir(), 'pdf-upload-test-'));
const pdfPath = join(tempDir, 'template.pdf');
writeFileSync(pdfPath, '%PDF-1.7 test fixture');

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const UPLOAD_RESPONSE = {
  path: '/pdf/69d65f4e040fa2cea257224d/file/7b45f38b-dc26-5b1d-aa33-947522157c57',
  file: '7b45f38b-dc26-5b1d-aa33-947522157c57',
  formfields: {
    components: [
      {
        type: 'textfield',
        key: 'f1010',
        label: 'f1_01[0]',
        overlay: { width: 317.28, height: 24.92, top: 167.3 },
      },
    ],
  },
};

describe('pdf_upload tool', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('is listed in available tools with an enrichment-referencing description', async () => {
    const { client } = await createTestClient(registerPdfUploadTool);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'pdf_upload');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('formio-form-builder');
    expect(tool!.description).toMatch(/enrich/i);
    expect(tool!.inputSchema.required).toEqual(expect.arrayContaining(['cwd', 'filePath']));
  });

  it('sends the PDF as a multipart file part to POST pdf-proxy/upload', async () => {
    mockFormioFetch.mockResolvedValue(UPLOAD_RESPONSE);
    const { client } = await createTestClient(registerPdfUploadTool);

    await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: pdfPath },
    });

    expect(mockFormioFetch).toHaveBeenCalledTimes(1);
    const [path, params, cfg, options] = mockFormioFetch.mock.calls[0] as [
      string,
      Record<string, string>,
      typeof TEST_CONFIG,
      { method: string; body: FormData },
    ];
    expect(path).toBe('pdf-proxy/upload');
    expect(params).toEqual({});
    expect(cfg).toEqual(TEST_CONFIG);
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    const filePart = options.body.get('file');
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as File).name).toBe('template.pdf');
    expect(await (filePart as File).text()).toBe('%PDF-1.7 test fixture');
  });

  it('returns the conversion response verbatim, overlay values included', async () => {
    mockFormioFetch.mockResolvedValue(UPLOAD_RESPONSE);
    const { client } = await createTestClient(registerPdfUploadTool);

    const result = await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: pdfPath },
    });

    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(UPLOAD_RESPONSE, null, 2) },
    ]);
  });

  it('returns an MCP error naming the path for a missing file, without any HTTP request', async () => {
    const { client } = await createTestClient(registerPdfUploadTool);
    const missingPath = join(tempDir, 'does-not-exist.pdf');

    const result = await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: missingPath },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining(missingPath) }),
    ]);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('returns isError true on API error with status and URL from the client layer', async () => {
    mockFormioFetch.mockRejectedValue(
      new Error('Form.io API error: 400 | URL: https://form.local/example/pdf-proxy/upload')
    );
    const { client } = await createTestClient(registerPdfUploadTool);

    const result = await client.callTool({
      name: 'pdf_upload',
      arguments: { cwd: TEST_CWD, filePath: pdfPath },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringContaining('400') }),
    ]);
  });
});
