import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResolvedFormioConfig } from '../config.js';

const mockFormioFetch = vi.fn();
vi.mock('../formio-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formio-client.js')>();
  return {
    ...actual,
    formioFetch: (...args: unknown[]) => mockFormioFetch(...args),
  };
});

const mockRequestLicenseConsent = vi.fn();
const mockRequestRevisionsConsent = vi.fn();
vi.mock('../revisions/browser-prompts.js', () => ({
  requestRevisionsLicenseConsent: (...args: unknown[]) => mockRequestLicenseConsent(...args),
  requestRevisionsConsent: (...args: unknown[]) => mockRequestRevisionsConsent(...args),
}));

const { checkRevisionsLicensed, confirmProceedWithoutRevisions, gateRevisionsLicense } =
  await import('../revisions/license.js');
const { gateRevisionsTracking } = await import('../revisions/tracking.js');
const { prefixVnote, stripRevisions } = await import('../revisions/helpers.js');

// Minimal stand-in for McpServer with controllable elicitation behavior.
function makeServer(opts: {
  elicitation?: boolean;
  elicit?: (req: unknown) => Promise<unknown>;
}): McpServer {
  return {
    server: {
      getClientCapabilities: () => (opts.elicitation ? { elicitation: {} } : {}),
      elicitInput: opts.elicit ?? vi.fn(),
    },
  } as unknown as McpServer;
}

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

const elicitAccept = (choice: string) =>
  vi.fn().mockResolvedValue({ action: 'accept', content: { choice } });
const elicitCancel = () => vi.fn().mockResolvedValue({ action: 'cancel' });

const uniqueBaseUrl = () => `https://license-${randomUUID()}.local`;
const uniqueFormId = () => `form-${randomUUID()}`;

const CONSENT_FILE = path.join(os.homedir(), '.formio', 'revisions-license-consent.json');

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

describe('confirmProceedWithoutRevisions', () => {
  it('throws USER CANCELLED when user cancels via elicitation', async () => {
    const baseUrl = uniqueBaseUrl();
    stubLicensed(false);
    const server = makeServer({ elicitation: true, elicit: elicitCancel() });

    await expect(
      confirmProceedWithoutRevisions(server, cfgFor(baseUrl), 'create this form')
    ).rejects.toThrow(/USER CANCELLED/);
  });

  it('falls back to browser prompt when elicitation unsupported and persists on continue', async () => {
    const baseUrl = uniqueBaseUrl();
    stubLicensed(false);
    mockRequestLicenseConsent.mockResolvedValue('continue');
    const server = makeServer({ elicitation: false });

    await confirmProceedWithoutRevisions(server, cfgFor(baseUrl), 'create this form');

    expect(mockRequestLicenseConsent).toHaveBeenCalledWith(baseUrl, 'create this form');
    const data = JSON.parse(await fs.readFile(CONSENT_FILE, 'utf-8'));
    expect(data[baseUrl]).toBe(true);
  });

  it('throws USER CANCELLED when browser prompt cancels', async () => {
    const baseUrl = uniqueBaseUrl();
    stubLicensed(false);
    mockRequestLicenseConsent.mockResolvedValue('cancel');
    const server = makeServer({ elicitation: false });

    await expect(
      confirmProceedWithoutRevisions(server, cfgFor(baseUrl), 'create this form')
    ).rejects.toThrow(/USER CANCELLED/);
  });

  it('persists positive consent to file and skips re-prompt for same baseUrl', async () => {
    const baseUrl = uniqueBaseUrl();
    stubLicensed(false);
    const elicit = elicitAccept('continue');
    const server = makeServer({ elicitation: true, elicit });

    await confirmProceedWithoutRevisions(server, cfgFor(baseUrl), 'create this form');

    const stat = await fs.stat(CONSENT_FILE);
    expect(stat.mode & 0o777).toBe(0o600);
    const data = JSON.parse(await fs.readFile(CONSENT_FILE, 'utf-8'));
    expect(data[baseUrl]).toBe(true);

    // second call → no re-prompt
    await confirmProceedWithoutRevisions(server, cfgFor(baseUrl), 'create this form');
    expect(elicit).toHaveBeenCalledTimes(1);
  });
});

describe('gateRevisionsLicense', () => {
  it('throws when requiresRevisions and unlicensed', async () => {
    stubLicensed(false);
    const server = makeServer({ elicitation: true, elicit: vi.fn() });

    await expect(
      gateRevisionsLicense(server, cfgFor(uniqueBaseUrl()), {
        actionLabel: 'save a draft of this form',
        requiresRevisions: true,
        form: { components: [] },
      })
    ).rejects.toThrow(/Security Module is required/);
  });

  it('strips revisions when requiresRevisions is false and unlicensed', async () => {
    stubLicensed(false);
    const server = makeServer({ elicitation: true, elicit: elicitAccept('continue') });

    const result = await gateRevisionsLicense(server, cfgFor(uniqueBaseUrl()), {
      actionLabel: 'update this form',
      requiresRevisions: false,
      form: { revisions: 'original', components: [] },
    });
    expect(result.licensed).toBe(false);
    expect(result.form).toEqual({ components: [] });
  });

  it('passes through unchanged when licensed', async () => {
    stubLicensed(true);
    const server = makeServer({ elicitation: true, elicit: vi.fn() });

    const form = { revisions: 'original' as const, components: [] };
    const result = await gateRevisionsLicense(server, cfgFor(uniqueBaseUrl()), {
      actionLabel: 'update this form',
      requiresRevisions: false,
      form,
    });
    expect(result.licensed).toBe(true);
    expect(result.form).toBe(form);
  });
});

