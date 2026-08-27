import { InvalidRequestedUrlError, normalizeHttpUrl, readHttpUrlEnv } from './config.js';
import { classifyPair, deriveBaseUrl } from './pair-rule.js';

/**
 * What a `project_set` / `project set` call should write for a directory.
 *
 * One rule: a record holds a project and its deployment as a PAIR. A write leaves a
 * complete record or it fails.
 *
 * That is the whole of it, and it is worth saying why, because the previous design
 * was several times this size. It allowed a record to hold half a configuration — the
 * base-URL repair wrote a deployment with no project, since the project lived in a
 * committed file or the environment — and nothing in such a record said which project
 * the deployment belonged to. Answering that at read time took a stored pairing, a
 * re-point guard, a carry rule and two shape-aware gates, all of which had to agree
 * on every path. Three consecutive reviews found them disagreeing: a deployment
 * carried onto the wrong project, a value the resolver refused right after a writer
 * reported it, a `base-url-unresolved` remedy that looped forever.
 *
 * None of those questions exist here. The pair IS the interpretation.
 */
export interface ProjectEntryPlanRequest {
  cwd: string;
  /** What the caller passed. Validated strictly — this is their own typing. */
  requested: { projectUrl?: string; baseUrl?: string };
  /**
   * What the record being written holds today, read as it is on disk — the mapping
   * entry's env, since the mapping is the only record this server writes.
   */
  record: { projectUrl?: string; baseUrl?: string };
  /**
   * Where the project lives when this record has none, for a write that cannot reach
   * it. The committed file carries its path, because the refusal that names it
   * instructs an edit to that exact file.
   */
  elsewhere?: { committed?: { projectUrl: string; filePath: string }; environment?: string };
}

/** The entry to write, in the shape `writeProjectEntry` takes. */
export interface PlannedEntry {
  env: Record<string, string>;
}

export interface PlannedWrite {
  outcome: 'write' | 'unchanged';
  cwd: string;
  entry: PlannedEntry;
  projectUrl: string;
  baseUrl: string;
  /**
   * What the mapping held before, raw, for a caller that reports "was X".
   *
   * Carried on the plan rather than recomputed by each writer, though both hold the
   * record they read. The plan is the one place that decides what this call DID; two
   * callers deriving that themselves is the same rule in two places, which is the
   * shape every defect on this surface has had — and the derivation is not quite
   * trivial, since the raw value here is deliberately the unnormalized one.
   */
  previousProjectUrl?: string;
  /**
   * A deployment this write DROPPED because the record's stored one cannot serve the
   * project being recorded. Reported so the writer can say the stale value is gone
   * rather than leaving the change silent.
   */
  droppedBaseUrl?: string;
  /** Whether this call named the project, as opposed to amending the pair. */
  setAProject: boolean;
}

/** Which record holds the project, for a caller naming the write that reaches it. */
export type ProjectRecord = 'committed' | 'mapping' | 'environment';

