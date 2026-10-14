import { SERVER_DIRECTORY } from './workspace-directory.js';
import { COMMITTED_CONFIG_FILE } from './committed-config.js';
import { BASE_URL_UNDERIVABLE, PROJECT_URL_FOR_A_USER, normalizeHttpUrl, } from './config.js';
import { ProjectNotConfiguredError, resolveProject, } from './project-resolver.js';
/**
 * How to NAME the environment as the record that holds the project, as a noun phrase.
 *
 * Only the environment needs naming this way: both readers answer the committed and
 * mapping records with their own wording and return before reaching here. It exists
 * because the environment clause differs per reader — the two stand in different
 * processes, so telling an agent its project came from "this shell" sends it hunting
 * for a variable no shell it can reach holds (see `environmentLocation`).
 *
 * Typed to the one source it serves rather than accepting all three and branching:
 * the other two branches were unreachable, and an unreachable branch is a wording
 * nobody reads and nobody updates.
 */
export function environmentRecordName(environmentLocation) {
    return `FORMIO_PROJECT_URL in ${environmentLocation}`;
}
/**
 * How every report spells "this directory has a project and no deployment".
 *
 * Named because two readers print it and a writer now prints it too, and a caller
 * matching on the line has one string to match rather than three spellings of it.
 */
export const BASE_URL_NOT_DETERMINED = 'could not be determined.';
/**
 * How every report spells "the domain rules were waived for this pair", up to the point
 * where the two readers differ.
 *
 * The FACT is shared, like every other fact in this report: a forced pair looks like a
 * resolver bug wherever it appears unexplained. What differs is what to do about it,
 * and here the difference is not vocabulary but AUTHORITY. Clearing the record is the
 * only destructive operation on this surface, and the override it destroys is a
 * developer's decision that nothing else on the machine records — so a shell reader is
 * handed the command and an agent running this report as a routine preflight is told
 * whose call it is. Printed for both, an agent acting on a line in an `ok` report wiped
 * an override it was never asked to touch, and `--reset` exits 0, so it reported
 * success.
 *
 * The way back is the reset rather than "record it again without --force": an unforced
 * write of the same pair is no change at all, so the override survives it — the note
 * this replaces named that call, which reported success and changed nothing.
 */
