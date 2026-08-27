import { DEFAULT_BASE_URL, stripTrailingSlashes } from './config.js';

/**
 * The pair rule, stated once for every reader and writer.
 *
 * A record holds a project and its deployment as a PAIR, and two pairs are not
 * configurations at all: a project URL that is the hosted cloud's own API root (the
 * deployment URL pasted where a project URL belongs), and a pair that collapses onto
 * one server (the Open Source install, which has no project layer). Both writers
 * refuse them before anything is recorded; the resolver refuses them at the point of
 * use, because a hand-written formio.json, a hand-edited mapping entry, and the
 * environment never pass through a writer.
 *
 * One function answers for all of them. The check written once for writes and again
 * for reads is how a derived collapse escaped the read-side copy.
 */
export type PairValidity =
  | 'ok'
  | 'not-a-project-url'
  /** A form.io host that is not a project: the apex, the site, the portal, or a path. */
  | 'not-a-hosted-project'
  | 'open-source-deployment'
  | 'hosted-project-foreign-deployment'
  /** A project whose deployment is derivable, paired with a different one. */
  | 'underivable-mismatch'
  | 'api-root-deployment';

/**
 * Which HALF of the pair a verdict is about.
 *
 * It decides what a reader does with a record it cannot use: a verdict about the
 * deployment leaves a usable project behind, and for the one shape where the right
 * deployment is knowable the reader supplies it rather than failing. A verdict about
 * the project leaves nothing to stand on.
 */
export function faultedHalf(validity: Exclude<PairValidity, 'ok'>): 'project' | 'deployment' {
  return validity === 'hosted-project-foreign-deployment' ||
    validity === 'api-root-deployment' ||
    validity === 'underivable-mismatch'
    ? 'deployment'
    : 'project';
}

/** Said the same way by every message that refuses this pair. */
export const ENTERPRISE_ONLY =
  'The Form.io Agentic Coding tools are built for the Form.io Enterprise Server, and this configuration names an Open Source one. A Base URL identical to the Project URL means a server with no project layer: Open Source serves one set of forms at its own root, while every tool here addresses a project UNDER a deployment — project roles, actions, stages, imports and exports have no counterpart there. Point this directory at a project on a Form.io Enterprise deployment, or at a project on the hosted cloud (https://<project>.form.io, served by https://api.form.io).';

/** Said the same way wherever a form.io host that is not a project is offered as one. */
export const NOT_A_HOSTED_PROJECT = `On Form.io's hosted cloud a Project URL is the project's own name as a sub-domain of form.io and nothing more — https://examples.form.io, with no path after it. form.io itself, www.form.io and portal.form.io are not projects, and a project name appended as a path (https://examples.form.io/myproject) is not one either: the project is already named by the sub-domain. Ask the user which project, and record that.`;

/** Said the same way by every message that refuses the API root as a project URL. */
export const API_ROOT_NOT_A_PROJECT =
  "the Form.io hosted cloud's API root — the Base URL every project on it shares — not a project URL. On the hosted cloud a Project URL is the project's own name as a sub-domain of form.io, e.g. https://examples.form.io, and its Base URL is derived from that. Ask the user which project, and record that.";

/** Said the same way wherever a derivable deployment is contradicted by a recorded one. */
export const DEPLOYMENT_IS_DERIVED = `A project addressed as a sub-directory is served by its parent path, so its deployment is read off the project URL rather than recorded — and a different value cannot be right. Record the project URL alone; its deployment is derived.`;

/** Said the same way wherever a customer project is paired with the hosted cloud. */
export const API_ROOT_IS_NOT_YOUR_DEPLOYMENT = `${DEFAULT_BASE_URL} is the Form.io hosted cloud, which serves only the projects on it — the ones addressed as a sub-domain of form.io. A project on any other domain is served by its own deployment, so this value would send the portal login and the cached token to a deployment you do not use. Ask the user for the deployment that hosts this project, or record the project URL alone where its deployment can be derived.`;

/** Said the same way wherever a hosted project is paired with something else. */
export const HOSTED_CLOUD_DEPLOYMENT = `A project on a form.io host is served by ${DEFAULT_BASE_URL} and by nothing else — that is what makes the Project URL the whole configuration for a hosted project — and a *.form.io host is never a Base URL. Record the project URL alone; its deployment is derived.`;