export type ProjectEntryPlan =
  | { outcome: 'no-values'; cwd: string }
  | { outcome: 'project-required'; cwd: string }
  /**
   * A project URL that names no deployment arrived without one.
   *
   * The record's own deployment is carried when there IS one that could not be
   * adopted — which happens when the stored project URL is unusable, so nothing says
   * that deployment belongs to the project now being recorded. Adopting it would
   * carry a deployment across a project change, which is the failure the pair rule
   * exists to prevent; hiding it asks the user for a value sitting on disk in the
   * very entry they are repairing. Named, and left for them to confirm.
   */
  | {
      outcome: 'base-url-required';
      cwd: string;
      projectUrl: string;
      recordedBaseUrl?: string;
      /** Which of the three reasons the recorded deployment was not adopted. */
      strandedReason?: 'cannot-serve' | 'no-project' | 'unusable-project' | 'different-project';
      unusableRecordedProjectUrl?: string;
    }
  /** A deployment alone, for a project this call cannot write beside. */
  | {
      outcome: 'wrong-record';
      cwd: string;
      record: Exclude<ProjectRecord, 'mapping'>;
      projectUrl: string;
      /** The committed file holding the project, when that is the record. */
      filePath?: string;
    }
  /** The deployment and the project are the same server — an Open Source install. */
  | { outcome: 'open-source-deployment'; cwd: string; url: string }
  /** The hosted cloud's API root, offered where a project URL belongs. */
  | { outcome: 'not-a-project-url'; cwd: string; url: string }
  /** A form.io host that is not a project: the apex, the site, the portal, or a path. */
  | { outcome: 'not-a-hosted-project'; cwd: string; url: string }
  /**
   * A deployment that cannot serve the project it was offered for: a hosted-cloud
   * project paired with anything but https://api.form.io, or a customer project
   * paired with the hosted cloud.
   */
  // Two members rather than one with a union discriminant: a caller that handles
  // each in turn should be narrowed to `never` by the checker once both are covered,
  // and a shared discriminant silently defeats that — which is how one of these
  // outcomes reached the success path's field accesses.
  | {
      outcome: 'hosted-project-foreign-deployment';
      cwd: string;
      projectUrl: string;
      baseUrl: string;
    }
  | { outcome: 'api-root-deployment'; cwd: string; projectUrl: string; baseUrl: string }
  | { outcome: 'underivable-mismatch'; cwd: string; projectUrl: string; baseUrl: string }
  | PlannedWrite;

