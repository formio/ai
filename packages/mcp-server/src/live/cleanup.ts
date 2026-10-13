/**
 * Removing what a live run created, given a way to send authenticated requests to the
 * project. Each listing is fetched on its own, so one that fails — a 500 on the tag
 * index, say — leaves the others' clean-up to run, and the report names what could not
 * be listed or removed rather than the run going quiet about it.
 */

import { cleanupPlan } from './guards.js';

export interface CleanupRequest {
  method: 'GET' | 'PUT' | 'DELETE';
  /** Path under the Project URL, starting with `/` or empty for the project itself. */
  path: string;
  body?: unknown;
}

export interface CleanupReport {
  deleted: { forms: number; roles: number; tags: number };
  restoredTag: string | undefined;
  /** The listings that failed, so their part of the plan could not run. */
  unlisted: string[];
  /** One line per listing or removal that failed. */
  problems: string[];
}

const asList = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const LISTINGS = [
  { label: 'forms', path: '/form?limit=10000&select=_id,name,path' },
  { label: 'roles', path: '/role?limit=10000' },
  { label: 'tags', path: '/tag?limit=10000' },
  { label: 'current version', path: '/tag/current' },
] as const;

export async function runCleanup({
  prefix,
  originalTag,
  request,
}: {
  prefix: string;
  originalTag: string | undefined;
  request: (request: CleanupRequest) => Promise<unknown>;
}): Promise<CleanupReport> {
  const settled = await Promise.allSettled(
    LISTINGS.map(({ path }) => request({ method: 'GET', path }))
  );
  const listed = (index: number): unknown =>
    settled[index].status === 'fulfilled' ? settled[index].value : undefined;
  const unlisted = LISTINGS.filter((_, index) => settled[index].status === 'rejected').map(
    ({ label }) => label
  );
  const listingProblems = LISTINGS.flatMap(({ label }, index) => {
    const outcome = settled[index];
    return outcome.status === 'rejected'
      ? [`${label} could not be listed: ${String(outcome.reason)}`]
      : [];
  });

  // A current version that could not be read counts as moved: putting the original
  // back is harmless when it never changed.
  const plan = cleanupPlan({
    prefix,
    forms: asList(listed(0)),
    roles: asList(listed(1)),
    tags: asList(listed(2)),
    originalTag,
    currentTag: (listed(3) as { tag?: string } | undefined)?.tag,
  });

  const steps = [
    ...plan.deleteForms.map((id) => ({
      label: `form ${id}`,
      kind: 'forms' as const,
      send: { method: 'DELETE' as const, path: `/form/${id}` },
    })),
    ...plan.deleteRoles.map((id) => ({
      label: `role ${id}`,
      kind: 'roles' as const,
      send: { method: 'DELETE' as const, path: `/role/${id}` },
    })),
    ...plan.deleteTags.map((id) => ({
      label: `tag ${id}`,
      kind: 'tags' as const,
      send: { method: 'DELETE' as const, path: `/tag/${id}` },
    })),
  ];
  const outcomes = await steps.reduce<
    Promise<Array<{ kind: 'forms' | 'roles' | 'tags'; problem?: string }>>
  >(async (previous, step) => {
    const done = await previous;
    try {
      await request(step.send);
      return [...done, { kind: step.kind }];
    } catch (error) {
      return [...done, { kind: step.kind, problem: `${step.label}: ${String(error)}` }];
    }
  }, Promise.resolve([]));

  const restoreProblem = await (async () => {
    if (plan.restoreTag === undefined) return undefined;
    try {
      await request({ method: 'PUT', path: '', body: { tag: plan.restoreTag } });
      return undefined;
    } catch (error) {
      return `restore version ${plan.restoreTag}: ${String(error)}`;
    }
  })();

  const count = (kind: 'forms' | 'roles' | 'tags') =>
    outcomes.filter((outcome) => outcome.kind === kind && !outcome.problem).length;
  return {
    deleted: { forms: count('forms'), roles: count('roles'), tags: count('tags') },
    restoredTag: restoreProblem ? undefined : plan.restoreTag,
    unlisted,
    problems: [
      ...listingProblems,
      ...outcomes.flatMap((outcome) => (outcome.problem ? [outcome.problem] : [])),
      ...(restoreProblem ? [restoreProblem] : []),
    ],
  };
}
