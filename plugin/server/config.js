import { ToolError } from './tool-errors.js';
export const DEFAULT_BASE_URL = 'https://api.form.io';
/**
 * The Project URL, for the PERSON being asked for one.
 *
 * Every skill instructs the agent to relay the unconfigured report verbatim and ask for
 * the one value it names, so this text is read by a human — who is going to paste the URL
 * they already have. What they need is the definition and the shapes; what they were
 * getting was PROJECT_URL_GUIDANCE entire, a third of which is prohibitions written to
 * stop an AGENT constructing a URL it should have asked for. Relayed under a one-line
 * question, those read as guardrails for somebody else, and they made a three-line ask
 * eight lines long.
 *
 * The prohibitions are not lost: they stay in PROJECT_URL_GUIDANCE, which the server's
 * own instructions carry — and carry ALONE, so this text reaches no agent-only surface
 * and that one reaches no user. An agent with no skills installed still meets the
 * prohibitions at connect time, which is what they were written for.
 */
export const PROJECT_URL_FOR_A_USER = [
    'A Project URL is the full URL of one Form.io project.',
    `On Form.io's hosted cloud that is the project's name as a sub-domain of form.io: a project named examples is https://examples.form.io.`,
    'On a deployment you host it is either a sub-directory of that deployment (https://forms.mysite.com/myproject) or a sibling sub-domain of the same parent domain (https://myproject.mysite.com), depending on how that deployment routes projects.',
].join(' ');
/**
 * The same thing for an AGENT, with the rules that stop it building a URL rather than
 * asking for one. Carried by the server's instructions and by nothing else — never by a
 * report a user is shown; see PROJECT_URL_FOR_A_USER.
 *
 * Neither text explains the base URL, and that is deliberate. It is derived from
 * whichever project URL is about to be supplied, so guidance about it cannot be acted on
 * before that answer exists — and carrying it here made a message asking for one value
 * read as asking for two.
 */
export const PROJECT_URL_GUIDANCE = [
    'A Project URL is the full URL of one Form.io project — the project an application reads and writes.',
    `On Form.io's hosted cloud it is the project's name as a sub-domain of form.io: a project named examples is https://examples.form.io.`,
    'On a deployment the customer hosts, it is EITHER a sub-directory of that deployment (https://forms.mysite.com/myproject) OR a sibling sub-domain of the same parent domain (https://myproject.mysite.com), depending on how that deployment routes projects.',
    'A *.form.io host is never a Base URL, and https://api.form.io/<project> is not a hosted project URL. Never build a Project URL by appending a project name to a deployment URL — in the sub-domain shape the two hosts differ by design, so neither can be built from the other.',
].join(' ');
// WHY the one project-URL shape that derives nothing has to be asked about, in one
// clause. Every message that refuses or reports that shape composes this rather than
// paraphrasing it: the writers' refusals, the half-configured report, and the
// authentication error below all said it in slightly different words, which is the
// same rule expressed in four places.
export const BASE_URL_UNDERIVABLE = 'a project URL that carries no path on a customer domain names its deployment nowhere — there the deployment is a sibling sub-domain of the same parent domain — so it cannot be derived';
// The read path's fuller version. Deliberately names no example base URL: a reader
// who reaches this message has a project URL that is NOT on a form.io host — that is
// why it could not be derived — so citing api.form.io here would offer the one value
// that is certainly wrong for them, which is the failure the unresolved state exists
// to prevent.
export const BASE_URL_UNRESOLVED_GUIDANCE = [
    'A Base URL is the deployment hosting a project, and it is normally derived from the project URL rather than supplied — a project addressed as a sub-directory is served by its parent path, so https://forms.mysite.com/one/two is served by https://forms.mysite.com/one.',
    `But ${BASE_URL_UNDERIVABLE}. Ask the user for it.`,
].join(' ');
// Form.io URLs are compared and concatenated in several places, so they are
// stored without a trailing slash wherever they enter the process.
export function stripTrailingSlashes(url) {
    return url.replace(/\/+$/, '');
}
// Shared by the project_set tool and the bin's project command, so one
// definition of "a usable Form.io URL" serves both entry points.
//
// What comes back is what new URL() made of the input, never the raw input.
// Everything downstream compares these strings — the pinned project against the
// mapped one, the token cache against its key — and concatenates them into
// request URLs, so anything the parser considers insignificant has to be gone by
// then. Whitespace around a pasted URL passes validation but breaks fetch;
// host case is significant to string equality and to no one else, so
// https://Examples.form.io and https://examples.form.io must not be two
// deployments, two cache entries, or two projects. The parser normalizes both.
/**
 * A URL the CALLER just typed, as opposed to one read from a record.
 *
 * The distinction decides the exit code, and the codes are a contract the skills
 * branch on: a mistyped Project URL is the user typing the wrong thing, so the remedy
 * is to re-ask — the same reasoning that already puts the API-root and Open Source
 * refusals on exit 1. A malformed value read from disk is a different thing entirely
 * and stays "could not answer", because no answer from the user fixes a broken record.
 */
export class InvalidRequestedUrlError extends ToolError {
    constructor(message) {
        super({ code: 'INVALID_ARGUMENT', message });
        this.name = 'InvalidRequestedUrlError';
    }
}
/**
 * normalizeHttpUrl for a value the caller just typed: a failure is an
 * InvalidRequestedUrlError naming the value AS TYPED. The parser's own message reports
 * only what it made of the value ("got: htps:"), which tells a reader the scheme was
 * wrong but not which argument carried it.
 */
