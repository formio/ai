import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEST_CONFIG } from './test-helpers.js';
import { ToolError } from '../tool-errors.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { saveDraft, publishDraft } = await import('../revisions/flows.js');

const FORM_ID = '67890abcdef012345678abcd';

describe('saveDraft', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  // An empty draft is never written by accident: a body carrying none of the
  // fields a draft holds would stage nothing but the note.
  it('refuses a body with none of the draft fields as INVALID_ARGUMENT, writing nothing', async () => {
    const attempt = saveDraft({
      formId: FORM_ID,
      form: { _id: FORM_ID, title: 'Renamed', path: 'renamed' },
      _vnote: 'n',
      cfg: TEST_CONFIG,
    });

    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(attempt).rejects.toThrow(/components/);
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });
});

describe('publishDraft', () => {
  beforeEach(() => {
    mockFormioFetch.mockReset();
  });

  it('refuses with NO_DRAFT when the draft route falls back to the live form', async () => {
    mockFormioFetch.mockResolvedValue({ _id: FORM_ID, _vid: 2 });

    await expect(
      publishDraft({ formId: FORM_ID, _vnote: 'n', cfg: TEST_CONFIG })
    ).rejects.toMatchObject({ code: 'NO_DRAFT' });
  });
});
