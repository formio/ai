import crypto from 'crypto';
import { sessionLabel } from './submission-keys.js';

/**
 * The boundary for agent-written submissions, as pure functions.
 *
 * `metadata` is writable by anyone who can submit to a form, so a tag saying "the agent
 * made this" is only a claim. What makes it proof is `sig`: an HMAC, under a key that
 * never leaves this machine, over the project, form, owner, tag fields, and the whole
 * stored `data`. A copied tag verifies only on a record whose data is byte-identical to
 * the agent's own, so nothing an outsider wrote can pass `verifyRecord` — and nothing
 * that fails it is ever put in front of the agent.
 */

export type SubmissionPurpose = 'reference-data' | 'test';

export const SUBMISSION_PURPOSES: readonly SubmissionPurpose[] = ['reference-data', 'test'];

export interface AgentTag {
  source: 'agent';
  session: string;
  purpose: SubmissionPurpose;
  sig: string;
}

export interface AgentRecord {
  _id: string;
  form: string;
  created: unknown;
  modified: unknown;
  data: unknown;
  purpose: SubmissionPurpose;
}

/** Key-sorted JSON, so the signed bytes do not depend on property order. */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

interface SignedFields {
  projectUrl: string;
  formId: string;
  owner: string | null;
  session: string;
  purpose: SubmissionPurpose;
  data: unknown;
}

function computeSig(key: Buffer, fields: SignedFields): string {
  return crypto.createHmac('sha256', key).update(canonicalize(fields)).digest('hex');
}

export interface SignTagInput {
  key: Buffer;
  projectUrl: string;
  formId: string;
  owner: string | null;
  purpose: SubmissionPurpose;
  data: unknown;
}

export function signTag({ key, projectUrl, formId, owner, purpose, data }: SignTagInput): AgentTag {
  const session = sessionLabel(key);
  const sig = computeSig(key, { projectUrl, formId, owner, session, purpose, data });
  return { source: 'agent', session, purpose, sig };
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTag(record: Record<string, unknown>): AgentTag | null {
  const metadata = record.metadata;
  if (!isRecordObject(metadata)) return null;
  const tag = metadata.agent;
  if (!isRecordObject(tag)) return null;
  const { source, session, purpose, sig } = tag;
  if (
    source !== 'agent' ||
    typeof session !== 'string' ||
    !SUBMISSION_PURPOSES.includes(purpose as SubmissionPurpose) ||
    typeof sig !== 'string'
  ) {
    return null;
  }
  return { source, session, purpose: purpose as SubmissionPurpose, sig };
}

function sigMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(actual, 'hex');
  // `Buffer.from(…, 'hex')` drops invalid characters, so compare lengths after decoding
  // AND require the text to round-trip; a malformed sig must fail, never throw.
  if (b.length !== a.length || b.toString('hex') !== actual) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/** The fields the agent sees for a record. No signature, owner, or access. */
export function projectRecord(
  record: Record<string, unknown>,
  purpose: SubmissionPurpose
): AgentRecord {
  return {
    _id: String(record._id),
    form: String(record.form),
    created: record.created,
    modified: record.modified,
    data: record.data,
    purpose,
  };
}

export interface VerifyContext {
  key: Buffer;
  projectUrl: string;
  formId: string;
}

/**
 * The record projected for the agent when it is one this directory's key signed for this
 * form and project, and `null` otherwise. Never throws: every shape of bad input is a
 * record the agent does not own.
 */
export function verifyRecord(
  record: unknown,
  { key, projectUrl, formId }: VerifyContext
): AgentRecord | null {
  if (!isRecordObject(record)) return null;
  const tag = readTag(record);
  if (tag === null) return null;
  if (tag.session !== sessionLabel(key)) return null;
  if (record.form !== formId) return null;
  const owner = typeof record.owner === 'string' ? record.owner : null;
  const expected = computeSig(key, {
    projectUrl,
    formId,
    owner,
    session: tag.session,
    purpose: tag.purpose,
    data: record.data,
  });
  if (!sigMatches(expected, tag.sig)) return null;
  return projectRecord(record, tag.purpose);
}

// ── Query shaping ────────────────────────────────────────────────────────────────────

const OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'regex'];
// A segment may hold single underscores but never `__`: resourcejs splits keys on `__`
// to find the operator, so `data.a__where` would otherwise reach Mongo as `$where`.
const SEGMENT = '[A-Za-z0-9-]+(?:_[A-Za-z0-9-]+)*';
const FILTER_KEY = new RegExp(`^data(?:\\.${SEGMENT})+(?:__(?:${OPERATORS.join('|')}))?$`);
const SORT_KEY = new RegExp(`^-?(?:data(?:\\.${SEGMENT})+|created|modified)$`);
const FORBIDDEN_VALUE = /[$[\]]/;
const MAX_REGEX = 200;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const LIST_SELECT = '_id,form,owner,data,metadata,created,modified';

export interface ListQueryInput {
  session: string;
  purpose?: SubmissionPurpose;
  filters?: Record<string, string>;
  limit?: number;
  skip?: number;
  sort?: string;
}

export type ListQueryResult =
  { ok: true; params: Record<string, string> } | { ok: false; reason: string };

function refuse(reason: string): ListQueryResult {
  return { ok: false, reason };
}

const OPERATOR_SUFFIX = new RegExp(`__(?:${OPERATORS.join('|')})$`);

function filterProblem([filterKey, value]: [string, string]): string | null {
  if (filterKey.startsWith('data.') && filterKey.replace(OPERATOR_SUFFIX, '').includes('__')) {
    return `"${filterKey}" is not an allowed filter: field names may not contain \`__\`, because Form.io reads everything after the first \`__\` as the query operator. Name the field, then at most one operator suffix.`;
  }
  if (!FILTER_KEY.test(filterKey)) {
    return `"${filterKey}" is not an allowed filter: filters name a data field (data.<key>), optionally with one of the operators __${OPERATORS.join(', __')}.`;
  }
  if (FORBIDDEN_VALUE.test(value)) {
    return `The value for "${filterKey}" contains "$", "[", or "]", which filters do not accept.`;
  }
  if (filterKey.endsWith('__regex') && value.length > MAX_REGEX) {
    return `The pattern for "${filterKey}" is longer than ${MAX_REGEX} characters.`;
  }
  return null;
}

/**
 * The index query for one directory's rows. Built here, from structured input, and never
 * by forwarding what the agent passed: the Form.io index copies unrecognized params
 * straight into its Mongo filter, so a forwarded `$or` or `a[$ne]` could widen it.
 */
export function buildListQuery({
  session,
  purpose,
  filters = {},
  limit = DEFAULT_LIMIT,
  skip = 0,
  sort,
}: ListQueryInput): ListQueryResult {
  const problem = Object.entries(filters)
    .map(filterProblem)
    .find((p) => p !== null);
  if (problem) return refuse(problem);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return refuse(`limit must be a whole number from 1 to ${MAX_LIMIT}.`);
  }
  if (!Number.isInteger(skip) || skip < 0) {
    return refuse('skip must be a whole number of 0 or more.');
  }
  if (sort !== undefined && !SORT_KEY.test(sort)) {
    return refuse('sort takes a data field, created, or modified, optionally prefixed with "-".');
  }
  return {
    ok: true,
    params: {
      ...filters,
      'metadata.agent.source': 'agent',
      'metadata.agent.session': session,
      ...(purpose ? { 'metadata.agent.purpose': purpose } : {}),
      select: LIST_SELECT,
      limit: String(limit),
      ...(skip > 0 ? { skip: String(skip) } : {}),
      ...(sort ? { sort } : {}),
    },
  };
}
