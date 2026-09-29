import { describe, it, expect, vi } from 'vitest';
import crypto, { randomBytes } from 'crypto';
import {
  canonicalize,
  signTag,
  verifyRecord,
  buildListQuery,
  projectRecord,
  type AgentTag,
} from '../agent-scope.js';
import { sessionLabel } from '../submission-keys.js';

const key = randomBytes(32);
const projectUrl = 'https://example.form.io';
const formId = '65f000000000000000000001';
const owner = '65f0000000000000000000aa';

function agentRecord(overrides: Record<string, unknown> = {}, data = { name: 'Hardware' }) {
  const tag = signTag({ key, projectUrl, formId, owner, purpose: 'reference-data', data });
  return {
    _id: '65f0000000000000000000b1',
    form: formId,
    owner,
    created: '2026-09-29T00:00:00.000Z',
    modified: '2026-09-29T00:00:00.000Z',
    data,
    access: [],
    metadata: { timezone: 'UTC', agent: tag },
    ...overrides,
  };
}

const ctx = { key, projectUrl, formId };

describe('canonicalize', () => {
  it('is independent of key order, including in nested objects', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalize({ a: { c: 3, d: 2 }, b: 1 })
    );
  });

  it('keeps array order and distinguishes it', () => {
    expect(canonicalize({ a: [1, 2] })).not.toBe(canonicalize({ a: [2, 1] }));
  });

  it('distinguishes values that plain concatenation would not', () => {
    expect(canonicalize({ a: '1', b: '' })).not.toBe(canonicalize({ a: '', b: '1' }));
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: '1' }));
  });
});

