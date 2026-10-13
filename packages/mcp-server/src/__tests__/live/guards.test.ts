import { describe, expect, it } from 'vitest';
import { checkLiveTarget, cleanupPlan, coverageGaps, runPrefix, systemCaArgs } from './guards.js';

describe('checkLiveTarget', () => {
  it('accepts a resolved project that equals the allowlisted one', () => {
    expect(
      checkLiveTarget({
        resolvedProjectUrl: 'https://form.test/sandbox',
        allowedProjectUrl: 'https://form.test/sandbox/',
      })
    ).toEqual({ ok: true, projectUrl: 'https://form.test/sandbox' });
  });

  it('refuses a resolved project that differs, naming both URLs', () => {
    const result = checkLiveTarget({
      resolvedProjectUrl: 'https://acme.form.io',
      allowedProjectUrl: 'https://form.test/sandbox',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/https:\/\/acme\.form\.io/);
    expect(!result.ok && result.message).toMatch(/https:\/\/form\.test\/sandbox/);
  });

  it('refuses when no project is allowlisted', () => {
    const result = checkLiveTarget({
      resolvedProjectUrl: 'https://form.test/sandbox',
      allowedProjectUrl: undefined,
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/FORMIO_LIVE_TEST_PROJECT is not set/);
    // Both URLs are always named: the resolved one, and the allowlist (here unset).
    expect(!result.ok && result.message).toMatch(/resolves to https:\/\/form\.test\/sandbox/);
  });

  it('refuses when the folder resolves to no project', () => {
    const result = checkLiveTarget({
      resolvedProjectUrl: undefined,
      allowedProjectUrl: 'https://form.test/sandbox',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/no project/i);
    expect(!result.ok && result.message).toMatch(/allows only https:\/\/form\.test\/sandbox/);
  });

  // A project_get that failed outright reports a broken record, not an absent one:
  // its own error is relayed, and project_set — which would fail for the same
  // reason — is not offered as the remedy.
  it('relays a resolution error instead of reporting no project', () => {
    const result = checkLiveTarget({
      resolvedProjectUrl: undefined,
      resolveError: '[CONFIG_UNREADABLE] formio.json at /repo/formio.json is not valid JSON',
      allowedProjectUrl: 'https://form.test/sandbox',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/CONFIG_UNREADABLE/);
    expect(!result.ok && result.message).not.toMatch(/project_set/);
    expect(!result.ok && result.message).toMatch(/https:\/\/form\.test\/sandbox/);
  });

  it('does not treat a longer path as the same project', () => {
    expect(
      checkLiveTarget({
        resolvedProjectUrl: 'https://form.test/sandbox2',
        allowedProjectUrl: 'https://form.test/sandbox',
      }).ok
    ).toBe(false);
  });
});

describe('coverageGaps', () => {
  it('names every registered tool without a live case, sorted', () => {
    expect(
      coverageGaps({
        registered: ['form_list', 'role_list', 'action_list'],
        covered: ['role_list'],
      })
    ).toEqual(['action_list', 'form_list']);
  });

  it('is empty when every tool has a case', () => {
    expect(coverageGaps({ registered: ['form_list'], covered: ['form_list', 'extra'] })).toEqual(
      []
    );
  });
});

describe('runPrefix', () => {
  it('is a lowercase alphanumeric machine-name prefix derived from the time', () => {
    expect(runPrefix(new Date('2026-10-13T14:16:02.837Z'))).toBe('mcplive20261013141602');
  });
});

describe('cleanupPlan', () => {
  const prefix = 'mcplive20261013141602';

  it('deletes only entities carrying the run prefix', () => {
    const plan = cleanupPlan({
      prefix,
      forms: [
        { _id: 'f1', name: `${prefix}probe` },
        { _id: 'f2', name: 'user' },
      ],
      roles: [
        { _id: 'r1', title: `${prefix} role` },
        { _id: 'r2', title: 'Administrator' },
      ],
      tags: [],
      originalTag: '1.0.0',
      currentTag: '1.0.0',
    });
    expect(plan.deleteForms).toEqual(['f1']);
    expect(plan.deleteRoles).toEqual(['r1']);
  });

  it('deletes a tag by its main document only, since that removes the chunks', () => {
    const plan = cleanupPlan({
      prefix,
      forms: [],
      roles: [],
      tags: [
        { _id: 't1', tag: `0.0.1-${prefix}` },
        { _id: 't1c', tag: `0.0.1-${prefix}`, chunk: true },
        { _id: 't2', tag: '1.0.0' },
      ],
      originalTag: '1.0.0',
      currentTag: `0.0.1-${prefix}`,
    });
    expect(plan.deleteTags).toEqual(['t1']);
  });

  it('restores the project version only when the run moved it', () => {
    const base = { prefix, forms: [], roles: [], tags: [] };
    expect(
      cleanupPlan({ ...base, originalTag: '1.0.0', currentTag: `0.0.1-${prefix}` }).restoreTag
    ).toBe('1.0.0');
    expect(cleanupPlan({ ...base, originalTag: '1.0.0', currentTag: '1.0.0' }).restoreTag).toBe(
      undefined
    );
  });
});

// A local deployment's certificate is often trusted by the operating system's store
// (the macOS keychain, for example) and not by Node's bundled CAs. The runner starts
// the server, and runs its own clean-up requests, with --use-system-ca wherever this
// Node supports it, so verification stays on and such a deployment still works.
describe('systemCaArgs', () => {
  it('adds --use-system-ca when this Node supports it', () => {
    expect(systemCaArgs(new Set(['--use-system-ca', '--inspect']))).toEqual(['--use-system-ca']);
  });

  it('adds nothing on a Node without it', () => {
    expect(systemCaArgs(new Set(['--inspect']))).toEqual([]);
  });
});