// A project URL's host tells us whether DEFAULT_BASE_URL can possibly be right.
// The hosted cloud is the only deployment whose base URL is a constant, and it
// is api.form.io for every project on it — so a project sub-domain of form.io
// implies it, and nothing else does.
// The host, in the one form every comparison here uses. `https://api.form.io./p` is
// the same host as `https://api.form.io/p` — the trailing root dot is legal, resolves
// identically, and compared exactly it slipped past every rule in this module: the API
// root was recorded as a project, and as a customer project's deployment.
function hostOf(url: URL): string {
  return url.hostname.replace(/\.$/, '');
}

// The hosts on form.io that are not projects. A project URL is a project's own
// sub-domain, so the apex is not one, and neither are the sub-domains Form.io serves
// its own site and portal from — pasted into a project prompt they were accepted and
// resolved to api.form.io, surfacing later as unexplained 404s. `api` is absent here
// deliberately: it is the API root, and it has its own diagnosis.
const RESERVED_FORMIO_HOSTS: ReadonlyArray<string> = ['form.io', 'www.form.io', 'portal.form.io'];

function isFormioHost(url: URL): boolean {
  const host = hostOf(url);
  return host === 'form.io' || host.endsWith('.form.io');
}

// A project on the hosted cloud is a project's own sub-domain and NOTHING else: no
// path, and not one of the hosts Form.io serves its own site, portal and API from.
// The path clause matters as much as the host one — `https://examples.form.io/myproject`
// was accepted, derived https://api.form.io, and then addressed every request at
// .../myproject/..., which is the unexplained-404 failure the API-root refusal exists
// to prevent. The server's own guidance says a project name is never appended to a URL.
function isHostedCloudProject(projectUrl: URL): boolean {
  return (
    isFormioHost(projectUrl) &&
    !RESERVED_FORMIO_HOSTS.includes(hostOf(projectUrl)) &&
    // `new URL('https://examples.form.io').pathname` is '/', never '' — so this
    // compares what a bare host actually yields. Written as `=== ''` it rejected
    // every legitimate hosted project.
    stripTrailingSlashes(projectUrl.pathname) === ''
  );
}

// The hosted cloud's API root, identified by HOST rather than by the exact string
// DEFAULT_BASE_URL. http://api.form.io and https://api.form.io/<name> are the same
// mistake — the deployment URL offered where a project URL belongs — and an exact
// compare accepted both, recording the deployment root as the active project and
// producing the unexplained 404s this refusal exists to prevent. Compared as a
// whole hostname, never as a suffix, so a lookalike host is a different deployment.
function isApiRootHost(url: URL): boolean {
  return hostOf(url) === hostOf(new URL(DEFAULT_BASE_URL));
}

// A sub-directory-routed project URL is its deployment plus exactly ONE
// segment — the project's name — so the deployment is the project URL's parent,
// not its origin. Those coincide only for a single-segment path: a deployment
// mounted at https://forms.mysite.com/one serves project `two` at
// https://forms.mysite.com/one/two, and flattening that to the origin would
// build the portal login and ${baseUrl}/current against a host root that serves
// neither. Returns undefined when there is no path to take a parent of.
function deriveBaseUrlFromProjectPath(projectUrl: URL): string | undefined {
  const segments = projectUrl.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }
  const parentPath = segments.slice(0, -1).join('/');
  return stripTrailingSlashes(`${projectUrl.origin}${parentPath ? `/${parentPath}` : ''}`);
}

// The base URL a project URL names by itself, or undefined where it names none.
//
// Three shapes and no fourth: the hosted cloud is one constant deployment, a project
// addressed as a sub-directory is served by its parent path, and a path-less project
// URL on a customer domain names no deployment anywhere — its deployment is a sibling
// sub-domain, so it has to be supplied rather than guessed. Exported because the
// reader and the writers ask the same question and must get the same answer.
export function deriveBaseUrl(projectUrl: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(projectUrl);
  } catch {
    return undefined;
  }
  if (isHostedCloudProject(parsed)) {
    return DEFAULT_BASE_URL;
  }
  return deriveBaseUrlFromProjectPath(parsed);
}