export function planProjectEntry({
  cwd,
  requested,
  record,
  elsewhere = {},
}: ProjectEntryPlanRequest): ProjectEntryPlan {
  if (!requested.projectUrl && !requested.baseUrl) {
    return { outcome: 'no-values', cwd };
  }

  // The stored project is hand-editable DATA, not the caller's typing, and this write
  // is what repairs an entry the resolver refuses. Read tolerantly so it cannot fail
  // on the value it is replacing; an unusable one is not a project, so it also cannot
  // stand in for one a deployment-only call is missing.
  const previousProjectUrl = record.projectUrl;
  const recordProjectUrl = readHttpUrlEnv({
    raw: previousProjectUrl,
    name: `the project URL recorded for ${cwd}`,
    onIgnored: () => {},
  });
  const recordBaseUrl = readHttpUrlEnv({
    raw: record.baseUrl,
    name: `the base URL recorded for ${cwd}`,
    onIgnored: () => {},
  });

  // Marked as the caller's own typing, so the entry points can answer it as a value
  // to re-ask for rather than as a command that could not run.
  const requestedUrl = (raw: string, label: string) => {
    try {
      return normalizeHttpUrl(raw, label);
    } catch (error) {
      // Names the value AS TYPED. The underlying message reports only what the parser
      // made of it ("got: htps:"), which tells a reader the scheme was wrong but not
      // which of their two arguments carried it.
      throw new InvalidRequestedUrlError(
        `${error instanceof Error ? error.message : String(error)} (${label} was ${raw})`
      );
    }
  };
  const requestedProjectUrl = requested.projectUrl
    ? requestedUrl(requested.projectUrl, 'projectUrl')
    : undefined;
  const requestedBaseUrl = requested.baseUrl
    ? requestedUrl(requested.baseUrl, 'baseUrl')
    : undefined;

  // A deployment alone amends the pair where the project already is. The mapping is
  // the only record this write can reach, so a project held anywhere else is a
  // different write — named, not attempted, because writing the deployment here would
  // put it in one record and its project in another.
  if (!requestedProjectUrl) {
    // The pair this call WOULD form, judged before any remedy is named. The
    // deferral below tells the caller to record the offered deployment beside a
    // project held elsewhere — so if that pair is one the resolver refuses, the
    // instruction is to write a record that breaks the directory (a committed edit
    // making every later call fail) or to run a command this same writer rejects.
    // Returning here without asking was the one path around the chokepoint, and it
    // was the path whose answer a human carries out by hand.
    // WHICH project this call would defer to, decided once. The branches below and
    // the pair check above each worked it out for themselves and disagreed: the check
    // asked only when this record had no project, while the committed branch fires
    // whenever the committed file names a DIFFERENT one — so a directory holding both
    // a mapping project and a committed project skipped the check entirely and was
    // told to hand-write a pair that makes every later call fail. One expression, used
    // by both, cannot drift.
    const deferral: { projectUrl: string; record: 'committed' | 'environment' } | undefined =
      elsewhere.committed && elsewhere.committed.projectUrl !== recordProjectUrl
        ? { projectUrl: elsewhere.committed.projectUrl, record: 'committed' }
        : !recordProjectUrl && elsewhere.environment
          ? { projectUrl: elsewhere.environment, record: 'environment' }
          : undefined;
    const elsewhereProject = deferral?.projectUrl;
    if (requestedBaseUrl && elsewhereProject) {
      // EVERY non-ok verdict, not the two that were in front of me: a project URL
      // that is the API root fell through, so the deferral named a command the
      // writer refuses and an edit that leaves the file unusable — with the actual
      // fault, the project URL, never mentioned.
      const offered = classifyPair(elsewhereProject, requestedBaseUrl);
      if (offered === 'not-a-project-url' || offered === 'not-a-hosted-project') {
        return { outcome: offered, cwd, url: elsewhereProject };
      }
      if (offered === 'open-source-deployment') {
        return { outcome: 'open-source-deployment', cwd, url: elsewhereProject };
      }
      if (offered !== 'ok') {
        return {
          outcome: offered,
          cwd,
          projectUrl: elsewhereProject,
          baseUrl: requestedBaseUrl,
        };
      }
    }
    // A committed file GOVERNS the directory, so a deployment supplied with no project
    // answers a report about ITS project. Amending this record instead would record that
    // deployment for a project the directory does not resolve — UNLESS both records name
    // the same project, where there is nothing ambiguous to refuse and the mapping is
    // this project's own fallback if that file goes away.
    if (deferral?.record === 'committed' && elsewhere.committed) {
      return {
        outcome: 'wrong-record',
        cwd,
        record: 'committed',
        projectUrl: elsewhere.committed.projectUrl,
        filePath: elsewhere.committed.filePath,
      };
    }
    if (!recordProjectUrl) {
      return elsewhere.environment
        ? { outcome: 'wrong-record', cwd, record: 'environment', projectUrl: elsewhere.environment }
        : { outcome: 'project-required', cwd };
    }
  }

  const projectUrl = (requestedProjectUrl ?? recordProjectUrl) as string;
  // Derived at save time, from the project it is about to be stored beside. The one
  // shape that derives nothing has to arrive with its deployment: recording the
  // project alone would leave a record naming a project and no deployment, and the
  // caller answering that report already holds the project URL, so asking for both in
  // the call still asks the user for one value.
  // The record's own deployment survives a call that does not change its project —
  // an idempotent re-set, or a user re-confirming what is already there. Ignoring it
  // asked for a Base URL the record already held, and for the one shape that derives
  // nothing that refusal was a hard error. A call that changes the project keeps
  // nothing: the deployment belonged to the project being replaced.
  const keptBaseUrl = recordProjectUrl === projectUrl ? recordBaseUrl : undefined;
  let baseUrl = requestedBaseUrl ?? keptBaseUrl ?? deriveBaseUrl(projectUrl);
  // A KEPT deployment that the pair rule rejects is stale data, not an answer the
  // caller just gave — so it is dropped and the derived value used, exactly as the
  // reader does with the same record. Refusing instead produced a remedy that named
  // the very call that had just failed: re-recording a hosted project whose stored
  // deployment was foreign inherited that value, was refused, and the refusal said
  // "call project_set again with projectUrl alone", which is what had been called.
  // Only a value the CALLER supplied is worth refusing, because only that one is
  // something they can correct.
  // The project half, judged on its own, before anything about deployments. A
  // verdict that faults the PROJECT does not depend on which deployment is or is not
  // beside it, and asking it only once a deployment exists left the shapes that
  // derive nothing to be diagnosed by the base-URL branch instead.
  const projectHalf = classifyPair(projectUrl, undefined);
  if (projectHalf === 'not-a-project-url' || projectHalf === 'not-a-hosted-project') {
    return { outcome: projectHalf, cwd, url: projectUrl };
  }

  let droppedBaseUrl: string | undefined;
  if (baseUrl && !requestedBaseUrl && keptBaseUrl && classifyPair(projectUrl, baseUrl) !== 'ok') {
    droppedBaseUrl = keptBaseUrl;
    baseUrl = deriveBaseUrl(projectUrl);
  }
  if (!baseUrl) {
    // A stored deployment that could not be adopted is named rather than dropped in
    // silence. The commonest way here is repairing an entry whose stored project URL
    // is unusable: it is not a project, so it cannot vouch for the deployment beside
    // it, and the refusal would otherwise demand a value the user can see on disk.
    // Why the deployment sitting in this record was not adopted — and whether the
    // caller could answer with it after all. That second question is asked of the
    // PAIR RULE rather than inferred from how the value came to be stranded: a
    // directory moving from the hosted cloud to a self-hosted deployment strands
    // https://api.form.io, which is a perfectly ordinary "recorded for a different
    // project" — and also a value that cannot serve the new one, so inviting the user
    // to re-supply it names an answer refused every time it is given.
    const stranded = droppedBaseUrl ?? (!keptBaseUrl && recordBaseUrl ? recordBaseUrl : undefined);
    const reason =
      stranded && classifyPair(projectUrl, stranded) !== 'ok'
        ? 'cannot-serve'
        : !previousProjectUrl
          ? 'no-project'
          : !recordProjectUrl
            ? 'unusable-project'
            : 'different-project';
    return {
      outcome: 'base-url-required',
      cwd,
      projectUrl,
      ...(stranded ? { recordedBaseUrl: stranded, strandedReason: reason } : {}),
      ...(stranded && reason === 'unusable-project'
        ? { unusableRecordedProjectUrl: previousProjectUrl }
        : {}),
    };
  }

  // The pair rule, asked of the pair about to be recorded — the same classification
  // the resolver applies at the point of use, so a write can never record what the
  // next read refuses. 'not-a-project-url' is the hosted cloud's own API root pasted
  // where a project URL belongs; 'open-source-deployment' is a pair collapsed onto
  // one server, which names an install with no project layer. Refused where the pair
  // is formed, rather than left to surface later as unexplained 404s.
  const validity = classifyPair(projectUrl, baseUrl);
  if (validity === 'not-a-project-url' || validity === 'not-a-hosted-project') {
    return { outcome: validity, cwd, url: projectUrl };
  }
  if (validity === 'open-source-deployment') {
    return { outcome: 'open-source-deployment', cwd, url: projectUrl };
  }
  // Refused rather than corrected: this value is a user's live answer, and a write is
  // where a wrong one is worth teaching. The reader, which meets the same pair already
  // on disk, supplies the derived deployment instead — the right value is knowable
  // there, so failing every tool call over it would be gratuitous.
  if (
    validity === 'hosted-project-foreign-deployment' ||
    validity === 'api-root-deployment' ||
    validity === 'underivable-mismatch'
  ) {
    return { outcome: validity, cwd, projectUrl, baseUrl };
  }

  const entry: PlannedEntry = {
    env: { FORMIO_PROJECT_URL: projectUrl, FORMIO_BASE_URL: baseUrl },
  };

  return {
    outcome: recordProjectUrl === projectUrl && recordBaseUrl === baseUrl ? 'unchanged' : 'write',
    cwd,
    entry,
    projectUrl,
    baseUrl,
    ...(previousProjectUrl ? { previousProjectUrl } : {}),
    ...(droppedBaseUrl ? { droppedBaseUrl } : {}),
    setAProject: Boolean(requestedProjectUrl),
  };
}