describe('gateRevisionsTracking', () => {
  const cfg = cfgFor('https://tracking.local');

  it.each(['original', 'current'] as const)(
    'no prompt when caller opted in via revisions: "%s"',
    async (mode) => {
      const elicit = vi.fn();
      const server = makeServer({ elicitation: true, elicit });

      const out = await gateRevisionsTracking(server, {
        formId: uniqueFormId(),
        form: { revisions: mode, components: [] },
        licensed: true,
        cfg,
      });
      expect(elicit).not.toHaveBeenCalled();
      expect(mockFormioFetch).not.toHaveBeenCalled();
      expect(out.revisions).toBe(mode);
    }
  );

  it('no prompt when licensed is false', async () => {
    const elicit = vi.fn();
    const server = makeServer({ elicitation: true, elicit });
    const out = await gateRevisionsTracking(server, {
      formId: uniqueFormId(),
      form: { components: [] },
      licensed: false,
      cfg,
    });
    expect(elicit).not.toHaveBeenCalled();
    expect(out).toEqual({ components: [] });
  });

  it('prompts when stored revisions is falsy and applies enable-original', async () => {
    const formId = uniqueFormId();
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: '' });
    const elicit = elicitAccept('enable-original');
    const server = makeServer({ elicitation: true, elicit });

    const out = await gateRevisionsTracking(server, {
      formId,
      form: { components: [] },
      licensed: true,
      cfg,
    });
    expect(elicit).toHaveBeenCalledTimes(1);
    expect(out.revisions).toBe('original');
  });

  it('prompts even when caller passes revisions: "" and applies enable-current', async () => {
    const formId = uniqueFormId();
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: '' });
    const elicit = elicitAccept('enable-current');
    const server = makeServer({ elicitation: true, elicit });

    const out = await gateRevisionsTracking(server, {
      formId,
      form: { revisions: '', components: [] },
      licensed: true,
      cfg,
    });
    expect(elicit).toHaveBeenCalledTimes(1);
    expect(out.revisions).toBe('current');
  });

  it('proceed-without-history strips revisions and remembers per-form', async () => {
    const formId = uniqueFormId();
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: '' });
    const elicit = elicitAccept('proceed-without-history');
    const server = makeServer({ elicitation: true, elicit });

    const out = await gateRevisionsTracking(server, {
      formId,
      form: { revisions: '', components: [] },
      licensed: true,
      cfg,
    });
    expect(out).toEqual({ components: [] });
    expect('revisions' in out).toBe(false);

    // Second call for same formId — no prompt, no API GET re-fetch needed beyond first.
    mockFormioFetch.mockClear();
    elicit.mockClear();
    const out2 = await gateRevisionsTracking(server, {
      formId,
      form: { components: [{ type: 'textfield', key: 'x' }] },
      licensed: true,
      cfg,
    });
    expect(elicit).not.toHaveBeenCalled();
    expect(out2).toEqual({ components: [{ type: 'textfield', key: 'x' }] });
  });

  it('throws when user cancels', async () => {
    const formId = uniqueFormId();
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: '' });
    const server = makeServer({ elicitation: true, elicit: elicitCancel() });

    await expect(
      gateRevisionsTracking(server, {
        formId,
        form: { components: [] },
        licensed: true,
        cfg,
      })
    ).rejects.toThrow(/User declined/);
  });

  it('falls back to browser prompt when elicitation unsupported', async () => {
    const formId = uniqueFormId();
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: '' });
    mockRequestRevisionsConsent.mockResolvedValue('enable-original');
    const server = makeServer({ elicitation: false });

    const out = await gateRevisionsTracking(server, {
      formId,
      form: { components: [] },
      licensed: true,
      cfg,
    });

    expect(mockRequestRevisionsConsent).toHaveBeenCalledWith('demo', formId);
    expect(out.revisions).toBe('original');
  });

  it('does not prompt when stored.revisions is truthy', async () => {
    const formId = uniqueFormId();
    mockFormioFetch.mockResolvedValue({ name: 'demo', revisions: 'original' });
    const elicit = vi.fn();
    const server = makeServer({ elicitation: true, elicit });

    const out = await gateRevisionsTracking(server, {
      formId,
      form: { components: [] },
      licensed: true,
      cfg,
    });
    expect(elicit).not.toHaveBeenCalled();
    expect(out).toEqual({ components: [] });
  });
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
