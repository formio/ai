import { randomUUID } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResolvedFormioConfig } from '../config.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const { checkRevisionsLicensed, gateRevisionsLicense, requireRevisionsLicense } =
  await import('../revisions/license.js');
const { gateFormHistory } = await import('../revisions/history.js');
const { prefixVnote, stripRevisions } = await import('../revisions/helpers.js');

const cfgFor = (baseUrl: string): ResolvedFormioConfig => ({
  baseUrl,
  projectUrl: `${baseUrl}/proj`,
  apiKey: 'k',
});

const stubLicensed = (licensed: boolean) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`sac = ${licensed}`),
    })
  );

const uniqueBaseUrl = () => `https://license-${randomUUID()}.local`;
const FORM_ID = '67890abcdef012345678abcd';

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('checkRevisionsLicensed', () => {
  it('returns true when /config.js contains sac = true', async () => {
    stubLicensed(true);
    expect(await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()))).toBe(true);
  });

  it('returns false when /config.js reports sac = false', async () => {
    stubLicensed(false);
    expect(await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()))).toBe(false);
  });

  it('returns false when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()))).toBe(false);
  });

  it('caches per baseUrl — second call does not refetch', async () => {
    const baseUrl = uniqueBaseUrl();
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('sac = true') });
    vi.stubGlobal('fetch', fetchSpy);
    await checkRevisionsLicensed(cfgFor(baseUrl));
    await checkRevisionsLicensed(cfgFor(baseUrl));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('requireRevisionsLicense', () => {
  it('refuses with LICENSE_REQUIRED on an unlicensed deployment', async () => {
    stubLicensed(false);

    const attempt = requireRevisionsLicense(cfgFor(uniqueBaseUrl()), 'save a draft of this form');
    await expect(attempt).rejects.toMatchObject({ code: 'LICENSE_REQUIRED' });
    await expect(attempt).rejects.toThrow(/Security Module/);
  });

  it('passes on a licensed deployment', async () => {
    stubLicensed(true);

    await expect(
      requireRevisionsLicense(cfgFor(uniqueBaseUrl()), 'publish this form')
    ).resolves.toBeUndefined();
  });
});

describe('gateRevisionsLicense', () => {
  it('refuses with HISTORY_NOT_ACCEPTED when unlicensed and the caller has not accepted', async () => {
    stubLicensed(false);

    const attempt = gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form: { components: [] },
    });
    await expect(attempt).rejects.toMatchObject({ code: 'HISTORY_NOT_ACCEPTED' });
    await expect(attempt).rejects.toThrow(/acceptNoHistory: true/);
  });

  it('strips revisions when unlicensed and the caller accepted saving without history', async () => {
    stubLicensed(false);

    const result = await gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form: { revisions: 'original', components: [] },
      acceptNoHistory: true,
    });
    expect(result.licensed).toBe(false);
    expect(result.form).toEqual({ components: [] });
  });

  it('refuses with HISTORY_NOT_ACCEPTED when licensed and the body sets revisions to ""', async () => {
    stubLicensed(true);

    const attempt = gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form: { revisions: '', components: [] },
    });
    await expect(attempt).rejects.toMatchObject({ code: 'HISTORY_NOT_ACCEPTED' });
  });

  it('passes a body setting revisions to "" through when licensed and accepted', async () => {
    stubLicensed(true);

    const form = { revisions: '', components: [] };
    const result = await gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form,
      acceptNoHistory: true,
    });
    expect(result).toEqual({ licensed: true, form });
  });

  it('passes through unchanged when licensed', async () => {
    stubLicensed(true);

    const form = { revisions: 'original' as const, components: [] };
    const result = await gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form,
    });
    expect(result.licensed).toBe(true);
    expect(result.form).toBe(form);
  });
});

describe('gateFormHistory', () => {
  const cfg = cfgFor('https://tracking.local');

  it.each(['original', 'current'] as const)(
    'does not read the stored form when the caller enables revisions: "%s"',
    async (mode) => {
      await gateFormHistory({ cfg, formId: FORM_ID, form: { revisions: mode, components: [] } });
      expect(mockFormioFetch).not.toHaveBeenCalled();
    }
  );

  it('does not read the stored form when the caller accepted saving without history', async () => {
    await gateFormHistory({
      cfg,
      formId: FORM_ID,
      form: { components: [] },
      acceptNoHistory: true,
    });
    expect(mockFormioFetch).not.toHaveBeenCalled();
  });

  it('passes when the stored form has revisions on', async () => {
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: 'original' });

    await gateFormHistory({ cfg, formId: FORM_ID, form: { components: [] } });
    expect(mockFormioFetch).toHaveBeenCalledWith(`form/${FORM_ID}`, {}, cfg);
  });

  // Echoing the stored "" back is not a decision about history.
  it.each([{}, { revisions: '' }])(
    'refuses with HISTORY_NOT_ACCEPTED when the stored form has revisions off (body %j)',
    async (extra) => {
      mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: '' });

      const attempt = gateFormHistory({
        cfg,
        formId: FORM_ID,
        form: { components: [], ...extra },
      });
      await expect(attempt).rejects.toMatchObject({ code: 'HISTORY_NOT_ACCEPTED' });
      await expect(attempt).rejects.toThrow(/"demo"/);
    }
  );
});

describe('helpers', () => {
  it('prefixVnote prefixes with @formio/mcp:', () => {
    expect(prefixVnote('hello world')).toBe('@formio/mcp: hello world');
  });

  it('stripRevisions removes the revisions key', () => {
    expect(stripRevisions({ revisions: 'current', components: [] })).toEqual({ components: [] });
    expect(stripRevisions({ components: [] })).toEqual({ components: [] });
  });
});