export function normalizeRequestedUrl(raw, label) {
    try {
        return normalizeHttpUrl(raw, label);
    }
    catch (error) {
        throw new InvalidRequestedUrlError(`${error instanceof Error ? error.message : String(error)} (${label} was ${raw})`);
    }
}
export function normalizeHttpUrl(input, label) {
    let parsed;
    try {
        parsed = new URL(input.trim());
    }
    catch {
        throw new Error(`${label} must be a valid URL, got: ${input}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`${label} must use http or https, got: ${parsed.protocol}`);
    }
    // `api.form.io.` and `api.form.io` are the same host — the trailing root dot is
    // legal, resolves identically, and is invisible to a user. Removed HERE, at the one
    // place every URL enters, so every downstream comparison sees one spelling: the
    // pair rule, the token-cache key, and string equality between records. Handled
    // instead inside individual rules, it fixed those rules and left the others
    // treating one deployment as two.
    //
    // The scheme is deliberately NOT normalized: http and https to the same host are
    // different endpoints, and one of them sends credentials in plaintext.
    if (parsed.hostname.endsWith('.') && parsed.hostname !== '.') {
        parsed.hostname = parsed.hostname.replace(/\.$/, '');
    }
    return stripTrailingSlashes(parsed.href);
}
// One behavior for every agent: no environment variable switches the defaults,
// because a server that reads its own launch mode cannot be packaged for hosts
// that have no way to set it.
export function getConfig() {
    const apiKey = process.env.FORMIO_API_KEY;
    const loginFormUrl = process.env.FORMIO_LOGIN_FORM;
    // Validated for the same reason the suggested project is: both plugin
    // manifests set this from a host variable, and an unsubstituted
    // "${FORMIO_BASE_URL}" is truthy. Taken raw it keys the token cache and builds
    // the portal-login URL, surfacing much later as an opaque "Failed to parse
    // URL" out of fetch.
    //
    // Left undefined when the environment supplies nothing usable, rather than
    // defaulted here. There is no default to apply: resolution DERIVES the base URL
    // from the project URL — DEFAULT_BASE_URL for a form.io host, the parent path for
    // a sub-directory project — and leaves it unresolved for the one shape that
    // derives nothing. A value pre-filled here would be indistinguishable from an
    // explicit FORMIO_BASE_URL=https://api.form.io, which is a candidate the resolver
    // ranks and gates rather than a fallback it reaches for.
    const baseUrl = readHttpUrlEnv({ raw: process.env.FORMIO_BASE_URL, name: 'FORMIO_BASE_URL' });
    // Deliberately optional. Clients and directory crawlers launch the server with
    // no configuration to read tools/list, so failing at startup made it look like
    // a server with no tools. resolveProjectConfig raises the error instead, at
    // the point the project URL is actually needed and with guidance the caller
    // can act on.
    //
    // Anything unusable — empty because the user cleared an optional prompt, or a
    // literal the client never substituted — is dropped rather than kept, because
    // this field PINS the server: kept, it would resolve to nothing on every call
    // and no project_set mapping could redirect it.
    const projectUrl = readHttpUrlEnv({
        raw: process.env.FORMIO_PROJECT_URL,
        name: 'FORMIO_PROJECT_URL',
    });
    return {
        baseUrl,
        projectUrl,
        apiKey: apiKey || undefined,
        loginFormUrl: loginFormUrl || undefined,
        jwt: undefined,
        authHost: process.env.FORMIO_AUTH_HOST || undefined,
        authPort: parsePositiveInt(process.env.FORMIO_AUTH_PORT),
        authTimeoutMs: readTimeoutMs(process.env.FORMIO_AUTH_TIMEOUT),
        requestTimeoutMs: readTimeoutMs(process.env.FORMIO_REQUEST_TIMEOUT),
        forceBrowser: readBooleanEnv(process.env.FORMIO_FORCE_BROWSER),
        insecureTls: readBooleanEnv(process.env.FORMIO_INSECURE_TLS),
    };
}
export function readHttpUrlEnv({ raw, name, onIgnored = (message) => process.stderr.write(`${message}\n`), }) {
    if (!raw) {
        return undefined;
    }
    try {
        return normalizeHttpUrl(raw, name);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onIgnored(`Ignoring ${name}: ${message}`);
        return undefined;
    }
}
/**
 * The one reading of a boolean environment variable: after trimming, `true` or `1`
 * in any case is true, and every other value — unset included — is false. Shared
 * so that every such variable accepts the same spellings; a value that works for
 * one and is silently ignored by another is a setting nobody can rely on.
 */
export function readBooleanEnv(raw) {
    const normalized = (raw ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
}
function parsePositiveInt(raw) {
    if (!raw) {
        return undefined;
    }
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : undefined;
}
/** The longest delay a Node timer holds; a longer one overflows and fires at once. */
const MAX_TIMER_MS = 2_147_483_647;
// A timeout in seconds, as milliseconds: a positive integer that a timer can hold.
// Anything else — including a wait too long for a timer — is ignored, so the default
// applies rather than a timer that fires immediately.
function readTimeoutMs(raw) {
    const seconds = parsePositiveInt(raw);
    const ms = seconds === undefined ? undefined : seconds * 1000;
    return ms !== undefined && ms <= MAX_TIMER_MS ? ms : undefined;
}