/**
 * Whether a normalized pair is a configuration this toolset serves.
 *
 * `baseUrl` is the EFFECTIVE deployment — the recorded one, or the derived one where
 * the record holds none — because every verdict here is about what the tools would
 * target, not about what happens to be written down. https://api.form.io derives
 * itself, so a record holding it as the project with no deployment beside it
 * collapses exactly as a recorded pair does.
 *
 * The API-root question is asked first: that host IS a form.io host, so it derives
 * itself and the pair collapses — but "you are on the Open Source server" is the
 * wrong diagnosis for it, and it is the likeliest mistake on this surface.
 */
export function classifyPair(projectUrl: string, baseUrl: string | undefined): PairValidity {
  let parsedProject: URL;
  try {
    parsedProject = new URL(projectUrl);
  } catch {
    // Not a URL at all. Every caller normalizes before reaching here, so this is the
    // shape no verdict of this module is about; the caller's own URL validation owns it.
    return 'ok';
  }
  if (isApiRootHost(parsedProject)) {
    return 'not-a-project-url';
  }
  // A form.io host that is not a project: the apex, the site, the portal, or a
  // project sub-domain carrying a path. Excluding these from `isHostedCloudProject`
  // stopped them DERIVING api.form.io, but nothing refused them — so they were still
  // recorded as the active project, and the path-less ones were then described to the
  // user as "a project URL that carries no path on a customer domain", which is false
  // of a form.io host and invites a Base URL that is accepted and equally wrong.
  if (isFormioHost(parsedProject) && !isHostedCloudProject(parsedProject)) {
    return 'not-a-hosted-project';
  }
  // WHEREVER the deployment is derivable, the derivation IS the definition — so a
  // recorded value that differs from it cannot be right, and left in place it becomes
  // the portal-login URL and the token-cache key for a deployment the user does not
  // use. This was enforced for a hosted project and for nothing else, so the OTHER
  // derivable shape — a project addressed as a sub-directory — accepted any
  // deployment at all, silently, with the writer and the reader agreeing on it.
  //
  // Asked BEFORE the collapse below, because one wrong value satisfies both: a
  // project recorded as its own deployment. "You are on the Open Source server" is
  // impossible where the deployment is knowable, and that verdict faults the PROJECT
  // half — so asked in the other order this one value failed every tool call for the
  // directory, while every other wrong deployment resolved to the derived one. The
  // narrower, knowable diagnosis wins wherever both apply.
  // Asked FIRST, and of the recorded values themselves. Asked after the derivation
  // questions below, it became unreachable for every project URL that carries a
  // path — because a derived deployment is always a strictly shorter parent, so the
  // two can never be equal there — and an Open Source install mounted at a sub-path,
  // an ordinary deployment shape, was diagnosed as a derivation mismatch. The remedy
  // for THAT verdict says "record the project URL alone", which succeeds and stores a
  // host root serving nothing.
  // Deployment-half verdicts first, but ONLY where they are the better diagnosis:
  // a hosted project paired with anything (including itself) is a wrong deployment
  // for a project the server can serve, never an Open Source install — that verdict
  // is impossible for a form.io host and faults the project half, which failed every
  // call for the directory rather than deriving the deployment already known.
  // Compared against the one deployment that serves a hosted project. The spelling
  // variant that used to defeat this — a trailing root dot — is normalized where URLs
  // enter the process, so one comparison is enough here; a different SCHEME is a
  // different endpoint and belongs on the refusing side of this line.
  if (baseUrl && isHostedCloudProject(parsedProject) && baseUrl !== DEFAULT_BASE_URL) {
    return 'hosted-project-foreign-deployment';
  }
  // Only for a project the hosted cloud does NOT serve — for one it does, api.form.io
  // is the right answer, and the branch above has already accepted it.
  if (baseUrl && !isHostedCloudProject(parsedProject) && isApiRootHost(new URL(baseUrl))) {
    return 'api-root-deployment';
  }
  // Then the collapse, asked of the RECORDED values. Asked after the derivation
  // question below it became unreachable for every project URL carrying a path —
  // a derived deployment is always a strictly shorter parent, so the two can never be
  // equal there — and an Open Source install mounted at a sub-path, an ordinary
  // shape, was diagnosed as a derivation mismatch whose remedy ("record the project
  // URL alone") succeeds and stores a host root that serves nothing.
  if (baseUrl && projectUrl === baseUrl) {
    return 'open-source-deployment';
  }
  const derivable = deriveBaseUrl(projectUrl);
  if (baseUrl && derivable && baseUrl !== derivable) {
    return 'underivable-mismatch';
  }
  return 'ok';
}