export const FORCED_PAIR_FACT = 
// The flag alone, never spelled as "`project set --force`": the CLI's own remedy
// appends the runnable reset command, and a reader — or a test — scanning that line
// for the command it names would find that phrase first and try to run it.
`this pair was recorded with --force, so the Project URL / Base URL domain rules were skipped for it. Re-recording the same pair without --force changes nothing and keeps the override.`;
// A losing record's values are never validated — a record that cannot win takes no
// part in the answer, so failing the whole resolution over one would fail a directory
// for a value nothing reads. But they are ECHOED here, so an unusable one is labelled
// rather than printed as though it were a URL somebody could act on.
function describeCandidate(value) {
    try {
        normalizeHttpUrl(value, 'value');
        return value;
    }
    catch {
        return `${value} (not a usable URL)`;
    }
}
// The resolver signals "nothing configured" by throwing, which is the right
// shape for a tool handler and the wrong one for a reporting command. An
// unreadable map is a different answer than an unmapped directory, though:
// reporting it as "nothing configured" sends the caller to `project set`, whose
// rewrite is what destroys the other mappings. It travels to the caller instead,
// which turns it into that caller's own failure shape.
function resolveOrNull(cwd, baseConfig, { cacheDir, onNote, onUnpaired, }) {
    // A relative cwd is rejected by resolveProject itself, with a plain Error that the
    // catch below passes straight through — "nothing is mapped" is only ever the
    // ProjectNotConfiguredError. A second copy of that check here said the same thing
    // in a second place, which is the shape every defect on this surface has had.
    try {
        return resolveProject(cwd, baseConfig, { cacheDir, onNote });
    }
    catch (error) {
        // ONLY "nothing is configured here" becomes a report. Everything else travels to
        // the caller, which turns it into that caller's own failure shape.
        //
        // Catching by exclusion — "anything that is not one of these two record errors means
        // nothing is mapped" — made every error added afterwards silently become an
        // interview, which writes a record the real problem still shadows. Naming the one
        // answer instead means a new failure surfaces as a failure by default.
        if (error instanceof ProjectNotConfiguredError) {
            // A deployment found with no project beside it is reported on this status too.
            // Hardcoding an empty list here was the one answer that accounted for it
            // nowhere — and its own remedy overwrites the entry holding it.
            onUnpaired(error.unpaired);
            return null;
        }
        throw error;
    }
}
export function reportProject({ cwd, baseConfig, cacheDir, remedies, notes, cwdWasNamed = true, guessedDirectory = SERVER_DIRECTORY, }) {
    // The caller's own array, appended to in place. A note is often the CAUSE of the
    // failure it accompanies, and resolution can THROW after emitting one — an ignored
    // formio.json on the walk, then an unreadable map — so a private copy here left the
    // caller rendering the second problem with no sight of the first.
    const unconfiguredUnpaired = [];
    const resolution = resolveOrNull(cwd, baseConfig, {
        cacheDir,
        onNote: (message) => notes.push(message),
        onUnpaired: (values) => unconfiguredUnpaired.push(...values),
    });
    if (!resolution) {
        return {
            status: 'not-configured',
            cwd,
            // No call is offered for a directory the caller did not name: this answer is
            // about the server's own working directory, the message says to call again with
            // the user's cwd BEFORE recording anything, and a remedy carrying this directory
            // as an argument contradicts that — the write succeeds, and every later call,
            // which does pass the user's cwd, resolves nothing. The schema tells agents to
            // act on `remedy` rather than parse the message, so the warning has to be
            // structural rather than prose.
            ...(cwdWasNamed
                ? { remedy: { tool: 'project_set', arguments: { cwd }, supply: ['projectUrl'] } }
                : {}),
            shadowed: [],
            unpaired: unconfiguredUnpaired,
            notes: [...notes],
            message: [
                `No Form.io project is configured for ${cwd}, and no ${COMMITTED_CONFIG_FILE} was found by walking up from it.`,
                // Which directory was searched is the whole answer when the caller named
                // none: the remedy below records the project under it, and recording it
                // under the wrong one is invisible — the write succeeds, and the next
                // call, which does name a directory, resolves nothing again.
                ...(cwdWasNamed
                    ? []
                    : [
                        `That is ${guessedDirectory}, and it is the only directory searched because no cwd argument was passed and the client named no directory. If it is not where the user is, call this again with cwd set to their directory BEFORE recording anything — a project recorded here would not be found from theirs.`,
                    ]),
                // Named only where the caller chose the directory. Otherwise the one next
                // step is the warning above — call again with the user's own cwd — and a
                // fully-specified call naming THIS directory contradicts it in the channel
                // the skills actually relay.
                // Named before the remedy, because that remedy REPLACES the entry holding
                // it: a value overwritten without ever being shown is one the user cannot
                // get back or account for.
                ...(unconfiguredUnpaired.length
                    ? [``, `Unpaired:    ${unconfiguredUnpaired.join(' ')}`, ``]
                    : []),
                ...(cwdWasNamed ? remedies.setProject(cwd) : []),
                ``,
                PROJECT_URL_FOR_A_USER,
            ]
                .filter(Boolean)
                .join('\n'),
        };
    }
    const { config: resolved, sources } = resolution;
    const committedPath = resolution.committedFilePath;
    // The caller named no directory, so this answer is about the fallback one. The
    // unmapped branch above already says it as part of its remedy; a RESOLVED
    // answer needs it just as much, because the tool's fallback is the server's own
    // process cwd — fixed at spawn, and for a plugin- or desktop-launched server
    // nowhere near the user. Reported confidently and silently, it names a project
    // for a directory nobody asked about, and the next call, which does pass a cwd,
    // targets a different one.
    //
    // Except where the directory decided nothing. A project from the environment
    // resolves identically for EVERY directory, so the fallback is not part of that
    // answer — which is why resolveProject suppresses its own copy of this note on
    // the same condition. Said anyway, it hangs a caution on an answer that is
    // correct everywhere, and the skills relay notes to the user as causes.
    //
    // A HALF-configured answer is the exception to that exception, whatever supplied
    // the project: its remedy records a base URL as a per-directory mapping, so the
    // directory is part of that answer even when the project is not. Silent, the
    // remedy named the server's own directory as though the caller had chosen it, and
    // the next call — which does pass a cwd — reaches the same status again with the
    // mapping stranded where nothing reads it.
    const baseUrlIsUnresolved = sources.baseUrl === 'unresolved';
    if (!cwdWasNamed && (sources.projectUrl !== 'environment' || baseUrlIsUnresolved)) {
        notes.push(`No cwd argument was passed and the client named no directory, so this answer is about ${cwd}, ${guessedDirectory}. Pass cwd, set to the user's directory, on later Form.io tool calls.`);
    }
    // Every layer that COULD have supplied the project, in precedence order, so a
    // losing one can be reported rather than silently omitted. "My project_set did
    // nothing" is otherwise unanswerable from this output.
    const shadowed = [];
    if (sources.projectUrl !== 'committed' && resolution.candidates.committed) {
        shadowed.push(`a committed ${COMMITTED_CONFIG_FILE} naming ${describeCandidate(resolution.candidates.committed)}`);
    }
    // The mapping's project URL is the one echoed value that is raw, hand-editable disk
    // content — committed and environment values are normalized before they reach
    // here — so it is the one most likely to need the label, and it was the one value
    // not getting it: an unusable project URL read as a real alternative target beside
    // a labelled sibling.
    if (sources.projectUrl !== 'mapping' && resolution.candidates.mapping) {
        shadowed.push(`the working-directory mapping naming ${describeCandidate(resolution.candidates.mapping)}`);
    }
    if (sources.projectUrl !== 'environment' && resolution.candidates.environment) {
        shadowed.push(`FORMIO_PROJECT_URL in ${remedies.environmentLocation} naming ${describeCandidate(resolution.candidates.environment)}`);
    }
    // A deployment recorded with NO project beside it is a different thing from a
    // shadowed one, and saying "overridden by the record above" about it is simply
    // false: nothing outranked it, and nothing could — it names no project, so nothing
    // says which project it serves and it cannot be read at all. Reported on its own
    // line, because the reader's next move differs: a shadowed value is in the wrong
    // RECORD, an unpaired one is an incomplete record.
    const unpaired = [];
    // A base URL in the WINNING record that went unused was not outranked — nothing
    // outranks the record that won. It was rejected by the pair rule, and the note the
    // resolver emitted says so, names the record, and names the value. Listing it here
    // as "overridden by the source above" told a second, false story — and only for the
    // committed record, since a winning mapping or environment record is excluded by
    // the project-source gates below. The note is the one account, for all three.
    //
    // A base URL in a LOSING record is a different thing: it belongs to that record's
    // project, so it is reported as shadowed along with it rather than as a competing
    // value of its own — unless that record holds no project, which makes it unpaired.
    if (sources.projectUrl !== 'mapping' && resolution.baseUrlCandidates.mapping) {
        (resolution.candidates.mapping ? shadowed : unpaired).push(resolution.candidates.mapping
            ? `the mapped base URL naming ${describeCandidate(resolution.baseUrlCandidates.mapping)}`
            : `${cwd} has ${describeCandidate(resolution.baseUrlCandidates.mapping)} mapped as a deployment with no project beside it`);
    }
    if (sources.projectUrl !== 'environment' && resolution.baseUrlCandidates.environment) {
        (resolution.candidates.environment ? shadowed : unpaired).push(resolution.candidates.environment
            ? `FORMIO_BASE_URL in ${remedies.environmentLocation} naming ${describeCandidate(resolution.baseUrlCandidates.environment)}`
            : `FORMIO_BASE_URL in ${remedies.environmentLocation} names ${describeCandidate(resolution.baseUrlCandidates.environment)} with no FORMIO_PROJECT_URL beside it`);
    }
    // Half-configured is its own answer, and its own status. The project URL
    // resolved and its deployment did not — a path-less customer project names no
    // host to derive one from — so reporting the api.form.io default here would
    // present a guess as configuration. Not "not-configured": the remedy is the
    // base URL alone, not the project interview that status sends the caller into.
    if (baseUrlIsUnresolved) {
        return {
            status: 'base-url-unresolved',
            cwd,
            // The same write the prose names, as arguments. A deployment goes beside its
            // project, so which remedy this is depends on the record that holds it — and
            // for a committed file there is no call to carry: the fix is an edit to that
            // file, which the message names by path and key. project_set writes only the
            // machine-local mapping.
            // Omitted for a committed project (no call performs a file edit) and for a
            // directory the caller did not name (the message says to call again with the
            // user's cwd first, and a remedy naming this one contradicts it).
            ...(sources.projectUrl !== 'committed' && cwdWasNamed
                ? {
                    remedy: {
                        tool: 'project_set',
                        arguments: sources.projectUrl === 'mapping'
                            ? { cwd }
                            : { cwd, projectUrl: resolved.projectUrl },
                        supply: ['baseUrl'],
                    },
                }
                : {}),
            projectUrl: resolved.projectUrl,
            projectUrlSource: sources.projectUrl,
            baseUrlSource: sources.baseUrl,
            shadowed,
            unpaired,
            notes: [...notes],
            message: [
                `Project URL: ${resolved.projectUrl}`,
                `Base URL:    ${BASE_URL_NOT_DETERMINED}`,
                `Directory:   ${cwd}`,
                ``,
                `The project is configured — only its Base URL is missing: ${BASE_URL_UNDERIVABLE}.`,
                // A record holds a project and its deployment together. An entry holding only a
                // deployment — the shape an earlier release wrote for a project kept elsewhere —
                // names no project, so nothing says which project it serves and it cannot be
                // read. Named here because it IS the value the user is being asked for again,
                // and the remedy below replaces the entry that strands it.
                // The Unpaired line below states WHAT is stranded. This says what the remedy
                // does about it, which is the part that differs by record: a mapping write
                // replaces the entry, while an edit to a committed file never touches the map —
                // and claiming otherwise left the entry in place after the user had been told
                // it was gone.
                ...(!resolution.candidates.mapping &&
                    resolution.baseUrlCandidates.mapping &&
                    // Gated with the remedy it describes. Unconditional, it promised a write
                    // "below" in the same message that omits every remedy and warns against
                    // recording anything under this directory.
                    cwdWasNamed
                    ? [
                        ``,
                        sources.projectUrl === 'committed'
                            ? `The ${COMMITTED_CONFIG_FILE} edit below leaves that entry alone; remove it by recording a project for this directory, or leave it — it changes nothing.`
                            : `The write below records the pair for this directory and replaces that entry.`,
                    ]
                    : []),
                // The remedy below records the Base URL under a directory, so the caller
                // has to know when that directory is a fallback rather than one they chose —
                // exactly as the unmapped branch says it. The project may resolve the same
                // everywhere; the record about to be written does not.
                ...(cwdWasNamed
                    ? []
                    : [
                        `That directory is ${guessedDirectory}, and it is the only directory this answer is about because no cwd argument was passed and the client named no directory. If it is not where the user is, call this again with cwd set to their directory BEFORE recording anything — a Base URL recorded here would not be found from theirs.`,
                    ]),
                // Gated for the same reason, and on the same condition, as the structured
                // remedy above: a remedy that records a deployment under a directory the
                // caller did not choose is the write this answer just warned against.
                ...(cwdWasNamed
                    ? remedies.setBaseUrl({
                        cwd,
                        projectUrlSource: sources.projectUrl,
                        projectUrl: resolved.projectUrl,
                        ...(committedPath ? { committedFilePath: committedPath } : {}),
                    })
                    : []),
                // "Why is the base URL I recorded not in effect?" is exactly the question this
                // answer provokes, and the losing record is the answer to it. Computed for every
                // status but rendered only into the resolved one, it was missing from the report
                // that most needs it.
                ...(shadowed.length
                    ? [``, `Shadowed:    ${shadowed.join('; ')} — overridden by the record above.`]
                    : []),
                ...(unpaired.length
                    ? [
                        ``,
                        `Unpaired:    ${unpaired.join('; ')} — nothing says which project it serves, so it is ignored.`,
                    ]
                    : []),
                ``,
                `This blocks JWT authentication, which builds the portal-login URL from the Base URL and keys the cached token by it. An API key needs no Base URL and is unaffected.`,
            ].join('\n'),
        };
    }
    // Reports which side of the resolver's precedence supplied each URL. Without
    // it, an environment value silently overriding a mapping that looks correct on
    // disk is undiagnosable.
    //
    // Two answers, not one: the base URL resolves on its own terms — a pinned
    // project can be paired with a base URL that came from the mapping — so a
    // single "Source:" naming only where the project came from misattributes the
    // other line. The provenance is reported by the resolver rather than inferred
    // by comparing values here: an inferred answer credits the mapping whenever it
    // happens to hold the same string that won, and https://api.form.io is the
    // value most likely to be on both sides.
    const describe = (source, variable) => {
        if (source === 'environment') {
            return `${remedies.environmentLocation} (${variable}), the weakest source — a committed ${COMMITTED_CONFIG_FILE} or the working-directory mapping overrides it`;
        }
        if (source === 'mapping') {
            return `the working-directory mapping for ${cwd}`;
        }
        if (source === 'committed') {
            // Named by path, not by layer: the upward walk means the governing file is
            // usually not in the directory the caller is standing in, so "a committed
            // file" leaves "why this project?" unanswered.
            return `the committed ${COMMITTED_CONFIG_FILE} at ${committedPath ?? '(unknown path)'}`;
        }
        // One wording for every derivation: a form.io host implies api.form.io, and a
        // sub-directory project implies its parent. Both are read off the project URL,
        // which is what makes the project URL the single configuration.
        return `the project URL it was derived from — the base URL is not configured separately unless it cannot be derived`;
    };
    const projectSource = describe(sources.projectUrl, 'FORMIO_PROJECT_URL');
    const baseSource = describe(sources.baseUrl, 'FORMIO_BASE_URL');
    // Collapsed on the rendered clauses, not on the source enums: two values can
    // both come from `environment` and still come from *different variables*, and
    // printing the project's clause alone then credits the base URL to
    // FORMIO_PROJECT_URL — the attribution a reader of this output branches on.
    // Identical strings are the only case where one clause says everything.
    const source = projectSource === baseSource
        ? projectSource
        : `project URL from ${projectSource}; base URL from ${baseSource}`;
    // Kept whenever the mapping supplied any part of the answer, including a base
    // URL under a pinned project. Whether it says anything at all is the caller's
    // decision, because what it discloses is true of a shell and false of the
    // server itself.
    const caveat = [sources.projectUrl, sources.baseUrl].includes('mapping')
        ? remedies.environmentCaveat(cwd)
        : [];
    return {
        status: 'ok',
        cwd,
        projectUrl: resolved.projectUrl,
        baseUrl: resolved.baseUrl,
        projectUrlSource: sources.projectUrl,
        baseUrlSource: sources.baseUrl,
        shadowed,
        unpaired,
        ...(resolution.forced ? { forced: true } : {}),
        notes: [...notes],
        message: [
            `Project URL: ${resolved.projectUrl}`,
            `Base URL:    ${resolved.baseUrl}`,
            `Source:      ${source}`,
            // Only ever true of a forced record, and only a resolved pair can be one — so
            // this line appears exactly where the pair it explains is printed.
            ...(resolution.forced
                ? [`Forced:      ${FORCED_PAIR_FACT} ${remedies.forcedPair(cwd)}`]
                : []),
            ...(shadowed.length
                ? [`Shadowed:    ${shadowed.join('; ')} — overridden by the source above.`]
                : []),
            ...(unpaired.length
                ? [
                    `Unpaired:    ${unpaired.join('; ')} — nothing says which project it serves, so it is ignored.`,
                ]
                : []),
            ...caveat,
        ].join('\n'),
    };
}
