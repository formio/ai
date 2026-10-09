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

// The shape undici gives a request that never got a response.
const networkFailure = () =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), {
      code: 'ECONNREFUSED',
    }),
  });
const FORM_ID = '67890abcdef012345678abcd';

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('checkRevisionsLicensed', () => {
  it('is licensed when /config.js contains sac = true', async () => {
    stubLicensed(true);
    expect(await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()))).toEqual({ state: 'licensed' });
  });

  it('is unlicensed when /config.js reports sac = false', async () => {
    stubLicensed(false);
    expect(await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()))).toEqual({
      state: 'unlicensed',
    });
  });

  it('is unlicensed when /config.js answers without the flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('var x = 1;') })
    );
    expect(await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()))).toEqual({
      state: 'unlicensed',
    });
  });

  it('is unknown, with NETWORK_ERROR, when the probe gets no response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkFailure()));
    const baseUrl = uniqueBaseUrl();

    const licence = await checkRevisionsLicensed(cfgFor(baseUrl));

    expect(licence).toMatchObject({ state: 'unknown', failure: { code: 'NETWORK_ERROR' } });
  });

  it('is unknown, with UPSTREAM_ERROR, when the probe is answered with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    const licence = await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()));

    expect(licence).toMatchObject({ state: 'unknown', failure: { code: 'UPSTREAM_ERROR' } });
  });

  it('bounds the probe with a timeout', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('sac = true') });
    vi.stubGlobal('fetch', fetchSpy);

    await checkRevisionsLicensed(cfgFor(uniqueBaseUrl()));

    expect((fetchSpy.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('caches a definite answer per baseUrl — second call does not refetch', async () => {
    const baseUrl = uniqueBaseUrl();
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('sac = true') });
    vi.stubGlobal('fetch', fetchSpy);
    await checkRevisionsLicensed(cfgFor(baseUrl));
    await checkRevisionsLicensed(cfgFor(baseUrl));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // A failed probe is not an answer, so it is not kept for long: long enough that a
  // run of writes against an unreachable deployment does not re-probe on every one,
  // short enough that a deployment which was only briefly unreachable is asked again.
  it('keeps an unknown answer for 60 seconds, then probes again', async () => {
    const baseUrl = uniqueBaseUrl();
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(networkFailure())
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, text: () => Promise.resolve('sac = true') });
    vi.stubGlobal('fetch', fetchSpy);
    const clock = { ms: 1_000_000 };
    const now = () => clock.ms;
    const check = () => checkRevisionsLicensed(cfgFor(baseUrl), { now });

    expect(await check()).toMatchObject({ state: 'unknown', failure: { code: 'NETWORK_ERROR' } });
    clock.ms += 59_999;
    expect(await check()).toMatchObject({ state: 'unknown', failure: { code: 'NETWORK_ERROR' } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    clock.ms += 1;
    expect(await check()).toMatchObject({ state: 'unknown', failure: { code: 'UPSTREAM_ERROR' } });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    clock.ms += 60_000;
    expect(await check()).toEqual({ state: 'licensed' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // A definite answer does not expire.
    clock.ms += 10 * 60_000;
    expect(await check()).toEqual({ state: 'licensed' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
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

  // Unknown is not unlicensed: LICENSE_REQUIRED would tell the user to stop using
  // drafts on a deployment that may well support them.
  it('refuses with NETWORK_ERROR naming the probe URL when the probe gets no response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkFailure()));
    const baseUrl = uniqueBaseUrl();

    const attempt = requireRevisionsLicense(cfgFor(baseUrl), 'publish this form');

    await expect(attempt).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(attempt).rejects.toThrow(/could not be determined/);
    await expect(attempt).rejects.toThrow(`${baseUrl}/config.js`);
    await expect(attempt).rejects.toThrow(/ECONNREFUSED/);
  });

  it('refuses with UPSTREAM_ERROR naming the probe URL when the probe is answered non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const baseUrl = uniqueBaseUrl();

    const attempt = requireRevisionsLicense(cfgFor(baseUrl), 'revert this form');

    await expect(attempt).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    await expect(attempt).rejects.toThrow(/could not be determined/);
    await expect(attempt).rejects.toThrow(`${baseUrl}/config.js`);
    await expect(attempt).rejects.toThrow(/500/);
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

  // An unknown licence never strips `revisions` and never refuses on the licence's
  // account: either would act on a probe that produced no answer.
  it.each([
    ['no response', () => vi.fn().mockRejectedValue(networkFailure())],
    ['an error status', () => vi.fn().mockResolvedValue({ ok: false, status: 503 })],
  ])('leaves the body as-is when the probe got %s', async (_label, probe) => {
    vi.stubGlobal('fetch', probe());

    const withRevisions = { revisions: 'original', components: [] };
    const kept = await gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form: withRevisions,
    });
    expect(kept.form).toBe(withRevisions);
    expect(kept.licensed).toBe(false);
    expect(kept.licenceUnknown).toBe(true);

    const withoutRevisions = { components: [] };
    const passed = await gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form: withoutRevisions,
    });
    expect(passed.form).toBe(withoutRevisions);
  });

  // The body turning history off is the caller's own decision, and it needs the same
  // acceptance whatever the probe says.
  it('still refuses a body that turns history off when the licence is unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkFailure()));

    const attempt = gateRevisionsLicense({
      cfg: cfgFor(uniqueBaseUrl()),
      actionLabel: 'update this form',
      form: { revisions: '', components: [] },
    });
    await expect(attempt).rejects.toMatchObject({ code: 'HISTORY_NOT_ACCEPTED' });
    await expect(attempt).rejects.toThrow(/sets revisions to ""/);
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
    // Only the two fields the gate reads: the whole definition is not needed.
    expect(mockFormioFetch).toHaveBeenCalledWith(
      `form/${FORM_ID}`,
      { select: 'revisions,name' },
      cfg
    );
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