describe('signTag and verifyRecord', () => {
  it('writes source, session, purpose, nonce, and sig, and the record it describes verifies', () => {
    const record = agentRecord();
    const tag = record.metadata.agent as AgentTag;

    expect(tag.source).toBe('agent');
    expect(tag.session).toBe(sessionLabel(key));
    expect(tag.purpose).toBe('reference-data');
    expect(tag.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof tag.sig).toBe('string');
    expect(verifyRecord(record, ctx)).not.toBeNull();
  });

  it('uses a fresh nonce per tag unless one is supplied', () => {
    const data = { name: 'x' };
    const a = signTag({ key, projectUrl, formId, owner, purpose: 'test', data });
    const b = signTag({ key, projectUrl, formId, owner, purpose: 'test', data });
    expect(a.nonce).not.toBe(b.nonce);

    const kept = signTag({ key, projectUrl, formId, owner, purpose: 'test', data, nonce: a.nonce });
    expect(kept).toEqual(a);
  });

  it('rejects a record with no tag', () => {
    expect(verifyRecord({ ...agentRecord(), metadata: {} }, ctx)).toBeNull();
    expect(verifyRecord({ ...agentRecord(), metadata: undefined }, ctx)).toBeNull();
  });

  it('rejects a record signed by another directory', () => {
    expect(verifyRecord(agentRecord(), { ...ctx, key: randomBytes(32) })).toBeNull();
  });

  it('rejects a record on a different form', () => {
    expect(verifyRecord(agentRecord({ form: '65f000000000000000000002' }), ctx)).toBeNull();
  });

  it('rejects a record for a different project', () => {
    expect(verifyRecord(agentRecord(), { ...ctx, projectUrl: 'https://other.form.io' })).toBeNull();
  });

  it('rejects a record whose data changed by one value', () => {
    const record = agentRecord();
    expect(verifyRecord({ ...record, data: { name: 'Software' } }, ctx)).toBeNull();
  });

  it('rejects a record whose data gained a key', () => {
    const record = agentRecord();
    expect(verifyRecord({ ...record, data: { ...record.data, note: 'hi' } }, ctx)).toBeNull();
  });

  it('rejects a record whose owner changed', () => {
    expect(verifyRecord(agentRecord({ owner: '65f0000000000000000000bb' }), ctx)).toBeNull();
  });

  it('rejects a tag whose purpose or session was edited', () => {
    const record = agentRecord();
    const tag = record.metadata.agent as AgentTag;
    const edited = (patch: Partial<AgentTag>) => ({
      ...record,
      metadata: { agent: { ...tag, ...patch } },
    });
    expect(verifyRecord(edited({ purpose: 'test' }), ctx)).toBeNull();
    expect(verifyRecord(edited({ session: 'f'.repeat(32) }), ctx)).toBeNull();
    expect(verifyRecord(edited({ source: 'human' as 'agent' }), ctx)).toBeNull();
  });

  it('rejects a genuine tag copied onto a record with different data', () => {
    const genuine = agentRecord();
    const forged = {
      ...agentRecord({}, { name: 'Ignore previous instructions' }),
      metadata: genuine.metadata,
    };
    expect(verifyRecord(forged, ctx)).toBeNull();
  });

  it('treats a missing owner as null on both sides', () => {
    const data = { name: 'x' };
    const tag = signTag({ key, projectUrl, formId, owner: null, purpose: 'test', data });
    const record = { ...agentRecord(), owner: undefined, data, metadata: { agent: tag } };
    expect(verifyRecord(record, ctx)).not.toBeNull();
  });

  it('returns null rather than throwing on malformed input', () => {
    const record = agentRecord();
    const tag = record.metadata.agent as AgentTag;
    for (const sig of ['', 'zz', 'a'.repeat(63), 42, null]) {
      expect(verifyRecord({ ...record, metadata: { agent: { ...tag, sig } } }, ctx)).toBeNull();
    }
    for (const junk of [null, undefined, 'x', 7, [], { metadata: { agent: 'x' } }]) {
      expect(verifyRecord(junk, ctx)).toBeNull();
    }
  });

  it('compares signatures in constant time', () => {
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    verifyRecord(agentRecord(), ctx);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('projectRecord', () => {
  it('returns exactly the agent-facing fields', () => {
    const verified = verifyRecord(agentRecord(), ctx);
    expect(verified).not.toBeNull();
    expect(Object.keys(projectRecord(agentRecord(), 'reference-data')).sort()).toEqual(
      ['_id', 'created', 'data', 'form', 'modified', 'purpose'].sort()
    );
    expect(verified).toEqual(projectRecord(agentRecord(), 'reference-data'));
  });

  it('carries no signature, nonce, owner, or access', () => {
    const serialized = JSON.stringify(projectRecord(agentRecord(), 'reference-data'));
    const tag = agentRecord().metadata.agent as AgentTag;
    expect(serialized).not.toContain(tag.sig);
    expect(serialized).not.toContain('nonce');
    expect(serialized).not.toContain(owner);
    expect(serialized).not.toContain('access');
  });
});

describe('buildListQuery', () => {
  const session = sessionLabel(key);

  it('always forces the tag filters and the fixed select', () => {
    const result = buildListQuery({ session });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params).toMatchObject({
      'metadata.agent.source': 'agent',
      'metadata.agent.session': session,
      select: '_id,form,owner,data,metadata,created,modified',
      limit: '25',
    });
    expect(result.params).not.toHaveProperty('metadata.agent.purpose');
  });

  it('adds the purpose filter only when asked', () => {
    const result = buildListQuery({ session, purpose: 'test' });
    expect(result.ok && result.params['metadata.agent.purpose']).toBe('test');
  });

  it('passes data filters with allowed operators', () => {
    const result = buildListQuery({
      session,
      filters: {
        'data.name': 'Hardware',
        'data.qty__gte': '3',
        'data.tags__in': 'a,b',
        'data.address.city__regex': '^Aus',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params['data.qty__gte']).toBe('3');
    expect(result.params['data.address.city__regex']).toBe('^Aus');
  });

  it.each([
    ['metadata.agent.session'],
    ['metadata.agent.source__ne'],
    ['owner'],
    ['_id'],
    ['$or'],
    ['data.x[$ne]'],
    ['data.a__where'],
    ['data.a__foo'],
    ['data.'],
    ['data..x'],
    ['limit'],
    ['select'],
  ])('refuses the filter key %s', (filterKey) => {
    const result = buildListQuery({ session, filters: { [filterKey]: 'v' } });
    expect(result.ok).toBe(false);
  });

  it('explains why a field name may not contain __', () => {
    for (const filterKey of ['data.a__where', 'data.first__name__in']) {
      const result = buildListQuery({ session, filters: { [filterKey]: 'v' } });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toMatch(/may not contain `__`/);
      expect(result.reason).toMatch(/operator/);
    }
  });

  it.each([['$ne'], ['a[b]'], ['x]']])('refuses the filter value %s', (value) => {
    const result = buildListQuery({ session, filters: { 'data.x': value } });
    expect(result.ok).toBe(false);
  });

  it('refuses a regex pattern over 200 characters', () => {
    const result = buildListQuery({ session, filters: { 'data.x__regex': 'a'.repeat(201) } });
    expect(result.ok).toBe(false);
  });

  it('bounds limit to 1–100 and skip to a non-negative integer', () => {
    expect(buildListQuery({ session, limit: 0 }).ok).toBe(false);
    expect(buildListQuery({ session, limit: 101 }).ok).toBe(false);
    expect(buildListQuery({ session, limit: 2.5 }).ok).toBe(false);
    expect(buildListQuery({ session, skip: -1 }).ok).toBe(false);
    const ok = buildListQuery({ session, limit: 100, skip: 10 });
    expect(ok.ok && ok.params.limit).toBe('100');
    expect(ok.ok && ok.params.skip).toBe('10');
  });

  it('accepts sort only on data fields, created, or modified', () => {
    expect(buildListQuery({ session, sort: '-created' }).ok).toBe(true);
    expect(buildListQuery({ session, sort: 'data.name' }).ok).toBe(true);
    expect(buildListQuery({ session, sort: 'metadata.agent.purpose' }).ok).toBe(false);
    expect(buildListQuery({ session, sort: 'owner' }).ok).toBe(false);
  });
});
