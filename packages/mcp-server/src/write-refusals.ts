import { COMMITTED_CONFIG_FILE } from './committed-config.js';

export { BASE_URL_UNDERIVABLE } from './config.js';

/**
 * The explanations a write refusal carries, said once.
 *
 * The two writers — the `project_set` tool and the `project set` subcommand — differ
 * in vocabulary (arguments versus flags) and in failure shape (a thrown error versus
 * an exit code), so they cannot share a whole message. What they must never differ on
 * is WHY a value was refused: those sentences were copied between the two files and
 * had already drifted apart in wording, which is the same "one rule, two copies"
 * shape that produced every behaviour defect on this surface.
 *
 * Each caller wraps these in its own vocabulary and names its own next step.
 */

/** Why a deployment cannot be recorded into the mapping while a committed file holds the project. */
export const COMMITTED_IS_HAND_AUTHORED = `edit that file directly — this server reads a committed ${COMMITTED_CONFIG_FILE} and never writes one`;

/**
 * The deployment a record holds that this write could not adopt.
 *
 * Returned as a clause rather than a whole sentence so each writer keeps its own
 * instruction. Empty when there is nothing stranded, so a caller can concatenate it
 * unconditionally.
 */
export function strandedBaseUrlClause({
  recordedBaseUrl,
  strandedReason,
  unusableRecordedProjectUrl,
}: {
  recordedBaseUrl?: string;
  strandedReason?: 'cannot-serve' | 'no-project' | 'unusable-project' | 'different-project';
  unusableRecordedProjectUrl?: string;
}): string {
  if (!recordedBaseUrl) {
    return '';
  }
  // Said as the planner decided it. Guessing between these — "it was recorded for a
  // different project" for an entry that names NO project — tells the user a false
  // fact about a record they are looking at.
  const why =
    strandedReason === 'cannot-serve'
      ? `it cannot serve this project, so it was set aside`
      : strandedReason === 'no-project'
        ? `that entry names no project at all, so nothing says which project it serves`
        : strandedReason === 'unusable-project'
          ? `the project URL recorded beside it (${unusableRecordedProjectUrl}) is not a usable URL, so nothing says that deployment serves the project you are recording`
          : `it was recorded for a different project, so it does not carry over`;
  // The invitation applies only where re-supplying the value could work. For
  // 'cannot-serve' the pair rule rejects that exact value, so "pass it explicitly to
  // confirm it" is an instruction that is refused every time it is followed.
  const invitation =
    strandedReason === 'cannot-serve'
      ? ' Supply the deployment that does serve this project instead.'
      : ' If it IS the right deployment, pass it explicitly to confirm it.';
  return ` This directory's mapping already holds ${recordedBaseUrl} as a deployment, but ${why}.${invitation}`;
}
