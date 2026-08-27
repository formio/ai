// One name per job, for the three uses that were once conflated under a single
// spelling. The rule lives in `api-skills-authoring` and binds every reference AND
// skill document:
//
//   1. A substitution slot            → `{projectUrl}` / `{baseUrl}`
//   2. A value passed between phases  → prose, or a `projectUrl` / `baseUrl` field
//   3. The environment variable       → `FORMIO_PROJECT_URL` / `FORMIO_BASE_URL`,
//                                       and ONLY where the subject is the environment
//
// Spelling a slot or a handoff value with an `FORMIO_*` name tells an agent to read
// an environment variable in order to build a URL — a different and wrong action,
// and one the plugin manifests guarantee will find nothing, because they set no
// environment at all.
//
// Kept as a pure function over already-read documents so the rule can be exercised
// against synthetic inputs as well as the shipped library.

export interface TerminologyDocument {
  path: string;
  body: string;
}

export interface TerminologyIssue {
  path: string;
  line: number;
  rule: string;
  message: string;
}

// The six ways an environment-variable name gets pressed into service as a slot.
// `${…}` and a bare `$…` are shell reads; `{…}`, `{{…}}` and `<…>` are
// substitution slots wearing the wrong name; `YOUR_…` is a fill-me-in placeholder.
const SLOT_SHAPES =
  /(\$\{FORMIO_(?:PROJECT|BASE)_URL\}|\$FORMIO_(?:PROJECT|BASE)_URL|\{\{FORMIO_(?:PROJECT|BASE)_URL\}\}|\{FORMIO_(?:PROJECT|BASE)_URL\}|<FORMIO_(?:PROJECT|BASE)_URL>|YOUR_FORMIO_(?:PROJECT|BASE)_URL)/g;

const BARE_NAME = /FORMIO_(?:PROJECT|BASE)_URL/;

// What makes a paragraph's subject the environment. Deliberately narrow: naming a
// client `env` block, an environment VARIABLE, the environment a value is read FROM,
// or the resolution order in which the environment is the weakest source.
//
// The bare word "environment" is not enough — "a typo or the wrong environment is the
// usual cause" is a sentence about a deployment, and accepting it let a handoff value
// keep a variable's name. "in the environment" IS enough: it names the place a value
// is read from, which is the whole subject of the rule, and the install documents
// that describe the resolution order say it that way.
//
// A bare "shell" is NOT enough either, for the same reason, and it was briefly
// accepted here: these documents mention a shell constantly — every runnable command
// sits in one — so it exempted most paragraphs in the library from the check. The
// case it was added for, "in this shell's environment", is already covered by the
// alternative below it.
const ENVIRONMENT_SUBJECT =
  /environment variable|`env`|env block|environment block|in (the|this) (server's own |shell's )?environment|weakest|resolution order|process\.env/i;

// Postman's own placeholder. Legitimate inside a code span or fence when a document
// is explaining the Postman mapping; unresolved in prose it is an endpoint root the
// reader cannot substitute.
const POSTMAN_PLACEHOLDER = /\{\{(?:baseUrl|projectName)\}\}/;

// Fenced blocks and inline code are stripped before the Postman check, exactly as
// the validation spec describes. The FORMIO_* rules deliberately still apply inside
// code: a slot in a template or a shell line is the case that does real damage.
function stripCode(text: string): string {
  return withoutFences(text).replace(/`[^`\n]*`/g, '');
}

// Fenced blocks only, with their line structure preserved so a reported line number
// still points at the line it was read from.
function withoutFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (block) => '\n'.repeat(block.split('\n').length - 1));
}

function paragraphsOf(body: string): { text: string; startLine: number }[] {
  const lines = body.split('\n');
  const paragraphs: { text: string; startLine: number }[] = [];
  let current: string[] = [];
  let start = 1;
  lines.forEach((line, index) => {
    if (line.trim() === '') {
      if (current.length) {
        paragraphs.push({ text: current.join('\n'), startLine: start });
        current = [];
      }
      return;
    }
    if (!current.length) {
      start = index + 1;
    }
    current.push(line);
  });
  if (current.length) {
    paragraphs.push({ text: current.join('\n'), startLine: start });
  }
  return paragraphs;
}

function lineNumberOf(body: string, needle: RegExp): number {
  const lines = body.split('\n');
  const index = lines.findIndex((line) => needle.test(line));
  return index === -1 ? 1 : index + 1;
}

export function urlTerminologyIssues(docs: readonly TerminologyDocument[]): TerminologyIssue[] {
  return docs.flatMap((doc) => {
    const issues: TerminologyIssue[] = [];

    doc.body.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(SLOT_SHAPES)) {
        issues.push({
          path: doc.path,
          line: index + 1,
          rule: 'slot.environment_variable_name',
          message: `"${match[0]}" spells a substitution slot with an environment-variable name; write {projectUrl} or {baseUrl}`,
        });
      }
    });

    // A bare mention is judged per PARAGRAPH of PROSE: the rule is about what the
    // surrounding text is talking about, and a table row or a bullet is its own
    // subject.
    //
    // Fenced blocks are excluded, and only from this rule. A fence that names one of
    // these variables is an environment block by construction — a client `env` map,
    // an `export` line, a Docker `-e` flag — and it carries no prose to state a
    // subject, so judged as prose it flagged every install document's own
    // configuration snippet. The SLOT rules above still reach inside code, which is
    // where a slot does its damage.
    for (const paragraph of paragraphsOf(withoutFences(doc.body))) {
      const withoutSlots = paragraph.text.replace(SLOT_SHAPES, '');
      if (BARE_NAME.test(withoutSlots) && !ENVIRONMENT_SUBJECT.test(withoutSlots)) {
        issues.push({
          path: doc.path,
          line: paragraph.startLine,
          rule: 'name.not_about_the_environment',
          message:
            'names FORMIO_PROJECT_URL / FORMIO_BASE_URL where the subject is not the environment; name the value in prose or as a projectUrl / baseUrl field',
        });
      }
    }

    const prose = stripCode(doc.body);
    if (POSTMAN_PLACEHOLDER.test(prose)) {
      issues.push({
        path: doc.path,
        line: lineNumberOf(doc.body, POSTMAN_PLACEHOLDER),
        rule: 'placeholder.unresolved_postman',
        message:
          'carries an unresolved Postman placeholder outside a code span or fence; resolve it to {projectUrl} or {baseUrl}',
      });
    }

    return issues;
  });
}
